# CLUE-587 — Personal documents do not open immediately after being created

## Problem

Creating a new Personal document succeeds (the RTDB doc and Firestore metadata are written)
but the document does not open immediately. It appears/opens fine on a later load. This is a
regression from 7.2.0 → 7.3.0.

## Root cause (confirmed)

Introduced by CLUE-576 (PR #2919). Before CLUE-576, `openDocument` built the model from RTDB
data alone. CLUE-576 made `openDocument` also require the Firestore metadata and reject if it is
absent:

- [`openDocument`](../../../src/lib/db.ts) fetches metadata via
  `documentMetadata.fetchMetadata(documentKey)` unless the caller passes `firestoreMetadata`.
- [`createOtherDocument`](../../../src/lib/db.ts) (personal / learning-log creation) reaches
  `openDocument` indirectly: it writes the personal-docs RTDB entry, which fires
  `db-other-docs-listener.handleDocumentAdded` → `createDocumentModelFromOtherDocument` →
  `openDocument` **without** the `firestoreMetadata` it just created.
- So `openDocument` re-derives metadata via
  [`pointReadMetadata`](../../../src/models/stores/document-metadata-store.ts), which is a
  **Firestore collection query** (`where context_id == classHash and key == <key>`). A query's
  index is eventually consistent, so immediately after creation it can return empty →
  `fetchMetadata` throws → `openDocument` rejects.
- The listener's `.then(...)` never runs and has no `.catch`, so the promise
  `createOtherDocument` awaits never resolves — the document is created but never opens, and the
  rejection surfaces to Rollbar.

The group-document path avoids this because it calls `openDocumentFromFirestoreMetadata`, which
passes the just-created metadata straight into `openDocument`.

## Decision

Replace the eventually-consistent **collection query** in the metadata point read with a
**strongly-consistent get-by-id**, keeping the class scoping the query enforced.

This fixes the root cause for **every** open path (not just creation), adds no caching state, and
is a small, contained change suitable to merge ahead of the in-flight CLUE-550 branches.

### Why get-by-id is safe here

The metadata doc lives at `documents/{escapeKey(key)}`:

- Every current writer uses that id: the client
  [`createFirestoreMetadataDocument`](../../../src/lib/db.ts) (via `getSimpleDocumentPath`) and
  the `createFirestoreMetadataDocument_v2` cloud function (`escapeKey(document.key)`).
- The Sep 2025 migration consolidated all historical prefixed docs (`[network]_[key]`,
  `uid:[user]_[key]`) into the unprefixed `escapeKey(key)` doc and deleted the prefixed ones
  ([firestore-migration.md](../../document-metadata/firestore-migration.md)). The v1 comment
  functions that created prefixed docs have been removed.
- Existing code already relies on this id for a just-created doc: the group-doc canonical path
  does `txn.update(firestore.doc(getSimpleDocumentPath(documentKey)), …)`.

A get-by-id is strongly consistent immediately after the awaited write, unlike the query.

The Firestore security rules permit the get: `documents/{docId}` allows read when the caller owns
the doc or the doc's `context_id` matches the caller's class (plus teacher-network branches); the
demo/qa/test spaces are broadly readable.

### Preserving class scoping

CLUE-576's query scoped every read by `context_id == classHash` — both for the security rules and
to exclude the ~13 legacy conflicting-`context_id` cases. The get-by-id keeps this by validating
in code: after reading and validating the doc, reject when `context_id !== user.classHash`
(same outcome the empty query produced). This keeps behavior identical to today — including for
exemplar and other-class docs, which the class-scoped query already excluded — rather than
widening access to the rules' teacher-network branches.

## Change

Single change point: `pointReadMetadata` in
[document-metadata-store.ts](../../../src/models/stores/document-metadata-store.ts).

- Read `firestore.collection("documents").withConverter(converter).doc(escapeKey(key)).get()`
  instead of the `where(...).where(...).limit(2)` query.
- Throw (as today) when the doc does not exist or fails `metadataFromFirestoreData` validation;
  error messages describe the doc path read.
- Add the `context_id === classHash` guard; throw with a descriptive message on mismatch.
- Drop the `limit(2)` duplicate-detection `console.error` (a get returns one doc).
- Keep `fetchMetadata`'s in-flight coalescing (`inFlightPointReads`) unchanged — still useful to
  coalesce concurrent reads of the same key.
- Add `escapeKey` to the existing `shared/shared` import.

Depends on `IDocumentMetadata`/`DocumentMetadataModel` exposing `context_id` (already read by
`openDocument`); verify during implementation.

## Explicitly out of scope

To keep the merge minimal ahead of CLUE-550:

- The missing `.catch` in `handleDocumentAdded`.
- The "one required-document promise per type" FIXME for concurrent personal-doc creates.

## Testing

- **document-metadata-store.test.ts**
  - `fetchMetadata` returns the metadata via a get-by-id at `documents/{escapeKey(key)}`.
  - Throws when the doc does not exist.
  - Throws when `context_id` does not match the user's `classHash`.
  - Throws when the doc fails validation.
  - Concurrent `fetchMetadata` calls for the same key still coalesce to one get.
- **db.test.ts (regression)**
  - A personal-document create resolves/opens even though a metadata *query* would have lagged —
    i.e. the create→listener→`openDocument` path now succeeds via the strongly-consistent get.
