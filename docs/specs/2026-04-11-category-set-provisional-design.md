# Spec: Provisional CategorySets for SharedCaseMetadata

**CLUE Repository**: https://github.com/concord-consortium/collaborative-learning

## Status

Implemented (CLUE-496).

## Problem

`SharedCaseMetadata.addCategorySet` was an MST action called from MST **view** functions (via the `getCategorySet` helper in `shared-case-metadata.ts`). Because the view-level callers (`categoryArrayForAttrRole`, `categorySetForAttrRole`, `getLegendColorForCategory`, `categorySetForPlace` on `DataConfigurationModel`) are evaluated inside MobX reactions, `addCategorySet` fired whenever one of those reactions ran — producing its own history entry even when the view read was triggered by an unrelated user action.

### Concrete example

`graph-model.createEditableLayer` is a synchronous MST action. A single user click of "Add manual points" produced **three** history entries:

1. `addCategorySet` on `SharedCaseMetadata` (for the x attribute)
2. `addCategorySet` on `SharedCaseMetadata` (for the y attribute)
3. `createEditableLayer` on the graph model

The two `addCategorySet` entries appeared because MobX reactions fire at the end of the outermost MST action. The reaction chain: `setAttributeForRole` → `handleAttributeAssignment` → `setAxis` → `use-axis.ts` `mstAutorun` → `computeDesiredExtent` → `categoryArrayForAttrRole` → `getCategorySet` → `addCategorySet`. This happened once per axis regardless of whether it was categorical.

### Impact

- User actions fragment into multiple history entries.
- Undo/redo grouping is wrong: undoing "create editable layer" doesn't undo the category-set creations that were logically part of it.
- History replay of older documents may encounter these stray entries in ways that aren't robust.

The underlying design tension is that `CategorySet` does two different jobs inside a single MST model.

## Design

### Observation: `CategorySet` has two jobs

**Job 1 — Derived category data (ephemeral):** The `values` list, `_indexMap`, `_isValid` cache, computed from `self.attribute.strValues`. The `afterAttach` subscription to attribute actions that invalidates the cache. Nothing here needs to persist.

**Job 2 — User customizations (persistent):** `colors` map (user-assigned colors per category value) and `moves` array (user-reordered category positions). These only have meaning after the user has actually recolored or reordered something.

The reason `getCategorySet` created on demand was that Job 1 needs an MST instance (it holds `volatile` state, subscribes to attribute actions, and holds a `types.reference(Attribute)`). Lazily creating them avoided instantiating Job-1-only sets for every attribute in every dataset — but the lazy creation from a view was the source of the problem.

### CODAP's approach

CODAP v3 solved the same problem by splitting CategorySet instances into two tiers using the same model type:

- **Provisional** CategorySets live in a `volatile observable.map` on the metadata model. Creating one does not produce MST actions or history entries, because `volatile` state is not part of the MST snapshot.
- **Persistent** CategorySets live in the normal `types.map` slot on the metadata model. They are only created when the user actually does something that needs to be saved.

CODAP uses a custom MST environment (`{ provisionalDataSet: data }`) so that the `types.reference(Attribute)` on a detached provisional can resolve via the dataset. CODAP promotes a provisional to a persistent instance via a `when(...)` reaction that watches `moves.length > 0 || colors.size > 0` and, on the first change, copies the provisional's state into the persistent slot.

### Deviations from CODAP

CLUE adopts CODAP's provisional/persistent split but deviates in several ways, each motivated by a specific problem with CODAP's approach.

#### Deviation 1: synchronous promotion instead of `when`

CODAP's `when(...)`-based promotion has two drawbacks:

1. The promotion fires as a **separate top-level MST action**, not grouped with the user's action in history.
2. The user's mutation (`move`, `setColorForCategory`, …) happens on the **detached provisional instance**. Document-level `onAnyAction` middleware never sees those mutations — it only sees the post-facto promotion. History records "a category set appeared with these moves", not "the user moved category X".

CLUE promotes **synchronously, before the mutation is applied**, via `ensurePersistentCategorySet(attrId)` on `SharedCaseMetadata`. Call sites use a two-step pattern: ensure persistent, then mutate the returned instance. All mutations flow through the attached persistent instance, so they appear in history as the actual user action.

#### Deviation 2: pure `getCategorySet` view, eager ensure reaction

CODAP's `getCategorySet` is a view that mutates `provisionalCategories` when a provisional doesn't exist yet. Mutating an `observable.map` from inside a MobX computed has fragilities:

- MobX strict-mode (`enforceActions: "always"`) would flag it.
- The view reads and writes the same key, creating a self-invalidation edge in the dependency graph.
- Composing the view inside other reactions produces ordering-sensitive re-runs.

CLUE makes `getCategorySet` a **pure view** with no side effects. Provisionals are created eagerly via an `mstReaction` installed in `DataConfigurationModel.afterAttach`. The reaction watches the set of attribute IDs currently assigned to a graph role as categorical, and calls `ensureProvisionalCategorySet(attrId)` for each one. This is a real MST action on `SharedCaseMetadata` — no strict-mode issue, no self-invalidation.

The invariant: **a provisional CategorySet exists iff an attribute is currently assigned to a graph role as categorical.** Numeric attributes never get a provisional. The old behavior where `computeDesiredExtent` triggered on-demand creation of category sets for every axis regardless of type becomes a non-issue: `getCategorySet` returns `undefined` for numeric attributes and callers fall back to `['__main__']`.

#### Deviation 3: disposal-based invariant enforcement

When `ensurePersistentCategorySet` promotes a provisional, it removes the provisional from `provisionalCategories` and calls `destroy(provisional)`. MST marks the node as dead — any subsequent read or write throws the "object no longer part of a state tree" error. This makes the "don't cache a CategorySet across a mutation" invariant runtime-enforced rather than documented.

(Persistent CategorySets don't need explicit `destroy` — `types.map` destroys removed children automatically.)

#### Deviation 4: unified per-attribute `addDisposer` for cleanup

CODAP cleans up CategorySets via the `onAttributeInvalidated` callback on `types.reference(Attribute)`. A volatile `handleAttributeInvalidated` holds a handler, and `getCategorySet` wires that handler each time it creates a provisional. The handler then removes the entry from whichever map it lives in. This has two problems:

1. The handler is only wired at provisional-creation time. A persistent CategorySet that arrives by snapshot rehydration or `applyPatch` never passes through `getCategorySet`, so its volatile handler stays undefined and removing its attribute leaves an orphan entry behind.
2. The call path is twisted: `types.reference.onInvalidated` → volatile `handleAttributeInvalidated` → `onAttributeInvalidated` action → parent handler → map mutation. It takes four hops to route a destruction event into a cleanup.

CLUE replaces this with a **single `addDisposer(attribute, ...)` per attribute**, installed by `SharedCaseMetadata` via a reaction over `self.data.attributes`. The disposer body (`_cleanupAttribute(attrId)`) removes any CategorySet keyed by that attribute — provisional OR persistent — when the attribute is destroyed. Keying cleanup off the Attribute lifecycle rather than the CategorySet lifecycle means the mechanism is oblivious to *how* the CategorySet came into existence: fresh inserts, snapshot rehydration, and patch-added entries are all handled uniformly. MST fires `addDisposer` callbacks synchronously inside the destruction call stack, so cleanup stays inside the enclosing action — one history entry, not two.

A MobX reaction is NOT an option for this cleanup: reactions fire after the enclosing action completes, which would produce a second top-level action and a second history entry — the exact problem CLUE-496 exists to eliminate. `addDisposer` is the only mechanism that fires synchronously during destruction.

Because the disposer is installed on the Attribute but closes over `SharedCaseMetadata`, it can outlive `self` if `SharedCaseMetadata` is destroyed before the DataSet. The callback guards with `isAlive(self)` to no-op in that case. (MST's public API provides no way to unregister a disposer once added, so proactive cleanup isn't possible.)

With this change, CLUE's `CategorySet` no longer needs the `onInvalidated` callback on its `types.reference`, the volatile `handleAttributeInvalidated`, or the `onAttributeInvalidated` action — all three are removed.

#### Deviation 5: volatile pointer instead of MST environment

CODAP uses a custom MST environment so that `types.reference(Attribute)` on a detached provisional can resolve via the dataset. CLUE uses a simpler approach: a volatile `_provisionalAttribute` pointer on `CategorySet` that holds a direct reference to the `IAttribute` instance. An `attr` view returns `self._provisionalAttribute ?? self.attribute`, and an `isProvisional` view checks whether the pointer is set. This avoids the `getEnv`/`hasEnv` machinery and makes provisional detection a simple property check.

#### Deviation 6: no `afterCreate`/`afterAttach` split for subscriptions

CODAP splits the attribute-action subscription across `afterCreate` (for provisionals) and `afterAttach` (for persistents). CLUE only installs the subscription in `afterAttach`, meaning only persistent instances get it. Provisional instances don't need it because they are never mutated and their derived data is rebuilt on demand.

#### What stays identical to CODAP

- The provisional/persistent split as two tiers using the same model type.
- Provisional instances live in a `volatile observable.map` on metadata.
- `createProvisionalCategorySet(data, attrId)` as the constructor helper.
- The overall shape of persistent storage (`categories: types.map(CategorySet)` slot on `SharedCaseMetadata`).

### Key model behaviors

#### `SharedCaseMetadata`

- `provisionalCategories`: volatile `observable.map<string, ICategorySet>`.
- `_attrsWithCleanupDisposer`: volatile `Set<string>` tracking which attribute ids already have a cleanup disposer, so the reaction below doesn't re-register on repeat firings.
- `getCategorySet(attrId)`: pure view, returns persistent entry if it exists, otherwise provisional, otherwise `undefined`.
- `ensureProvisionalCategorySet(attrId)`: idempotent action. Returns any existing instance (persistent or provisional). If none exists, creates a provisional via `createProvisionalCategorySet` and stores it in `provisionalCategories`. **Called only from the ensure reaction on `DataConfigurationModel`.** Cleanup on attribute destruction is handled uniformly by the per-attribute disposer — this action does not register its own `addDisposer`.
- `ensurePersistentCategorySet(attrId)`: idempotent action. Returns existing persistent if present. Otherwise creates a fresh persistent entry (no snapshot copy needed since provisionals can never be mutated) and destroys any existing provisional. Cleanup on attribute destruction is again handled by the per-attribute disposer.
- `removeCategorySet(attrId)`: action that deletes from the `categories` MST map. Called from `_cleanupAttribute` so MST's action-protection model permits the map mutation even when invoked from inside a DataSet action (e.g., `removeAttribute`).
- `_cleanupAttribute(attrId)`: action invoked from the per-attribute disposer. Removes any persistent entry (via `removeCategorySet`), destroys any provisional, and clears the entry from `_attrsWithCleanupDisposer`. Additional attribute-keyed state (e.g., `columnWidths`, `hidden`) can be cleaned up here too.
- `_ensureAttributeCleanupDisposer(attribute)`: action that calls `addDisposer(attribute, ...)` at most once per attrId, tracked via `_attrsWithCleanupDisposer`. The disposer callback guards with `isAlive(self)` and delegates to `_cleanupAttribute`.
- `afterAttach`: installs an `mstReaction` over `self.data?.attributes.map(a => a.id)` that calls `_ensureAttributeCleanupDisposer` for each attribute. `fireImmediately: true` + `comparer.structural` means existing attributes get their disposer at rehydration time, and new attributes get one as they're added.
- The old `addCategorySet` action is removed.

#### `CategorySet`

- Volatile `_provisionalAttribute` pointer and `isProvisional` view for distinguishing provisional from persistent instances.
- `attr` view that reads the volatile pointer for provisionals and the MST reference for persistents — all internal attribute reads go through this.
- Mutation guard on `move`, `setColorForCategory`, `storeCurrentColorForCategory`, and `storeAllCurrentColors`: throws if `isProvisional` is true.
- Attribute-action subscription installed only in `afterAttach` (persistent instances only).
- **No cleanup plumbing of its own.** The `types.reference(Attribute)` is a plain reference (no `onInvalidated` callback). There is no volatile `handleAttributeInvalidated` and no `onAttributeInvalidated` action. Cleanup is entirely owned by `SharedCaseMetadata`'s per-attribute disposer, installed via the reaction above.

#### Ensure reaction on `DataConfigurationModel`

An `mstReaction` in `afterAttach` maintains the invariant that provisionals exist for all categorical graph-role attributes:

- `fireImmediately: true` ensures the initial state is covered (snapshot load, history replay, initial attachment).
- `comparer.structural` prevents spurious re-runs.
- `attributeType(role)` establishes dependencies on both the override type and the inferred type.
- Idempotent: fires safely with the same inputs without creating duplicates.
- Categorical → numeric flips leave the provisional in place (volatile and cheap). A flip back re-uses it.
- Install order: `afterAttach` runs before React components mount, so provisionals are in place before consumer reactions read them.

#### Why the ensure approach is safe for promotion

After `ensurePersistentCategorySet` promotes an attribute:

1. The persistent entry exists in `self.categories`.
2. The provisional is removed and destroyed.
3. If the ensure reaction re-fires, `ensureProvisionalCategorySet` finds the persistent entry first and returns it unchanged — no duplicate provisional is created.
4. `getCategorySet` checks `self.categories` first, so the pure view always returns the persistent entry after promotion.

#### Reads after promotion

`getCategorySet` reads `self.categories.get(attrId)` first, then falls back to `self.provisionalCategories.get(attrId)`. MobX tracks dependencies on both. When `ensurePersistentCategorySet` runs, both map mutations happen inside the same action, so dependents see both changes atomically. Stale references explode via MST's dead-node check.

### Call site changes

All three production mutation call sites use `ensurePersistentCategorySetForRole(role)` on `DataConfigurationModel`, which wraps the `metadata.ensurePersistentCategorySet(attrId)` lookup:

1. **use-sub-axis.ts** (category drag-reorder): calls `dI.dataConfiguration.ensurePersistentCategorySetForRole(dI.attrRole)` then `persistent?.move(...)`.
2. **`storeAllCurrentColorsForAttrRole`**: calls `ensurePersistentCategorySetForRole(role)` then `persistent?.storeAllCurrentColors()`.
3. **`swapCategoriesForAttrRole`**: uses `categorySetForAttrRole` (the read-side view) for reading `categoryArray`, then `ensurePersistentCategorySetForRole(role)` for the mutation.

This keeps the two-step pattern in `DataConfigurationModel` rather than in UI code.

## Interaction with history replay

- **Recording.** Provisional CategorySets live in volatile state, never appear in snapshots, and never generate history entries. The ensure reaction's `ensureProvisionalCategorySet` is an MST action but only mutates volatile state, so it produces no snapshot patches. Persistent CategorySets are created by normal MST actions and appear in history normally.
- **Replay.** Volatile state is rebuilt from scratch. The ensure reaction fires with `fireImmediately: true` and re-populates provisionals. Persistent categories are restored from snapshot. Recorded `ensurePersistentCategorySet` actions replay normally.
- **Historic documents.** Existing documents may contain persistent `CategorySet` entries for attributes the user never customized. These are valid: `ensurePersistentCategorySet` returns them unchanged, and the ensure reaction's idempotency check short-circuits. The extra entries are harmless.

## Behavior change: `createEditableLayer` no longer produces stray history entries

After the change, `createEditableLayer` produces a single history entry. The x and y attributes are numeric, so the ensure reaction creates no provisionals. The view-level reads are pure: `getCategorySet` returns `undefined`, `categoryArrayForAttrRole` falls back to `['__main__']`, no MST action fires.

This fix applies to every user action that previously caused on-demand category set creation during a reaction. Only user actions that actually mutate a persistent CategorySet produce history entries, and each produces exactly one logical history group.

## Files changed

| File | Change |
|---|---|
| `src/models/data/category-set.ts` | Add `_provisionalAttribute` volatile pointer, `setProvisionalAttribute` action, `attr` and `isProvisional` views. Add `createProvisionalCategorySet` constructor. Add `isProvisional` guard on all mutation actions. Remove the `onInvalidated` callback on `types.reference(Attribute)`, the volatile `handleAttributeInvalidated`, and the `onAttributeInvalidated` action — replaced by the unified per-attribute disposer on `SharedCaseMetadata`. |
| `src/models/shared/shared-case-metadata.ts` | Add `provisionalCategories` volatile map. Make `getCategorySet` a pure view. Add `ensureProvisionalCategorySet` and `ensurePersistentCategorySet` actions. Remove `addCategorySet`. Add `_cleanupAttribute` / `_ensureAttributeCleanupDisposer` / `removeCategorySet` actions and an `afterAttach` reaction over `data.attributes` that installs one cleanup disposer per attribute. |
| `src/plugins/graph/models/data-configuration-model.ts` | Add `ensurePersistentCategorySetForRole` action. Update `storeAllCurrentColorsForAttrRole` and `swapCategoriesForAttrRole` to use it. Add the ensure reaction in `afterAttach`. |
| `src/plugins/graph/imports/components/axis/hooks/use-sub-axis.ts` | Route drag-reorder through `ensurePersistentCategorySetForRole`. |
| `src/models/shared/shared-case-metadata.test.ts` | Tests for pure `getCategorySet`, provisional/persistent lifecycle, stale-reference safety, attribute-removal cleanup. |
| `src/models/data/category-set.test.ts` | Tests for provisional creation, `isProvisional` view, mutation guard. |

## Out of scope

- Collapsing the derived-category-data logic into a non-MST structure. The derived data still lives inside `CategorySet` as in CODAP.
- Changing the `categories: types.map(CategorySet)` slot shape on `SharedCaseMetadata`.
- Upstreaming the synchronous-promotion deviation back to CODAP.
- Optimizing `computeDesiredExtent` to skip `categoryArrayForAttrRole` for numeric axes. Under this design the read is harmless (pure view, returns `undefined`, caller falls back to `['__main__']`).

## Testing

- Unit tests for `SharedCaseMetadata`: `getCategorySet` purity, `ensureProvisionalCategorySet` idempotency and snapshot exclusion, `ensurePersistentCategorySet` promotion and provisional destruction, stale-reference errors after promotion and after attribute removal. Rehydration test: a persistent entry restored from a snapshot is still cleaned up when its attribute is later removed. Patch test: a persistent entry inserted via `applyPatch` is cleaned up when its attribute is later removed.
- Unit tests for `CategorySet` guards: mutation actions throw on provisional instances.
- Unit test for the ensure reaction on `DataConfigurationModel`: categorical attributes get provisionals, numeric ones don't, type flips behave correctly, re-firing after promotion is idempotent.
- Regression test: `createEditableLayer` produces exactly one history entry.
- Manual verification: category drag-reorder produces a clean, single, undoable history entry. History playback of documents with graph interactions works end to end.
