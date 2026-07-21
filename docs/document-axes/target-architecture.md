# Document Axes: Architecture

> **Status:** Architecture design (structure and boundaries, not concrete implementation). Target end-state
> under the "ideal world" framing.
> **Depends on:** the axis definitions in [axes.md](axes.md) (the *what*: which axes exist and what each
> means) and the current-state evidence in the findings doc (research background, on the
> `document-type-decomposition` branch).
> This document is the *how it lives in code*.

## Goal and the problem it solves

The refactor's purpose is **understandability**: to make it easy to see what a document type means. Today the
document `type` field is switched on in ~90 scattered places across the client, rules, and functions
(findings doc). Decomposing `type` into explicit axes only helps if we do **not** re-scatter the same
knowledge as `kind → axis` mappings spread across the code. The architecture below is organized to *prevent*
that scatter.

## The three views to preserve

A good design lets you read any of these in one place:
- **by-axis** — what properties a document has (its `canonical`, `owner`, `scope`, `permissions`, `concurrent`).
- **by-kind** — everything about one kind (`personal`, `group`, …): its defaults, presentation, templates.
- **by-behavior** — how one behavior works (nav routing, publish, SortWork membership), reading axes.

The current type-switch serves *none* of these well. The architecture serves all three, with the
`kind → axis` mapping happening in exactly one place.

## Architecture overview — three layers

```
  DocumentContentModel      generic tile container (content, tiles, shared models)
        ▲                   — already exists; already reused standalone (curriculum, doc-editor)
        │ content
  DocumentModel             the metadata wrapper + AXIS GETTERS (by-axis view)
        │                   — canonical, owner, scope, permissions, concurrent, kind
        │
   ┌────┴───────────────┬────────────────────────┐
   │                    │                         │
 Kind registry     Behavior modules          Creation factory
 (by-kind view)    (by-behavior view)        (the ONE kind→axis bridge)
 fn(doc)→config    fn(doc)→result            reads registry defaults,
 kind read here    read getters/registry     stamps axis values on a new doc
                   never branch on kind
```

## Layer 1 — `DocumentModel`: axis getters (metadata)

`DocumentModel` (the existing metadata wrapper) exposes the **stored axes as getters**. This is the by-axis
view, and it is legitimate to put here because these are *data the document has*, not a *use* of the document
(see "The boundary" below).

| axis | getter source |
|---|---|
| `owner` | existing `uid` (identity/provenance; may differ from scope for publications) |
| `scope` | derived from `context` / `offeringId` / `groupId` / `problem` / `unit` (the org + curriculum associations) |
| `kind` | existing `type` (a stored tag — see Layer 2 for its uses) |
| `canonical` | new stored field (pointer-slot occupancy) |
| `permissions` | **composed getter** — merges *permission-policy grants* (from the document's referenced policy) with *stored per-doc grants* (the `visibility` share toggle, support audience, exemplar visibility). See "Permissions composition" below |
| `concurrent` | new stored field (multi-writer; marks special stored state, rule-readable) |

`DocumentContentModel` (the generic tile container) is **unchanged** and stays free of any of this. The
existing type-view methods on `DocumentModel` (`isProblem`, `isGroup`, …) are exactly the kind-branching this
refactor removes; they are replaced by axis getters and by external behaviors.

### Permissions composition (a policy + per-doc-grants hybrid)

`permissions` is the one axis that is *not* simply stored. Its effective value is **composed at runtime**:

> `doc.permissions` = **permission-policy grants** (the rules of the document's referenced policy) **+** **stored per-doc grants**

- **Permission-policy grants** (e.g. "owner may read/write", "teacher may read") are the shared rules of a
  named **permission policy**. The document stores a *reference* to the policy (a stable name); the rules
  themselves live in code. Because the reference is stored, both the runtime and the Firestore security rules
  resolve it to the same rule set — matching on the policy name, never branching on `kind`. A `kind` selects
  which policy a new document gets, and several kinds may share one policy. Changing a policy's rules changes
  every referencing document with **no migration**; the rules are never copied onto the document.
- **Stored per-doc grants** are only the parts that genuinely vary per document: the `visibility` share
  toggle (a user-controlled class-read grant), a support's target audience, exemplar per-student visibility.

So the `permissions` getter resolves the document's policy and merges its rules with the document's own stored
grants. The existing `visibility` field folds in here as one stored per-doc read grant — it is not a separate
axis.

**Where a policy's rules live — two coordinated copies.** A policy is code, not stored data, and its rules are
written in *two* places keyed by the same policy name: once on the client/runtime (to compute
`doc.permissions`) and once in `firestore.rules` (to enforce them). A document stores only the policy *name*,
never the rules — so the two copies have to be kept in sync, but that is the deliberate tradeoff: changing a
policy is a code change on both sides and **never a data migration**, however many documents reference it. It
is what lets the shared permission rules stay central *and* be rule-enforceable at the same time — the
resolution of the "security rules can't do the client-side lookup" tension noted under Non-goals.

## Layer 2 — the kind registry (by-kind view)

One registry, the **single source of truth for everything kind-specific**: a data entry per kind holding
- **creation defaults** — the axis values a new doc of this kind receives,
- **presentation config** — labels, title-bar choice, CSS,
- **copy/publish templates** — the target axis-vectors for derived documents,
- any **kind-keyed flags** (e.g. SortWork membership).

**API takes the document, not the kind.** The registry is exposed as functions of a document —
`registry.presentation(doc)`, `registry.copyTemplate(doc)`, `registry.showInSortWork(doc)` — each of which
dereferences `doc.kind` *internally*. Callers pass a document and never see `kind`. This is what makes the
"nothing branches on kind" rule mechanically enforceable (below) and lets a fact move between kind-lookup and
axis-derivation without touching callers.

## Layer 3 — behavior modules (by-behavior view)

Each behavior is a function of a document: `navTab(doc)`, `is4up(doc)`, `showInSortWork(doc)`,
`shouldMonitor(doc, viewer)`, … Internally each reads **axis getters** (for derivations) and/or the
**registry** (for kind-keyed facts) — and *never* branches on `kind` directly. The mechanism (derived vs
kind-looked-up) is hidden from callers:
- `navTab(doc)` → derived: reads `doc.frozen` / `doc.owner`.
- `showInSortWork(doc)` → kind-looked-up: calls `registry.showInSortWork(doc)`.

Both look identical to a caller. Behaviors that are CLUE/UI-specific live in their feature modules, not on the
model — keeping the model un-entangled (see boundary).

## The creation factory — the one `kind → axis` bridge

Creating a document is the single place `kind` is turned into axis values: the factory reads
`registry.defaults(kind)` and stamps `canonical`/`owner`/`scope`/`permissions`/`concurrent` onto the new
`DocumentModel`. Copy and publish are the same shape with different templates (`registry.copyTemplate` /
`registry.publishTemplate`) — a copy/publish is "make a new document from a template," per-axis
(findings "Deriving new documents"). After creation, the document carries its own axis values; runtime never
re-derives them from `kind`.

## The core rule — `kind` is read in exactly two places

1. Inside the **kind registry** (which resolves `doc.kind` to config).
2. Inside the **creation/derivation factory** (which maps `kind` to default axis values once).

Everywhere else — behaviors, rules, UI — reads **axes** (via getters) or calls **registry `fn(doc)`** or
**behavior `fn(doc)`**. No `doc.type === X` / `isProblem()` anywhere else. Because the registry hides `kind`
behind `fn(doc)`, this is enforceable by lint/grep: `doc.kind` / `.type` may appear only in the registry and
factory modules.

## The boundary — metadata getters on the model, behaviors outside

The test for whether something belongs on `DocumentModel`:

> **Is it data the document *has*, or a *use* of the document?**
> - *Has* → an axis getter on the model (`canonical`, `owner`, `scope`, `permissions`, `concurrent`, and general
>   derived getters like `frozen`/`isEditable`).
> - *Use* → an external `fn(doc)` in a feature/registry module (`navTab`, `showInSortWork`, `is4up`,
>   presentation, monitoring).

This is what reconciles "OO around the document" (getters for the metadata it owns) with "keep the generic
model simple" (CLUE/UI-specific behaviors stay out). The nastiest entanglers — UI-surface classifications —
are exactly the ones the boundary pushes out.

## How each thing is realized

- **Stored per-doc** (getters on `DocumentModel`; rule-readable; migrate to change): `canonical`, `owner`,
  `scope`, `concurrent`, and the **stored per-doc grants of `permissions`** — plus the `kind` tag.
- **Looked up by `kind`** (registry `fn(doc)`; no storage, no migration): presentation, creation defaults,
  copy/publish templates, `showInSortWork`, and the **shared grants of `permissions`** (via its referenced
  permission policy).
- **Composed** (getter merges stored + lookup): `permissions` (see "Permissions composition").
- **Derived** — two homes by the boundary: general document-intrinsic derivations are **getters on the
  model** (`frozen`, `isEditable`); CLUE/UI-specific derivations are external **behavior `fn(doc)`** (`navTab`,
  `is4up`, `shouldMonitor`, Student-Work membership).

## Mapping onto the existing code

- `DocumentContentModel` — the generic tile container. **No change.** Already reused standalone by
  `src/models/curriculum/*` and the doc-editor.
- `DocumentModel` — the metadata wrapper. **Gains** explicit axis getters (some over existing fields:
  `owner`←`uid`, `scope`←`context`/`offeringId`/`groupId`/`problem`/`unit`, `kind`←`type`) and new stored
  fields (`canonical`, `permissions`, `concurrent`). **Loses** its type-view methods (`isProblem`, …), which
  become axis getters + external behaviors.
- New modules: the **kind registry** (`fn(doc)` config), **behavior modules** per feature, and the
  **creation/derivation factory**.

### Caveats
1. `DocumentModel` is not purely CLUE — the standalone doc-editor uses it with minimal metadata. So the clean
   boundary is *getters vs behaviors*, not *generic model vs CLUE model*; the org-specific weight lives in the
   `scope`/`permissions`/`canonical` axes, not the whole wrapper.
2. `DocumentModel` today mixes generic metadata (`title`, `key`), org-specific fields (`groupId`, `problem`),
   and behavior (`isProblem`). The cleanup keeps metadata + axis getters and evicts behavior.

## Enforcement

- A lint rule / CI grep: `.type` / `.kind` reads are allowed **only** in the registry and factory modules.
- Behavior and rules code reference axis getters or `fn(doc)` calls exclusively.
- New security rules read stored axes (`canonical`, `owner`, `permissions`, `concurrent`) directly.

## Non-goals / out of scope (deferred)

- **Migration** of ~90 existing `type`-switches and backfill of new stored axes onto existing documents — a
  separate implementation-planning effort. This design describes the *target*, reached via the incremental
  path: stand up the registry + getters first, then migrate the `type`-branches opportunistically.
- **Enforcing `permissions` on document content** — content access is largely unenforced in the RTDB today;
  deferred. The composed-permissions tension — security rules cannot run the
  client-side registry lookup — is addressed for the shared portion by **permission policies**: the document
  stores a policy *reference*, and the security rules key their own copy of each policy's rules off that
  stored name, enforcing the kind-default portion without replicating `kind → defaults` or migrating
  documents when a policy changes. Enforcing content access in the RTDB at all remains the deferred piece.
- **Concrete field shapes / schemas** for `permissions`, `scope`, `canonical` — deferred to implementation
  planning; this document fixes only the layering and boundaries.

## Open questions

- Exact representation of `scope` (a struct of association refs) and `permissions` (grant-set shape) — to settle in
  implementation planning.
- Whether `DocumentModel` should be split further into a generic wrapper + a CLUE metadata mixin, or left as
  one model with the getters (leaning: leave as one; the getters-vs-behaviors boundary already delivers the
  clarity, and a further split risks churn for little gain).

## References

- Axis definitions: [axes.md](axes.md)
- Current-state evidence: the findings doc (research background, on the `document-type-decomposition` branch)
- Existing models: `src/models/document/document.ts` (`DocumentModel`),
  `src/models/document/document-content.ts` (`DocumentContentModel`)
