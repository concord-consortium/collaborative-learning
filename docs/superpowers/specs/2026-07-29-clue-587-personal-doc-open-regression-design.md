# CLUE-587 — Personal documents do not open immediately after being created

## Problem

When a user creates a new Personal document it is created successfully (the RTDB doc and Firestore
metadata are written) but the workspace does not switch to it; it appears/opens only on a later
load. Regression from 7.2.0 → 7.3.0. In practice it presents as: **the first Personal document
created after a page reload does not open; later ones do.**

## Investigation arc

There are **two** distinct problems on this creation path. The first was found by inspection and
fixed first; it turned out to be necessary but **not sufficient**. The second — the actual cause of
the user-visible symptom — was found by reproducing the bug live (the fix was deployed to a branch
preview and the symptom persisted) and instrumenting the running app.

## Root cause 1 — metadata read races Firestore query consistency (necessary, not sufficient)

Introduced by CLUE-576 (PR #2919). Before CLUE-576, `openDocument` built the model from RTDB data
alone. CLUE-576 made `openDocument` also require the Firestore metadata and reject if it is absent:

- [`openDocument`](../../../src/lib/db.ts) fetches metadata via
  `documentMetadata.fetchMetadata(documentKey)` unless the caller passes `firestoreMetadata`.
- The personal/learning-log creation path reaches `openDocument` through the `db-other-docs`
  listener, which does not pass the metadata that was just created, so `openDocument` re-derives it
  via [`pointReadMetadata`](../../../src/models/stores/document-metadata-store.ts) — a **Firestore
  collection query** (`where context_id == classHash and key == <key>`). A query's index is
  eventually consistent, so immediately after creation it can return empty → `fetchMetadata` throws
  → `openDocument` rejects on the listener path.

This makes the *listener's* open of a just-created doc unreliable, but it is not what stops the
document from opening (see Root cause 2). It is still worth fixing because it affects every open
path, not just creation.

## Root cause 2 — the required-document promise handoff races creation (the actual bug)

Creating a personal/learning-log document goes through `DB.createOtherDocument`, which wrote the
RTDB entry and then **awaited `requiredDocuments[type]`**, relying on the `db-other-docs` listener
(fired by that write) to resolve the promise with the freshly-built document model. The UI opens
whatever `createOtherDocument` resolves with:

```js
// document-workspace.tsx handleNewDocumentOpen
const newDocument = await db.createOtherDocument(type, {title, content});
if (newDocument) problemWorkspace.setPrimaryDocument(newDocument);  // this is what "opens" the doc
```

`requiredDocuments[type]` is a single shared promise **per document type**, and the listener
resolves *whichever instance is current when it fires* (see the `handleDocumentAdded` FIXME):

1. A metadata-driven open pre-caches the new document in `openDocument`'s `documentFetchPromiseMap`.
   The opener is `SortedDocuments.fetchFullDocument`, reached from `DocumentScroller`'s
   `renderThumbnail` → `getDocument`, which opens any metadata doc it does not already have in the
   documents store. `NavTabPanel` renders its tabs with `forceRenderTabPanel`, and
   `SortWorkView`'s `watchFirestoreMetaDataDocs` effect runs on mount, so these scrollers cache
   documents while another tab is the visible one — in the live repro `activeNavTab` was `problems`
   with 52 thumbnails mounted.
2. So when the listener opens the same document it gets an already-resolved cached promise and calls
   `resolveRequiredDocumentPromise` almost immediately — often **before** `createOtherDocument`
   installs (via `addRequiredDocumentPromises`) the fresh promise it then awaits.
3. The listener's resolve lands on the *previous* promise instance (already resolved from load — a
   no-op). `child_added` fires once per document, so the fresh promise `createOtherDocument` awaits
   is **never resolved**.

`createOtherDocument` therefore never resolves → `handleNewDocumentOpen` never calls
`setPrimaryDocument` → the document is created but never opened. Whether the resolve lands before or
after the install is timing-dependent, which is why it presents as "first-after-reload fails, later
succeed." Confirmed live: on the failing create, `requiredDocuments.personal.isResolved` stayed
`false` and the primary document key never changed; both `openDocument` calls for the new doc
resolved fine (Root cause 1's fix was already in place).

## Decision

**Two changes**, both on `src/lib/db.ts` / the metadata store.

### Change 1 — the create paths open the created document directly (the fix)

Instead of fishing the model out of the shared listener promise, `createOtherDocument` builds the
model itself via `createDocumentModelFromOtherDocument` (the same builder the listener uses) and
returns it. It still refreshes `requiredDocuments[type]` so startup dedup
(`guaranteeOpenDefaultDocument` / `guaranteeLearningLog`) sees that a document of this type now
exists — but resolves it **deterministically** here rather than depending on the racing listener:

```js
const document = await this.createDocumentModelFromOtherDocument(newDocument, documentType);
documents.addRequiredDocumentPromises([documentType]);
documents.resolveRequiredDocumentPromise(document);
return document;
```

`createProblemOrPlanningDocument` gets the same three lines, using
`createDocumentModelFromProblemMetadata` as its builder (see Scope).

**Only one model is created.** Both the direct open and the listener's later open of the same key
funnel through `openDocument`, which dedupes by key via `documentFetchPromiseMap` — a race-free
synchronous check-and-set that is never cleared — so the second caller returns the same promise.
`documents.add` is idempotent by key as a second backstop.

**Dedup / startup safety.** By the time `createOtherDocument` runs, `requiredDocuments[type]` is
already resolved: manual creates happen after the workspace is interactive (post-startup), and the
default-create path (`guarantee*`) awaits and resolves the promise before it calls
`createOtherDocument`. So refreshing and re-resolving the promise here does not orphan a promise the
startup path is awaiting. This is also strictly more reliable than before: in the failing case the
old code left `requiredDocuments[type]` a fresh *unresolved* promise, which would itself break a
later `guarantee*` dedup.

### Change 2 — metadata point-read uses a strongly-consistent get-by-id (accompanying robustness)

Replace the eventually-consistent **collection query** in `pointReadMetadata` with a
**strongly-consistent get-by-id**, keeping the class scoping the query enforced. This fixes Root
cause 1 for **every** open path and adds no caching state.

The metadata doc lives at `documents/{escapeKey(key)}`:

- Every current writer uses that id: the client
  [`createFirestoreMetadataDocument`](../../../src/lib/db.ts) (via `getSimpleDocumentPath`) and the
  `createFirestoreMetadataDocument_v2` cloud function (`escapeKey(document.key)`).
- The Sep 2025 migration consolidated all historical prefixed docs (`[network]_[key]`,
  `uid:[user]_[key]`) into the unprefixed `escapeKey(key)` doc and deleted the prefixed ones
  ([firestore-migration.md](../../document-metadata/firestore-migration.md)). The v1 comment
  functions that created prefixed docs have been removed.
- Existing code already relies on this id for a just-created doc: the group-doc canonical path does
  `txn.update(firestore.doc(getSimpleDocumentPath(documentKey)), …)`.

**The consolidation was verified complete, not assumed.** Scanning every metadata doc in the
production root `authed/learn_concord_org/documents` (`scripts/check-metadata-doc-ids.ts`, a
read-only `select("key")` pass that classifies each doc id) found:

```
{ total: 114616, reachable: 114613, curriculum: 0, prefixed: 0, mismatched: 3 }
```

No `[network]_[key]` or `uid:[user]_[key]` document survives, so nothing the old key-field query
could reach is invisible to the get-by-id. The 3 exceptions are `cc-test_`-prefixed docs the
migration skipped because their keys are not 20-character document keys — two `supportPublication`
docs keyed by support name and one `exemplar` keyed by curriculum path. `fetchMetadata` is only
called by `openDocument` with a `documentKey`; authored supports and exemplars reach the client
through the supports listener and `exemplarMetadataDocs`, so none of the three is ever requested by
this code path.

A get-by-id is strongly consistent immediately after the awaited write, unlike the query. The
Firestore security rules permit the get: `documents/{docId}` allows read when the caller owns the
doc or the doc's `context_id` matches the caller's class (plus teacher-network branches); demo/qa/
test spaces are broadly readable.

**Preserving class scoping.** CLUE-576's query scoped every read by `context_id == classHash` — for
the security rules and to exclude the ~13 legacy conflicting-`context_id` cases. The get-by-id keeps
this by validating in code: after reading and validating the doc, reject when
`context_id !== user.classHash` (same outcome the empty query produced), rather than widening access
to the rules' teacher-network branches.

## Scope

- `createProblemOrPlanningDocument` gets Change 1 as well. It used the identical promise pattern and
  is **exposed to the same race** — an already-resolved *previous* promise is the precondition for
  the failure, not protection from it, since `resolveRequiredDocumentPromise` targets whatever is in
  `requiredDocuments[type]` **when it runs** and no-ops if that instance is already resolved. It is
  in fact more exposed: `db-problem-documents-listener`'s `handleOfferingUser` takes an
  `updateDocumentFromProblemDocument` branch when the document is already in the store and never
  calls `resolveRequiredDocumentPromise` at all — a deterministic hang rather than a lost race.
  Nor was it protected by being out of reach of the pre-cacher: `watchFirestoreMetaDataDocs` scopes
  its query by class and unit/investigation/problem but **not** by document type, so problem and
  planning documents get thumbnails and are pre-cached by the same `fetchFullDocument` path as
  personal documents. All that stood between it and the same failure was whether a thumbnail for the
  just-created document happened to render before the listener fired. Applying the same direct open
  removes that dependence on timing.
- Not touched: the missing `.catch` in `handleDocumentAdded`, and the broader "one required-document
  promise per type" FIXME. Change 1 removes the create path's dependence on that fragile handshake
  without reworking it.

## Testing

- **document-metadata-store.test.ts**
  - `fetchMetadata` returns metadata via a get-by-id at `documents/{escapeKey(key)}`.
  - Throws when the doc does not exist, when `context_id !== classHash`, and when it fails
    validation.
  - Concurrent `fetchMetadata` calls for the same key still coalesce to one get.
- **db.test.ts**
  - `createOtherDocument` resolves with the created document **without** the DB listener resolving
    the required-document promise (reproduces the hang → fast, descriptive failure).
  - `createOtherDocument` refreshes `requiredDocuments[type]` with the created doc so startup dedup
    still sees it.
  - `creates required problem document` / `creates required planning document` now assert the same
    invariant for `createProblemOrPlanningDocument`: nothing resolves the required-document promise
    externally, so `guarantee*` only settles if the create path opens and resolves it itself.
  - Opening the same document twice builds one model and adds it once (guards the dedup Change 1
    relies on; verified to fail if `openDocument`'s dedup is removed).
  - Updated the visibility tests that relied on the old manual resolve.

  What these prove, precisely: with the model builder stubbed, the create tests show the create path
  returns the builder's result instead of awaiting the required-document promise — the *dependency*
  is gone. They do not exercise the race itself (no listener, no timing); that is covered by the
  manual demo-build check below. The standard to aim for is `builds one model and adds it once`,
  which mocks only leaf I/O (`stubRtdb`, `fetchMetadata`) and runs the real `openDocument`, and was
  verified to fail when `openDocument`'s dedup is removed. Each behavior change above was checked
  the same way — reverted the production change and confirmed the test fails.

  Change 2 has **no test covering its actual justification**: the metadata-store fake models
  `exists`/`data()` but cannot model a Firestore consistency window, so nothing in the suite
  distinguishes a get-by-id from a query on the axis that motivated the change. That change rests on
  the documented reasoning above, not on test evidence.
- Full Jest suite green. Manually verified on a demo build: after a fresh reload the first
  Personal-document create opens immediately, a second also opens, and `requiredDocuments.personal`
  stays resolved.
