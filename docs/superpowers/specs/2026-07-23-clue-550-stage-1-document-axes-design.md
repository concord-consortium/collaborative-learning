# CLUE-550 Stage 1 — `concurrent`/`kind` Document Axes + Group-Behavior Split — Design

> **Status:** Design spec for this PR. Self-contained: it describes exactly what this PR delivers and cites
> only docs already in the repo.
>
> **Where this fits.** This is the **first concrete slice** of the long-term *document-axes* decomposition —
> replacing the single document `type` field (switched on in ~90 places) with explicit, orthogonal axes. The
> target architecture and per-axis roadmap live in [../../document-axes/README.md](../../document-axes/README.md)
> ([axes.md](../../document-axes/axes.md), [target-architecture.md](../../document-axes/target-architecture.md),
> and the axis-set decision record [2026-07-21-document-axes-register.md](2026-07-21-document-axes-register.md)).
> The eventual product goal that motivates this axis set is class-wide collaborative documents (a per-class
> Driving Question Board); those user-facing stages come later and are out of scope here (see
> [Boundaries](#boundaries-and-non-goals)). This PR is foundational and has **no user-visible change**; the
> pieces whose payoff is a later stage are justified against the roadmap below.
>
> **Builds on:**
> - **CLUE-524 scoped singleton document pointers** — the `canonical` pointer layer and
>   `getOrCreateCanonicalDocument` ([2026-07-11-scoped-singleton-document-pointers-design.md](2026-07-11-scoped-singleton-document-pointers-design.md)).
> - **Firestore metadata sourcing (CLUE-576, already merged)** —
>   [2026-07-17-firestore-metadata-as-document-source-design.md](2026-07-17-firestore-metadata-as-document-source-design.md).
>   `openDocument` resolves the Firestore `documents/<key>` doc and applies its axis fields to the live
>   `DocumentModel` (proven with `context_id` → `DocumentModel.contextId`). This PR replicates that template for
>   `concurrent` and `kind`.

## Summary — what this PR delivers

1. Two new **stored axes** on document metadata — `concurrent` (a document is multi-writer) and `kind` (a
   registry key) — added to `IDocumentMetadata`, the Sort Work `DocumentMetadataModel`, and as stored props on
   the live `DocumentModel`.
2. A small **kind registry** (`src/models/document/document-kinds.ts`): the single place that maps a `kind` to
   its creation defaults. It seeds the built-in `group` kind as `{ concurrent: true }`.
3. **Sourcing + stamping:** `openDocument` applies `concurrent`/`kind` onto the model from the Firestore doc;
   document creation stamps `concurrent: true, kind: "group"` onto a group document's Firestore metadata.
4. **Group-document behaviors split by axis** — the two *concurrency* behaviors read the stored `concurrent`;
   the two *permission* behaviors stay keyed on the group `type`. (Rationale below.)
5. **Backfill** of `concurrent` onto pre-existing group documents — an on-open write-back plus a one-shot batch
   script — so the history manager runs in concurrent mode for documents created before this field existed.

The stored `type` value is unchanged: group documents keep `type === "group"`. No document is retyped, and no
`type`-switch site outside the ones listed here is touched.

## The two stored axes

Both axes are taken directly from the document-axes register; this PR is where the first two land.

- **`concurrent`** (`boolean`) — marks a document as multi-writer: it uses the Concurrent history manager and is
  editable by non-owners. Per the register it is a **stored** per-doc axis (concurrent documents carry special
  stored state — concurrent history, a canonical pointer — so the flag makes that association explicit and is
  readable by Firestore security rules). It is stored on the Firestore metadata and applied to the live
  `DocumentModel` as a stored prop at open, so client behaviors read `document.concurrent` **from storage**
  rather than deriving it.

- **`kind`** (`string`) — the registry key that later stages use for presentation (title, icon, title-bar).
  **Nothing reads `kind` on the client path in this PR** — only creation stamps it and the registry keys on it.
  It is introduced now, as a stored field on every document, because it is the foundation of the
  `kind → config` registry the document-axes architecture targets
  ([target-architecture.md](../../document-axes/target-architecture.md), "Layer 2 — the kind registry"): storing
  it now means existing documents already carry the key when presentation is wired up, with no later backfill of
  `kind` itself. Its standalone justification is the roadmap, not a behavior in this PR.

Both use the `| null` / `types.maybeNull` shape so the `DocumentMetadataModel`↔`IDocumentMetadata` compile-time
parity check holds. `concurrent` lives on `IDocumentMetadata` (not the narrower `IDocumentMetadataBase`), since
no base-typed consumer reads it.

## The kind registry

`src/models/document/document-kinds.ts` — `registerDocumentKind(info)` / `getDocumentKindInfo(kind)` over an
in-memory map, seeding the built-in `group` kind as `{ concurrent: true }`. It is the **source of truth for
which kinds are concurrent**, consulted at exactly two points: document **creation** (what axis values to
stamp) and the **on-open backfill** (below). It is deliberately *not* on the steady-state client read path —
live behavior reads the stored `concurrent`, not the registry.

## Sourcing and stamping

- **Stamping (creation):** `createFirestoreMetadataDocument` (`src/lib/db.ts`) looks up the document's type in
  the registry and, for a registered concurrent kind (group today), writes `kind` and `concurrent: true` into
  the Firestore metadata. Only defined fields are added, so Firestore `set` never receives `undefined`
  (mirroring the existing `groupInfo` pattern).
- **Sourcing (open):** `openDocument` applies `concurrent`/`kind` from the resolved Firestore metadata onto the
  `DocumentModel` at both `createDocumentModel` sites, alongside the prerequisite's `contextId` — the same
  `context_id → contextId` template.

## Group-document behaviors, split by axis

Four behaviors previously keyed on `type === GroupDocument` / `isGroup`. They split cleanly into two axes, and
each behavior moves to the axis it actually belongs to:

### Concurrency machinery → the `concurrent` axis

- **Concurrent history-manager selection** (`src/models/stores/documents.ts`) reads `document.concurrent` to
  choose the Concurrent vs. single-writer history manager.
- **Non-owner write-sync warning** (`src/hooks/use-document-sync-to-firebase.ts`) gates on `!document.concurrent`.

These are genuinely about multi-writer semantics, so they read the stored `concurrent` flag. This is what makes
a future concurrent document that is *not* type `group` (a DQB, a Word Wall — later stages) get concurrent
behavior with no new `type`.

### Permissions → the group `type`

- **Class-wide read access** — `isDocumentAccessibleToUser` (`src/models/document/document-utils.ts`) grants
  every class member read of a `type === GroupDocument` document.
- **Non-canonical delete** — the Firestore rule (`firestore.rules`) lets a class member delete a non-canonical
  `type == "group"` document.

These are **permissions**, and in the target architecture permissions are selected by a document's **kind**
(via a permission policy assigned at creation), not by the concurrency axis
([target-architecture.md](../../document-axes/target-architecture.md), "Permissions composition"). This PR does
not yet build the permissions axis, so the interim, correct keying is the document's stored `type`/kind, which
every group document already carries. Two concrete reasons this is the right interim choice — not merely
expedient:

- **No data migration for read/delete.** Pre-existing group documents already have `type === "group"`, so they
  keep class-wide read access and stay deletable with nothing to backfill.
- **Orphan deletability.** The non-canonical delete rule exists to let a class member clean up the *losing*
  documents of the CLUE-524 canonical-pointer creation race. Those losers are orphans **nobody ever opens** — so
  a key that depends on any created-at-open or opened-at-least-once state (like a backfilled `concurrent`) could
  never reach them, leaving them permanently undeletable. Keyed on `type`, they are always deletable.

When the permissions axis lands (a later stage, on the same generic type), read and delete move onto it.

## Backfilling `concurrent` on pre-existing group documents

`concurrent` is stamped only at creation, so a group document created before this field existed has no stored
`concurrent`. Because read/delete are keyed on `type`, the only behavior that needs `concurrent` on such a
document is the **history manager** — and only for documents that are actually collaborated on, which are
exactly the ones that get opened. Two backfills converge the stored field:

- **On open (transitional).** In `openDocument`, when the kind registry says the document's kind is concurrent
  but its stored metadata lacks `concurrent`, the value is derived from the registry so the opened model runs
  the concurrent history manager immediately, and a best-effort `{ concurrent: true, kind }` **merge write-back**
  is issued to the document's Firestore metadata. The write-back is idempotent (only fires when the stored value
  is absent), fire-and-forget (never blocks or fails the open), and permitted by the existing rules for a class
  member (it touches only non-read-only fields and leaves `canonical` unchanged — no rules change needed). This
  is transitional migration code: it is clearly commented as such and is slated for removal a release after the
  batch script has run (see below), restoring the pure "read `concurrent` from storage" path.

- **One-shot batch script.** `migrations/backfill-group-concurrent.js` sweeps all `type == "group"` documents
  and stamps `{ concurrent: true, kind: "group" }` onto any lacking `concurrent`, covering the never-opened tail
  (including orphan race-losers). It is **dry-run by default** (`APPLY=1` to write) — the dry run doubles as a
  per-project count — idempotent, and batched. It uses a collection-group query on `documents`, backed by a
  single-field index added to `firestore.indexes.json`. It is run manually against staging then production after
  this ships; it is not run as part of the PR.

## Boundaries and non-goals

Deferred to later stages of the document-axes work; see the roadmap
([../../document-axes/README.md](../../document-axes/README.md)) for where each lands:

- **The class-wide DQB / Word Wall and any new document kind.** No new type is introduced; no class-wide
  document is created or shown. This PR only introduces the axes and rebases the group behaviors.
- **Presentation driven by `kind`** (title, icon, title-bar) — later; `kind` is stored but not read on the
  client path here.
- **The `permissions` axis** (a composed, policy-based grant set). Read/delete are interim-keyed on `type` until
  it exists.
- **Scope modeling.** Scope is left in the existing metadata fields; no `scope` struct or `scopeLevel` enum.
- **Retiring the legacy type.** The flip of the stored `type` to `"generic"` and removal of `GroupDocument` /
  `isGroup` is the closing cleanup of a later stage, once every `type`-switch site reads axes. No data migration
  of the `type` value; group documents are unreleased.

## Testing

- Unit (Jest, mocked Firebase): the metadata fields and the parity check; the kind registry; the `DocumentModel`
  stored props + `metadata` getter; `openDocument` axis sourcing; the on-open backfill (fires for a group doc
  missing `concurrent`; does not fire when already `concurrent`, nor for a non-concurrent kind); type-based
  read access (a group doc with or without `concurrent` is accessible); creation stamping; and the batch
  script's core (dry-run / apply / idempotent, against a mock Firestore).
- Rules (emulator): a class member may delete a non-canonical `type == "group"` document (regardless of
  `concurrent`), may not delete a canonical one, and an out-of-class user may not delete.
- Full `npm test`, `npm run check:types`, `npm run lint:build`, and the `firebase-test` rules suite green.

## Follow-up

- After the batch script has run on staging and production, remove the transitional on-open derive + write-back
  in `openDocument`, restoring the pure stored-field read path.

## References

- Document-axes roadmap and architecture: [../../document-axes/README.md](../../document-axes/README.md),
  [axes.md](../../document-axes/axes.md), [target-architecture.md](../../document-axes/target-architecture.md),
  [2026-07-21-document-axes-register.md](2026-07-21-document-axes-register.md).
- Firestore metadata sourcing prerequisite: [2026-07-17-firestore-metadata-as-document-source-design.md](2026-07-17-firestore-metadata-as-document-source-design.md).
- CLUE-524 canonical pointers: [2026-07-11-scoped-singleton-document-pointers-design.md](2026-07-11-scoped-singleton-document-pointers-design.md).
- Key code sites: `src/models/document/document-kinds.ts`, `src/lib/db.ts`,
  `src/models/document/document.ts`, `src/models/document/document-utils.ts`,
  `src/models/stores/documents.ts`, `src/hooks/use-document-sync-to-firebase.ts`, `firestore.rules`,
  `migrations/backfill-group-concurrent.js`.
