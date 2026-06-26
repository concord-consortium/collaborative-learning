# Shared personal-doc / learning-log thumbnails (sort view, peers) — Option A implementation

Implementation plan for making a peer's personal-document / learning-log thumbnail
flip from private to visible **reactively** in the **Sort Work view** when the
owner shares it. Background and root-cause analysis:
[clue-554-shared-thumbnails-findings.md](../clue-554-shared-thumbnails-findings.md).

## Context

Sharing is a `visibility` flip written to the `documentMetadata` RTDB path and to
the Firestore `documents` metadata. The sort-view metadata list is already
reactive (Firestore `onSnapshot`), but the thumbnail computes private/visible from
the **full in-memory `DocumentModel`** (`document.isAccessibleToUser` →
`document.visibility`, [thumbnail-document-item.tsx:104](../../src/components/thumbnail/thumbnail-document-item.tsx#L104)),
and **nothing updates a peer's in-memory doc visibility when they share**
(`setVisibility` runs only for the viewer's own other-docs). So the flip isn't
observed where the thumbnail reads it.

Option A closes this by propagating the already-reactive Firestore metadata
visibility (and title) into the matching in-memory `DocumentModel`.

## Goal & scope

- **In scope:** Sort Work view; audience = peers (students); document types
  `PersonalDocument` and `LearningLogDocument`; sync `visibility` and `title`.
- **Out of scope (documented, not built):** nav-tab views (My Work / Class Work);
  teachers (already see all docs regardless of visibility — a flip is a visual
  no-op, see findings doc); problem documents.

## Approach

Add a MobX `reaction` in `SortedDocuments` that watches the Firestore metadata
maps and, for each **loaded peer** personal/learning-log doc, calls
`setVisibility`/`setTitle` on the matching `documents.all` model when the value
differs. The thumbnail (an observer) then flips on its own.

Wire the reaction into `watchFirestoreMetaDataDocs`
([sorted-documents.ts:152-200](../../src/models/stores/sorted-documents.ts#L152-L200))
so it shares the sort view's lifecycle (set up with the two `onSnapshot`
listeners; disposed by the same returned disposer used in
[sort-work-view.tsx:176](../../src/components/document/sort-work-view.tsx#L176)).

### Predicate (which docs to sync)

A loaded doc is synced iff:
- `doc.type` is `PersonalDocument` or `LearningLogDocument`, **and**
- `doc.uid !== user.id` — i.e. **not the viewer's own doc**.

Excluding own docs is a safety guard (mirrors the content-monitor edit-safety
rule): the local model is authoritative for your own docs and may hold a
title/visibility change that hasn't round-tripped to Firestore yet; syncing from
metadata could clobber it. Own docs are already locally reactive via
`toggleVisibility()` and `DBOtherDocumentsListener`.

## Implementation

**File: [src/models/stores/sorted-documents.ts](../../src/models/stores/sorted-documents.ts)**

1. Imports: `reaction` from `mobx`; `PersonalDocument`, `LearningLogDocument` from
   `../document/document-types`.

2. Add a private helper that returns the metadata for a key from either map
   (personal/LL docs live in `metadataDocsWithoutUnit` when a unit filter is
   applied, otherwise in `metadataDocsFiltered`):
   ```ts
   private metadataForKey(key: string) {
     return this.metadataDocsFiltered.get(key) || this.metadataDocsWithoutUnit.get(key);
   }
   ```

3. In `watchFirestoreMetaDataDocs`, after the two `onSnapshot` listeners are set
   up, add a reaction and include its disposer in the returned cleanup:
   ```ts
   const disposeVisibilitySync = reaction(
     () => {
       // TRACKED: read only visibility/title from metadata + the loaded doc set.
       // Reading meta.visibility/meta.title (not meta.lastHistoryEntry) means the
       // reaction stays dormant during history-save churn.
       const { documents, user } = this.stores;
       return [PersonalDocument, LearningLogDocument]
         .flatMap(type => documents.byType(type))
         .filter(doc => doc.uid !== user.id)
         .map(doc => {
           const meta = this.metadataForKey(doc.key);
           return { key: doc.key, visibility: meta?.visibility, title: meta?.title };
         });
     },
     (entries) => {
       // EFFECT (untracked): apply diffs. Reading/writing doc.visibility here does
       // not re-trigger the reaction, avoiding self-firing.
       runInAction(() => {
         const { documents } = this.stores;
         entries.forEach(({ key, visibility, title }) => {
           const doc = documents.getDocument(key);
           if (!doc) return;
           if (visibility && visibility !== doc.visibility) doc.setVisibility(visibility);
           if (title != null && title !== doc.title) doc.setTitle(title);
         });
       });
     },
     { fireImmediately: true }
   );

   return () => {
     disposeFilteredListener();
     disposeDocsWithoutUnitListener?.();
     disposeVisibilitySync();
   };
   ```

### Why the data/effect split matters

- **No self-trigger:** the tracked data function never reads `doc.visibility`; only
  the untracked effect does. Writing `doc.visibility` in the effect can't re-fire
  the reaction. (A plain `autorun` that both reads and writes `doc.visibility`
  would fire an extra stabilizing pass each change — avoidable.)
- **Skips history churn:** the data function reads only `meta.visibility` and
  `meta.title`. Because MST `applySnapshot` reconciles map entries **in place**
  (patching changed fields on the existing model), a metadata snapshot that only
  bumps `lastHistoryEntry` does not change the tracked fields, so the reaction
  stays dormant. **Assumption to verify in testing** (see Test 3); if in-place
  reconciliation does not hold, fall back to an `autorun` + the same diff guard
  (correct, slightly more CPU).

## Performance

- **No new Firebase listeners / network / bandwidth / retained memory.** Reuses
  the existing Firestore `onSnapshot`; all data is already streamed and observed.
  (Contrast: the content-monitor work added one `ref.on("value")` per doc.)
- **CPU:** the data function is O(N) over *loaded peer personal/LL docs* and runs
  only when a tracked field (visibility/title) or the loaded-doc set changes —
  not on history-save churn (per the assumption above). For the current scope
  (students), N is small, so cost is negligible. `documents.getDocument` is a
  linear `find`; acceptable at this N, and the effect only runs on real changes.
- **Re-renders:** bounded by actual visibility/title changes (diff guard), each
  flipping just the affected thumbnail(s) — the intended effect.

## Edge cases & safety

- **Own docs excluded** (`uid !== user.id`) — no clobbering local unsynced changes;
  no Firebase write-back loop (peer docs are read-only and don't mount the
  visibility→Firebase sync hook anyway).
- **Doc loaded *after* a flip:** loads with current visibility from Firestore
  metadata (`openDocumentFromFirestoreMetadata`), so it's already correct; the
  reaction only needs to handle the load-then-flip case.
- **Doc not loaded when flip happens:** the effect skips it (`getDocument` returns
  undefined); it loads correct later. No action needed.
- **Lifecycle:** reaction lives only while the sort view is mounted (tied to
  `watchFirestoreMetaDataDocs`'s disposer), so it costs nothing elsewhere.

## Testing

Add to (or create) `src/models/stores/sorted-documents.test.ts`. Run with
`npm test -- --no-watchman src/models/stores/sorted-documents.test.ts`.

1. **Flip propagates:** seed a peer `PersonalDocument` (uid ≠ user) in
   `documents.all` with `visibility: "private"`; apply a metadata snapshot with
   `visibility: "public"` for that key; assert the in-memory doc's `visibility`
   becomes `"public"` (and a title change propagates similarly). Repeat for
   `LearningLogDocument`.
2. **Own docs untouched:** seed an own doc (`uid === user.id`) with a local title;
   apply a metadata snapshot with a different title; assert the in-memory doc is
   **not** changed.
3. **History churn is a no-op:** spy on `setVisibility`/`setTitle`; apply a
   metadata snapshot that changes only `lastHistoryEntry` (same visibility/title);
   assert neither setter is called. (Validates the "skips history churn"
   assumption; if it fails, switch to autorun + guard and update this plan.)
4. **Disposal:** call the disposer returned by `watchFirestoreMetaDataDocs`; apply
   a further metadata change; assert no further setter calls.

## Manual verification (two-tab peer test)

Use demo mode against a shared partition so two tabs see the same data:
```
http://localhost:8080/?appMode=demo&demoName=clue554share&fakeClass=5&fakeUser=student:1&unit=./demo/units/qa/content.json&problem=1.1
http://localhost:8080/?appMode=demo&demoName=clue554share&fakeClass=5&fakeUser=student:2&unit=./demo/units/qa/content.json&problem=1.1
```
1. Student 1: create a personal doc (and/or a learning log), keep it **private**.
2. Student 2: open Sort Work; locate Student 1's doc (currently a private
   placeholder).
3. Student 1: share the doc.
4. ✅ Student 2's thumbnail flips to the live content without a refresh.
5. Repeat the unshare direction; confirm it reverts to private.

## Open questions to confirm during implementation

- Product: should a peer's private doc be **hidden** entirely vs. shown as a
  private placeholder that becomes a thumbnail on share? (Current behavior =
  placeholder; this plan preserves it.)
- Confirm `fetchFullDocument` isn't wastefully loading not-yet-shared docs (it
  appears unconditional via `getDocument`); if it is, that's a separate
  optimization, not required for this fix.
- Verify the MST `applySnapshot` in-place-reconciliation assumption (Test 3).
