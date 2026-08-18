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
`kind → axis` mapping defined in exactly one place (the registry), applied only when a document is
created or migrated.

## Architecture overview — three layers

```
  DocumentContentModel      generic tile container (content, tiles, shared models)
        ▲                   — already exists; already reused standalone (curriculum, doc-editor)
        │ content
  DocumentModel             the metadata wrapper + AXIS GETTERS (by-axis view)
        │                   — canonical, owner, scope, permissions, concurrent, kind
        │
   ┌────┴───────────────┬────────────────────────┬─────────────────────────┐
   │                    │                        │                         │
 Kind registry     Behavior modules        Creation factory          Migrations
 (by-kind view)    (by-behavior view)      (kind→axis, new docs)     (kind→axis, existing docs)
 fn(doc)→config    fn(doc)→result          reads registry defaults,  kind = cohort key;
 kind read here    read getters/registry   stamps axes on a new doc  same registry defaults
                   never branch on kind
```

## Layer 1 — `DocumentModel`: axis getters (metadata)

`DocumentModel` (the existing metadata wrapper) exposes the **stored axes as getters**. This is the by-axis
view, and it is legitimate to put here because these are *data the document has*, not a *use* of the document
(see "The boundary" below).

| axis | getter source |
|---|---|
| `owner` | existing `uid` (identity/provenance; may differ from scope for publications) |
| `scope` | the individual association fields `context` / `offeringId` / `groupId` / `problem` / `unit` (the org + curriculum associations). Consumed via field/axis **guards** (see "Typed document shapes"), not by branching on `type`; whether to also expose a single unified `scope` getter is an open question — the fields may be read directly |
| `kind` | existing `type` (a stored tag — see Layer 2 for its uses) |
| `canonical` | new stored field holding the label of the pointer slot this document fills — not a flag; several documents can be canonical in one container, one per label |
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

## The creation factory — the `kind → axis` bridge for new documents

Creating a document is where `kind` is turned into axis values for a *new* document: the factory reads
`registry.defaults(kind)` and stamps `canonical`/`owner`/`scope`/`permissions`/`concurrent` onto the new
`DocumentModel`. Copy and publish are the same shape with different templates (`registry.copyTemplate` /
`registry.publishTemplate`) — a copy/publish is "make a new document from a template," per-axis
(findings "Deriving new documents"). After creation, the document carries its own axis values; runtime
behavior never re-derives them from `kind` — only a migration restamps them (next section).

## The core rule — `kind` is read in exactly three places

1. Inside the **kind registry** (which resolves `doc.kind` to config).
2. Inside the **creation/derivation factory** (which maps `kind` to default axis values once).
3. Inside **migration code** (which uses `kind` as the *cohort key*: "find every document of kind X and
   stamp/update axis Y" — see below).

Everywhere else — behaviors, rules, UI — reads **axes** (via getters) or calls **registry `fn(doc)`** or
**behavior `fn(doc)`**. No `doc.type === X` / `isProblem()` anywhere else. Because the registry hides `kind`
behind `fn(doc)`, this is enforceable by lint/grep: `doc.kind` / `.type` may appear only in the registry,
factory, and migration modules.

## Migrations — `kind` as the cohort key

Existing documents do not have the new stored axes, so each stored axis has to be stamped onto the documents
that predate it. `kind` is what makes that possible: it is the handle for *finding* the documents that should
get a given value. This is the third reader of `kind`, and it is **not only transitional** — it stays after
the decomposition is complete, because once behavior is per-document data, changing a kind's intended
settings means migrating that kind's existing documents rather than changing one branch in code. That is the
tradeoff the decomposition accepts, and a stored `kind` is what keeps the migration tractable — without it the
cohort would be unfindable.

Migrations take a few forms, all deriving their values from the **same registry defaults** the creation factory
uses — so a kind's defaults are still written down once:

- **At runtime in the client** — when a document is loaded, CLUE notices a missing axis value and stamps it
  from the kind's defaults (the lazy-backfill pattern already used for scoped pointer slots). Cheapest: no
  infrastructure and no downtime. But it only reaches documents someone actually opens, **and only works for
  axes a client is allowed to write.**
- **At runtime in a Cloud Function** — the same lazy, on-demand stamping, done in a trusted context. This is
  what an axis needs when a client must not be able to set it.
- **As admin scripts sweeping all the Firestore document metadata** — applies the cohort rule to every document
  whether or not it is ever opened. Needed when security rules or queries must be able to assume the axis is
  present on *every* document, and for cohort-wide changes to an already-migrated axis.

**Which axes a client may stamp is a security question, not a convenience one.** Several axes are stored
precisely so the security rules can enforce them (`permissions`, `canonical`, `concurrent`); for those, a
client-writable backfill would let a client hand itself the value the rules are meant to police. So the rules
stay tight and the stamping moves to a Cloud Function or an admin script. Client-side backfill is available
only where the write would be legitimate coming from that user anyway.

A migration also has to decide what to do with documents whose value was legitimately customized away from the
old default — overwrite the cohort, or only fill in what is missing. That choice is per-migration policy, not
something the architecture fixes.

Axes that are **not** stored need none of this: presentation, creation defaults, copy/publish templates, and a
permission policy's rules all live in code, so changing them changes every document at once with no migration
(see "How each thing is realized").

### Which documents get stamped — a gate that narrows as types are converted

Every `type` is registered as a kind, so the registry can answer `kind → axis fields` for any document. Writing
those fields into stored metadata is deliberately narrower: both stamp sites — creation
(`createFirestoreMetadataDocument`) and the client-side lazy backfill when a document is opened (`db.ts`) —
write the kind axis fields only for the types converted so far, which today means `type: "group"` (regular group
documents and class-wide documents, which share that transitional type).

The gate is a stage in the progression, not a permanent rule:

- A type is **converted** once its `kind` is settled and its behavior is read from axes rather than from `type`
  — at which point `type` is just the generic tag. The publication kinds are the clearest not-yet-settled case:
  they may be folded into the kinds they publish, and a `kind` stamped before that decision is a value we would
  have to migrate afterwards.
- As each type is converted, **add it to the gate at both stamp sites**, so its documents begin carrying their
  kind's axis fields.
- Once every type has been converted the gate always passes, so it can be deleted and both sites stamp
  unconditionally.

Nothing is lost while a type waits: an unconverted document's axis values are still derived from the registry at
runtime, they are simply not persisted onto that document yet.

Widening the gate is not always enough by itself. The open-time backfill writes as the signed-in user, so it can
only ever stamp values a client is allowed to write — and per "Which axes a client may stamp is a security
question" above, an axis the rules *police* must not stay client-writable, since a client could then hand itself
the value. A converted type whose axis feeds a rule therefore needs its stamp to come from creation, a Cloud
Function, or an admin script rather than from the client-side backfill, and its rule tightened to reject
after-the-fact changes. No stamp has had to move for this reason yet, but `concurrent` is the obvious candidate:
it is stored so that rules *can* enforce it, so once a rule reads it, letting a client set it after creation
would hand the client the value the rule is meant to police — the client-side backfill then has to be replaced
by an admin sweep and the rule tightened to creation-only.

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

- **Stored per-doc** (rule-readable; migrate to change): `canonical`, `owner`, `concurrent`, the **scope**
  association fields, the **permission-policy reference** and the **stored per-doc grants** of `permissions` —
  plus the `kind` tag. `owner` and `concurrent` are exposed as getters on `DocumentModel`; the scope fields are
  read directly / via field guards (see "Typed document shapes"), not necessarily behind a single `scope`
  getter.
- **Looked up by `kind`** (registry `fn(doc)`; no storage, no migration): presentation, creation defaults
  (including *which* permission policy a new document references), copy/publish templates, `showInSortWork`.
- **Looked up by policy name** (code-defined policy table, resolvable by both the runtime and
  `firestore.rules`): the **shared grants of `permissions`**. Changing a policy's rules needs no migration;
  changing which policy a document references does.
- **Composed** (getter merges stored + lookup): `permissions` (see "Permissions composition").
- **Derived** — two homes by the boundary: general document-intrinsic derivations are **getters on the
  model** (`frozen`, `isEditable`); CLUE/UI-specific derivations are external **behavior `fn(doc)`** (`navTab`,
  `is4up`, `shouldMonitor`, Student-Work membership).

## Mapping onto the existing code

- `DocumentContentModel` — the generic tile container. **No change.** Already reused standalone by
  `src/models/curriculum/*` and the doc-editor.
- `DocumentModel` — the metadata wrapper. **Gains** explicit axis getters over existing fields
  (`owner`←`uid`, `kind`←`type`) and new stored fields (`canonical`, `permissions`, `concurrent`). The **scope**
  association fields (`context`/`offeringId`/`groupId`/`problem`/`unit`) are consumed via field guards (see
  "Typed document shapes") rather than necessarily a single `scope` getter. **Loses** its type-view methods
  (`isProblem`, …), which become axis getters + external behaviors.
- New modules: the **kind registry** (`fn(doc)` config), **behavior modules** per feature, the
  **creation/derivation factory**, and **migration code** (client or Cloud Function backfill, plus metadata
  sweep scripts).

### Caveats
1. `DocumentModel` is not purely CLUE — the standalone doc-editor uses it with minimal metadata. So the clean
   boundary is *getters vs behaviors*, not *generic model vs CLUE model*; the org-specific weight lives in the
   `scope`/`permissions`/`canonical` axes, not the whole wrapper.
2. `DocumentModel` today mixes generic metadata (`title`, `key`), org-specific fields (`groupId`, `problem`),
   and behavior (`isProblem`). The cleanup keeps metadata + axis getters and evicts behavior.

## Typed document shapes — requirement types + guards, not kind-discriminated shapes

The persisted metadata types — `DBDocumentMetadata` in `src/lib/db-types.ts`, and the parallel
`isProblem`/`isGroup` type-view methods on `DocumentModel` — are today a **discriminated union keyed on
`type`**: a consumer narrows on `type === "problem"` to reach the fields that co-occur with it (`offeringId`,
`problem`, `unit`). That is the same "branch on kind" pattern this refactor removes, expressed in the type
system rather than in control flow. When `type` becomes just the `kind` tag (read only in the registry and
factory), the discriminant is gone and these per-kind interfaces have nothing to switch on.

**Target — declare what a consumer needs, then guard for it.** The kind-discriminated interfaces dissolve.
Stored metadata is one generic base (`DBBaseDocumentMetadata`) carrying the axis fields (`owner`/`uid`, the
`scope` association fields, `canonical`, `concurrent`, `kind`), with the org-specific ones optional. Code that
needs particular fields does **not** ask "is this kind X"; it declares a **structural requirement type** for
the fields it uses and narrows with a **type guard** — the type-system form of "read an axis, not the kind":

- a requirement type names the fields a consumer needs, e.g.
  `type OfferingScoped = DBBaseDocumentMetadata & { offeringId: string; unit: string }`;
- a guard verifies a document satisfies it, e.g. `hasOfferingScope(doc): doc is OfferingScoped`, testing the
  *scope fields*, never `type`;
- consumers accept the requirement type and call the guard, so a function that needs an offering works for
  **any** document in an offering scope, whatever its kind.

These guards are the typed siblings of the axis getters / registry `fn(doc)`: a guard like `hasOfferingScope`
is `doc.scope`-shaped and lives with the axis layer, not scattered per feature. `.type`/`.kind` still appear
only in the registry, factory, and migration modules (the core rule); a guard that tests `offeringId` is an
axis-field check, not a kind check, so it is allowed everywhere.

**Already visible in the code.** Group and class-wide documents both store `type: "group"` yet have different
scope shapes (group: `offeringId` + `groupId`; class-wide: `unit`, no offering/group). Those scope fields live
in the Firestore `IDocumentMetadata`, stamped from the kind's registered scope — not from `type` — so a single
`type: "group"` covers two shapes and only a guard on the scope fields tells them apart. (The RTDB
`DBGroupDocMetadata` is now a single bare `type: "group"` shape shared by both, precisely because `type` can no
longer carry the distinction.) This transitional shared `type: "group"` is the first concrete case motivating
the guard approach ahead of `type` removal.

**Deferred:** the concrete requirement-type set and guard inventory land with the field-shape work already
deferred under Non-goals (the `scope`/`permissions`/`canonical` schemas). This section fixes the *approach*
(requirement types + guards), not the exact types.

## Enforcement

- A lint rule / CI grep: `.type` / `.kind` reads are allowed **only** in the registry, factory, and migration
  modules.
- Behavior and rules code reference axis getters or `fn(doc)` calls exclusively.
- Consumers narrow document shapes with field/axis **type guards** (e.g. `hasOfferingScope`), never by `type`;
  a guard tests axis fields, so it is not a `.type`/`.kind` read.
- New security rules read stored axes (`canonical`, `owner`, `permissions`, `concurrent`) directly.

## Non-goals / out of scope (deferred)

- **The per-axis migration plans** — which documents get backfilled when, and the conversion of the ~90
  existing `type`-switches — are a separate implementation-planning effort ("Migrations" above fixes only the
  mechanism and `kind`'s role in it). This design describes the *target*, reached via the incremental path:
  stand up the registry + getters first, then migrate the `type`-branches opportunistically.
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
- What `kind` a publish template targets: its source's kind, or a publication kind of its own. Copying settles
  the same question by naming a kind outright (axes.md, "Copies and publications, read as deltas"), but
  publishing holds `owner`, `container`, and `curriculum` still and moves only `canonical` and `permissions`
  — all stated on the axes — so a second kind buys nothing unless some per-kind fact about a publication is
  not determined by its axes. Today's four publication types are not evidence either way; that is `type`
  doing every job at once. (Leaning: keep the source's kind. The cost is that a nav-tab section selects
  documents by a list of type names, so the authored `navTabs` configs — in this repo and in
  `clue-curriculum` — would have to select on axes instead.)

## References

- Axis definitions: [axes.md](axes.md)
- Current-state evidence: the findings doc (research background, on the `document-type-decomposition` branch)
- Existing models: `src/models/document/document.ts` (`DocumentModel`),
  `src/models/document/document-content.ts` (`DocumentContentModel`)
