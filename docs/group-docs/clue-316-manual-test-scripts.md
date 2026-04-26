# CLUE-316 Manual Test Scripts

Pause/resume scripts to exercise the inconsistency-risk cases documented in
`docs/superpowers/specs/2026-04-22-merge-independent-forks-design.md`. All scripts
use two CLUE clients (two browser profiles or two incognito windows) opened to the
same group document, and the pause/resume upload controls in the history-view debug
panel (GD-3).

For each script, "expected outcome" describes what the scope-based merge *should*
produce. "Bad-state signal" describes what misbehavior would look like if the
merged state is inconsistent — this is what we're watching for.

## 1. Cross-scope reference drift (drawing → variable)

**Setup:** Group document. Both users in the same group, same document.

**Note on variable deletion:** CLUE's UI has no direct path to destroy a variable
from SharedVariables. However, when a drawing tile or diagram tile **undoes** a
new-variable action, the variable IS removed from the shared model. (The text
tile's new-variable undo does NOT remove the variable — only drawing and diagram
do.) This script uses that undo as a proxy for true deletion.

**Script:**
1. User A: add a diagram tile and a drawing tile, then create variable V1 via
   the diagram tile's new-variable button. V1 is now in the SharedVariables
   shared model and both users see it.
2. Pause user B's uploads.
3. User B: in the drawing tile, insert a reference to V1 (drawing tile's
   insert-variable button).
4. User A: undo the last action (the new-variable creation). This destroys V1
   from the shared model.
5. Resume user B's uploads.

**Expected outcome (merge):** User A's destruction of V1 touches
`shared:<SharedVariables>`. User B's insertion of the drawing chip touches
`tile:<drawing>`. Scopes are disjoint, so the merge keeps both changes.

**Bad-state signal:** Drawing tile throws when rendering (unresolved reference),
or shows an empty/placeholder variable that should not exist.

**Observed results (2026-04-24):**

- **User B, before resume:** User B receives and applies user A's variable-delete
  entry while user B's drawing still holds a chip referencing V1. From the UI the
  document looks fine. The browser console shows MST warnings about dangling
  references.
- **User B, at resume:** User B's queued history entry (adding the chip to the
  drawing) uploads successfully — scopes were disjoint from user A's delete, so
  the merge allowed it to survive.
- **User A, after user B resumes:** User A receives and applies user B's chip-add
  entry. The drawing does not show the variable (V1 no longer exists). Similar
  MST warnings appear in user A's console.

So the bad-state signal is visible only via console MST warnings, not in the UI.
In principle, `updateAfterSharedModelChanges` on the drawing tile could detect
the dangling reference and prune its chip — but it currently does not.

## 2. Cross-scope reference drift (diagram → variable)

**Setup:** Group document. Both users in the same group, same document. Note: a
document can only have one diagram tile, so this script uses the drawing tile's
new-variable + undo as the destroy-V1 mechanism (same proxy as script 1).

**Script:**
1. User A: add a diagram tile and a drawing tile, then create variable V1 via
   the drawing tile's new-variable button. V1 is now in the SharedVariables
   shared model and both users see it.
2. Pause user B's uploads.
3. User B: in the diagram tile, insert V1 (diagram tile's insert-variable
   button, which adds a diagram node whose `variable` field references V1).
4. User A: undo the last action (the drawing tile's new-variable). This
   destroys V1 from the shared model.
5. Resume user B's uploads.

**Expected outcome (merge):** User A's destruction of V1 touches
`shared:<SharedVariables>`. User B's insertion of the diagram node touches
`tile:<diagram>`. Scopes are disjoint, so the merge keeps both changes.

**Bad-state signal:** Diagram tile fails to render because the node's variable
reference no longer resolves, crashing the tile or the document.

**Observed results (2026-04-24):**

Reproduced. User B's document crashed with an MST unresolved-reference error:

```
[mobx-state-tree] Failed to resolve reference 'JhgtQZfARKuPI5re' to type
'Variable' (from node: /content/tileMap/apJHGfxcrTY1t-jQ/content/root/nodes/
Wxse_90_H0If0WNG/variable)
```

Unlike the drawing tile (script 1), the diagram tile models the variable
association as a real `types.reference`. MST resolves strict references at
property-access time; if the target `Variable` node is absent, resolution
throws. In the drawing tile it's just a string id that gets looked up lazily
at render time, so the failure mode is a console warning, not a crash.

- Diagram: `node_modules/@concord-consortium/diagram-view/dist/esm/diagram/models/dq-node.js:10-14` —
  `DQNode` declares `variable: types.reference(Variable)` (no `safeReference`,
  no `maybe`).
- Drawing: [src/plugins/shared-variables/drawing/variable-object.tsx:24-28](../../src/plugins/shared-variables/drawing/variable-object.tsx#L24-L28) —
  `VariableChipObject` declares `variableId: types.string`.

**Recovery on reload:** Reloading either client clears the visible error. The
saved document contains no variables in the shared model and no diagram node
referencing the deleted variable, so the load is clean. The remote history,
however, still contains user B's `DQRoot.insertNode` entry — likely because
the MST crash prevented user B's post-merge state from being persisted, while
the history entry had already been uploaded independently.

**Implications:**
- **Good for users:** reload recovers. The bad state is ephemeral from the
  end-user's perspective.
- **Bad for history replay:** the history scrubber will hit the same
  unresolved-reference crash when it reaches the orphaned `insertNode`
  entry.
- **Content/history drift:** the saved document's `lastHistoryEntryId`
  points at the second-to-last remote entry (the pre-insertNode state),
  not the entry that followed. CLUE-485's drift detection does not flag
  this — it only errors when the saved id is absent from the history
  entirely; here the id is still present, just not at the tail.

## 3. Cross-scope reference drift (graph → dataset attribute)

**Setup:** Group document with a table tile and a linked graph tile.

**Script:**
1. Pause user A's uploads.
2. User A: in the graph tile, assign a different attribute to the Y axis.
3. User B: in the table tile (or via the dataset), delete the attribute user A
   is about to target.
4. Resume user A's uploads.

**Expected outcome (merge):** Graph tile change and shared dataset change are on
disjoint scopes (`tile:<graph>` vs `shared:<dataset>`). Merge proceeds.

**Bad-state signal:** Graph throws an exception rendering an axis bound to a
missing attribute id, or silently draws nothing.

**Observed results (2026-04-24):**

No visible error. The graph's Y series goes blank and the points disappear. No
console messages. The saved document still contains the deleted attribute id in
the graph's `_yAttributeDescriptions`.

The silent blanking is intentional tolerance built into the graph tile:

- `AttributeDescription.attributeID` is declared as a plain `types.string` at
  [src/plugins/graph/models/data-configuration-model.ts:20-30](../../src/plugins/graph/models/data-configuration-model.ts#L20-L30) —
  not a `types.reference`, so MST never attempts resolution and cannot throw an
  unresolved-reference error (contrast with the diagram tile in script 2).
- Rendering goes through `DataSet.getNumeric()`, which returns `undefined` when
  the attribute id is missing from `attrIDMap`. At
  [src/plugins/graph/components/scatterdots.tsx:128](../../src/plugins/graph/components/scatterdots.tsx#L128),
  `undefined ?? NaN` feeds `yScale(NaN)` → invisible points, no error.

A pruning handler exists but does not fire for this merge case:

- [src/plugins/graph/models/data-configuration-model.ts:921-935](../../src/plugins/graph/models/data-configuration-model.ts#L921-L935)
  — `handleDatasetRemoveAttributeAction` removes the stale entry from
  `_yAttributeDescriptions` when it sees a `removeAttribute` action.
- It is registered via `onAnyAction(self.dataset, self.handleAction)` at
  [src/plugins/graph/models/data-configuration-model.ts:765](../../src/plugins/graph/models/data-configuration-model.ts#L765),
  which only observes MST action calls on this client's dataset instance.
  Remote attribute deletes arrive as applied patches through the tree-patch
  manager, not as action calls, so the handler never runs and the stale id
  persists in the saved document.

## 4. Schema-assumption drift (table column type)

**Status (2026-04-24): not reproducible in CLUE today — no user-facing path to
change an attribute's type on the shared dataset.**

CLUE's `Attribute` model infers its `type` from its values; the `userType`
override that CODAP uses is commented out
([src/models/data/attribute.ts:28](../../src/models/data/attribute.ts#L28), type
getter at [lines 73–77](../../src/models/data/attribute.ts#L73-L77)). The table
tile's column-header menu only offers sort and remove — no "set type" option
([src/components/tiles/table/column-header-cell.tsx](../../src/components/tiles/table/column-header-cell.tsx)).
The graph tile's "Treat as Numeric/Categorical" menu
([axis-or-legend-attribute-menu.tsx:155–158](../../src/plugins/graph/imports/components/axis/components/axis-or-legend-attribute-menu.tsx#L155-L158))
writes to the graph's own `_yAttributeDescriptions[n].type`
([data-configuration-model.ts:880](../../src/plugins/graph/models/data-configuration-model.ts#L880)),
which is graph-local state, not a shared-dataset mutation.

Leaving this case in the script as a placeholder: if CLUE later exposes an
attribute-level type override (or we simulate one via a test hook), the intended
merge scenario is:

**Script (hypothetical):**
1. Pause user A's uploads.
2. User A: set a cell-level formatting or tile-level setting that assumes the
   numeric type.
3. User B: change the column's type to string in the shared dataset.
4. Resume user A's uploads.

**Expected outcome (merge):** Tile formatting change (`tile:<table>`) and dataset
type change (`shared:<dataset>`) are disjoint. Merge proceeds.

**Bad-state signal:** Table renders cells with the numeric formatting applied to
string values, or throws when formatting.

## 5. Computed-state drift (graph axis bounds vs dataset rows)

**Setup:** Group document with a table tile and a linked graph tile.

**Script:**
1. Pause user A's uploads.
2. User A: adjust the graph's axis bounds to fit the current dataset.
3. User B: add rows to the dataset that fall well outside those bounds.
4. Resume user A's uploads.

**Expected outcome (merge):** Graph tile change (`tile:<graph>`) and dataset row
change (`shared:<dataset>`) are disjoint. Merge proceeds.

**Bad-state signal:** Graph axis bounds clip new data points silently; this is
more of a "stale state" than a crash — note whether it confuses users rather than
breaks the app.

**Observed results (2026-04-26):**

Bad-state signal no longer reproduces. The second batch's
`{ shared:<dataset>, tile:<graph> }` scope is now correctly checked against
user A's pending axis entries; those entries are reverted, and user B's
auto-expanded bounds survive on user A's screen. Both the drag case and the
edit-max case behave the same way.

This script is what originally surfaced the subsequent-batch fork-detection
bug — the scope check was correct, but it wasn't running on batch 2. Mechanism
and fix: [docs/superpowers/specs/2026-04-24-fork-detection-rollback-recording-design.md](../superpowers/specs/2026-04-24-fork-detection-rollback-recording-design.md).

Entry-shape details (still accurate; preserved as reference):

- **Row add (user B):** adding a new row is a two-step interaction — first the
  row is added (`Table.addCanonicalCases` entry, scope `{ shared:<dataset> }`),
  then a cell is filled in which completes the datapoint and triggers the
  graph's autoscale in the same action (`Table.setCanonicalCaseValues` entry,
  scope `{ shared:<dataset>, tile:<graph> }`). These two entries arrive on
  user A as **separate batches** — confirmed by watching the history view,
  where `addCanonicalCases` shows up first and `setCanonicalCaseValues` arrives
  later when the second cell is filled in.
- **Manual axis, drag (user A):** dragging emits multiple `NumericAxis.setDomain`
  entries, each with scope `{ tile:<graph> }`.
- **Manual axis, edit max label (user A):** clicking the max label and typing
  a new value emits one `NumericAxis.setMax` entry, same scope
  `{ tile:<graph> }`.

Relevant code:

- Scope computation: [src/models/history/entry-scopes.ts:10-35](../../src/models/history/entry-scopes.ts#L10-L35)
  (tile and shared scope keys derived from patch paths).
- Axis actions: [src/plugins/graph/imports/components/axis/models/axis-model.ts:82-107](../../src/plugins/graph/imports/components/axis/models/axis-model.ts#L82-L107)
  (`setMin`, `setMax`, `setDomain` all mutate the same numeric axis model —
  patch paths land under the graph tile, not the shared dataset).

## 6. Stale shared-model snapshot in tile state (data card selection)

**Setup:** Group document with a data-card tile.

**Script:**
1. Pause user A's uploads.
2. User A: interact with the data card to change its selected case / pagination
   state (anything cached on the tile model, not in the shared dataset).
3. User B: delete or reorder cases in the shared dataset.
4. Resume user A's uploads.

**Expected outcome (merge):** Disjoint scopes, merge proceeds.

**Bad-state signal:** Data card shows a case that no longer exists, jumps to an
unexpected case, or throws when rendering the selection.

**Observed results (2026-04-26):**

No bad-state signal. The data card tracks the selected case by index, not by
reference, and tolerates an out-of-range index gracefully. After user B deletes
the underlying case, user A's card simply renders whatever case now occupies
that index — the same behavior a single user sees when deleting a case in a
non-collaborative document.

## Reporting

For each script, record in the PR or follow-up ticket:
- Did the bad-state signal appear?
- Is the resulting document recoverable by refreshing / reopening?
- Does the browser console show an exception?

Scripts where the bad-state signal appears are candidates for GD-10 or GD-11
follow-up work. Scripts where nothing bad happens in practice validate that the
scope-based merge is safe enough for this feature.

## Future idea: opt-in coupled scopes per tile / shared-model type

The scripts above show that a tile can end up in an inconsistent state when a
shared model it depends on is mutated by another user. The current scope-based
merge treats these as disjoint because the patches don't touch the same path.

**Idea:** Add a per-(tile type, shared-model type) coupling setting. If the
pair (tile X, shared-model Y) is declared coupled, every history entry
produced by a tile of type X gets an additional `shared:<smId>` scope for
each shared model of type Y the tile is attached to (or, more conservatively,
every shared model of type Y in the document).

**Effect on script 1:** A local drawing edit carries `tile:<drawing>` *plus*
the extra `shared:<SV>`. The remote destroy-V1 carries `shared:<SV>`. Scopes
now overlap → conflict → the drawing edit rolls back instead of landing on
top of a destroyed variable.

**Why this shape:** it's targeted. Only the known-risky tile ↔ shared-model
pairs expand the conflict surface; everything else keeps the benefit of
disjoint-scope merge. Users keep most of their concurrent work — only the
edits genuinely at risk of producing inconsistent state get reverted.

**Candidate couplings (from the scripts above):**
- (Drawing, SharedVariables) — script 1
- (Diagram, SharedVariables) — script 2
- (Graph, SharedDataSet) — scripts 3, 5
- (Table, SharedDataSet) — script 4
- (DataCard, SharedDataSet) — script 6

**Open questions:**
- Scope computation today is a pure path→string map. Adding coupling means
  passing the tile type and the document's shared-model registry into
  `getEntryScopeKeys` (or a sibling function).
- Tight version: only shared models in the tile's own `sharedModels()` list.
  Looser version: every shared model of the matching type in the document.
  The looser version catches more cases but reverts more aggressively.
- Declarative placement: the coupling could live in tile-plugin registration
  (the same place toolbar buttons and shared-model types are registered).
