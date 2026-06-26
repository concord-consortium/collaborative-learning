# CLUE-554 — Shared personal-doc / learning-log thumbnails: findings

Investigation notes for making personal-document and learning-log thumbnails
**appear reactively when a document is shared**. Companion to the already-shipped
work that keeps such thumbnails' **content** up to date with remote changes
(see `DBDocumentsContentListener`, which now monitors `PersonalDocument` and
`LearningLogDocument` content for all loaded docs except the one open for editing).

**Current focus (per product decision):** peers (students) seeing each other's
shared work, in the **Sort Work view only**. Nav-tab views (My Work / Class Work)
are documented here as future scope but are out of scope for now.

Date: 2026-06-25.

## TL;DR — the sort-view + peer gap

When a peer shares a personal doc / learning log, the sort-view thumbnail does
**not** flip from private to visible without a refresh. Root cause:

- The sort-view thumbnail computes `isPrivate` from the **in-memory full
  `DocumentModel`** (`document.isAccessibleToUser` → `document.visibility`),
  [thumbnail-document-item.tsx:104](../src/components/thumbnail/thumbnail-document-item.tsx#L104).
- **Nothing updates a *peer's* in-memory `DocumentModel.visibility` when they
  share.** `setVisibility` is only called for the viewer's own other-docs
  ([db-other-docs-listener.ts:110](../src/lib/db-listeners/db-other-docs-listener.ts#L110))
  and problem docs. The reactive source that *does* update on a share is the
  Firestore metadata (`metadataDocsFiltered`), but that's a separate
  `DocumentMetadataModel`, not the full `DocumentModel` the thumbnail reads.

So: the list/metadata is reactive, but the thumbnail's private/visible state is
driven by a stale field.

## How "sharing" works

- Sharing = a `visibility` flip (`private` ↔ `public`); identical for personal
  docs and learning logs. `ShareButton` → `toggleVisibility`
  ([document.tsx:590-594](../src/components/document/document.tsx#L590-L594),
  [document.ts:223-230](../src/models/document/document.ts#L223-L230)).
- On flip, the sharer's client writes to two places
  ([use-document-sync-to-firebase.ts:146-159](../src/hooks/use-document-sync-to-firebase.ts#L146-L159)):
  - **RTDB** at the `documentMetadata/<key>` path (NOT the `personalDocs/<key>` /
    `learningLogs/<key>` path).
  - **Firestore** `documents` metadata, via `updateFirestoreDocumentProp`
    ([use-document-sync-to-firebase.ts:114-129](../src/hooks/use-document-sync-to-firebase.ts#L114-L129)).
- For the sharer's **own** doc, `toggleVisibility()` mutates the in-memory model
  directly, so it's locally reactive regardless of Firebase.

## How the sort view discovers / displays docs

- The list comes from a Firestore `onSnapshot` over the `documents` collection,
  filtered by `context_id` (class), plus a separate `unit == null` query that
  exists specifically to catch personal docs / learning logs
  ([sorted-documents.ts:152-200](../src/models/stores/sorted-documents.ts#L152-L200)).
  This listener **is reactive** and fires on visibility changes.
- `filteredDocsByType` filters only by `isSortableType` — **no visibility
  filter** ([sorted-documents.ts:78-82](../src/models/stores/sorted-documents.ts#L78-L82)).
  So peers' private docs are in the list; they're gated at render.
- Rendering: ungrouped → `DecoratedDocumentThumbnailItem` → `ThumbnailDocumentItem`
  (renders live canvas content); grouped → `SimpleDocumentItem`. Both compute a
  private/accessible flag from the **full doc's** visibility.
- The full doc is loaded on demand by `getDocument` →
  `sortedDocuments.fetchFullDocument` → `db.openDocument` (one-shot `.once()`
  read), then cached in `documents.all` (no eviction).

## Permissions (both allow peers to read; visibility is client-side only)

- **Firestore** metadata: any class member can read any class doc's metadata —
  `resourceInUserClass()`, no visibility check
  ([firestore.rules:352-353](../firestore.rules#L352-L353)).
- **RTDB** content: any class member can read any class user's documents —
  `auth.class_hash == $class_hash`, no visibility check
  ([database.rules.json](../database.rules.json)).
- Implication: visibility is purely a client-side display concern. A peer is
  technically allowed to read both metadata and content of a private doc; the UI
  just hides it. (Relevant: a fix can rely on client state without new rules.)

## What's already reactive vs. the gap (sort view + peers)

Reactive today:
1. The metadata list (Firestore `onSnapshot`) updates on a visibility flip.
2. Components are observers, so they re-render when their observed state changes.

The gap:
3. The thumbnail's private/visible decision reads `document.visibility` on the
   **full in-memory `DocumentModel`**, which is loaded once via `.once()` and is
   **never updated for a peer's doc** when that peer shares. So the flip isn't
   observed where it matters.

## Fix direction (sort view + peers)

Propagate the already-reactive Firestore metadata visibility into the in-memory
`DocumentModel`. Preferred approach:

- **Option A (recommended):** In `SortedDocuments`, add a MobX `reaction`/autorun
  that watches `metadataDocsFiltered` and, for each metadata doc whose matching
  full doc is in `documents.all`, calls `documentModel.setVisibility(...)` (and
  `setTitle`) when they differ. This reuses the reactive Firestore source and the
  existing `setVisibility` action; the thumbnail then flips automatically.
  - Verify it also handles the doc not-yet-loaded case (thumbnail shows private
    placeholder until `fetchFullDocument` loads it, then the reaction keeps it in
    sync).
- **Option B:** Make the sort-view thumbnail derive private/visible from the
  reactive metadata model rather than the full doc. More invasive —
  `ThumbnailDocumentItem` is shared across many surfaces.
- **Option C (rejected for now):** Per-peer-doc RTDB listeners on the
  `documentMetadata` path. Heavier (per-doc listeners) and redundant with the
  Firestore source.

Open items to confirm during implementation:
- Whether private peer docs should be hidden entirely vs. shown as a private
  placeholder that becomes a thumbnail on share (current behavior is the latter).
- Whether `fetchFullDocument` is invoked for not-yet-accessible docs (it appears
  unconditional via `getDocument`); confirm no wasted loads / no regressions.

## Future scope — nav tabs (My Work / Class Work)

Not needed now, but captured so we can expand quickly. Nav-tab lists render from
the in-memory `documents.all` populated by RTDB listeners, where discovery gaps
exist:

- **Learning logs have no other-user discovery listener.**
  `DBStudentPersonalDocsListener` is `PersonalDocument`-only
  ([index.ts:53](../src/lib/db-listeners/index.ts#L53)). A peer's shared learning
  log is never pulled into `documents.all` for nav-tab views.
- **`DBStudentPersonalDocsListener` handles only `child_added`**
  ([db-student-personal-docs-listener.ts:41](../src/lib/db-listeners/db-student-personal-docs-listener.ts#L41))
  — no `child_changed`/`child_removed`. Even if it watched visibility, the flip
  is written to `documentMetadata`, not the `personalDocs` path it listens on, so
  it wouldn't see shares anyway.
- Likely nav-tab fix: a generalized "other users' other-docs" discovery that
  (a) covers learning logs, and (b) syncs visibility/title from a reactive source
  (Firestore metadata, same as Option A) into `documents.all`.

## Key files

- [src/components/thumbnail/thumbnail-document-item.tsx](../src/components/thumbnail/thumbnail-document-item.tsx) — `isPrivate` from full doc (the gap)
- [src/models/stores/sorted-documents.ts](../src/models/stores/sorted-documents.ts) — Firestore metadata listener (reactive source) + `filteredDocsByType`
- [src/components/document/sorted-section.tsx](../src/components/document/sorted-section.tsx) — `getDocument`/`fetchFullDocument`, renders thumbnails
- [src/hooks/use-document-sync-to-firebase.ts](../src/hooks/use-document-sync-to-firebase.ts) — where a share is written (RTDB documentMetadata + Firestore)
- [src/lib/db-listeners/db-other-docs-listener.ts](../src/lib/db-listeners/db-other-docs-listener.ts) — own-doc visibility/title sync (`setVisibility`)
- [src/lib/db-listeners/db-student-personal-docs-listener.ts](../src/lib/db-listeners/db-student-personal-docs-listener.ts) — teacher/peer personal-doc discovery (child_added only)
- [src/lib/db-listeners/db-docs-content-listener.ts](../src/lib/db-listeners/db-docs-content-listener.ts) — the shipped content-reactivity work
- [firestore.rules](../firestore.rules) / [database.rules.json](../database.rules.json) — reads gated by class, not visibility
