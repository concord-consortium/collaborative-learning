# Design: `DocumentMetadataStore` — a validated authority for Firestore document metadata

> **Status:** design.
> **Chore:** CLUE-576.
> **Relates to:** CLUE-524 (client-authoritative Firestore metadata + canonical pointers),
> CLUE-554 (Sort Work reactive visibility/title).
> **Scope:** This is the first of two PRs. It extracts the store. A follow-on PR sources `DocumentModel`
> fields directly from the Firestore metadata doc through this store; that direction is recorded in the
> [roadmap](../../document-metadata/firestore-sourcing-roadmap.md).

## 1. Problem

The Firestore `documents/<key>` doc is now the authoritative store of document metadata, but the client has no
single, validated read path for it:

- The only reactive read of the `documents` collection lives inside Sort Work — `watchFirestoreMetaDataDocs`
  and its private `firestoreMetadataDocs` maps in
  [sorted-documents.ts](../../../src/models/stores/sorted-documents.ts) — which validates and exemplar-enriches
  each doc inline. Nothing else can reuse that logic.
- Point reads (`db.findFirestoreMetadata`, used by canonical/pointer resolution and the workspace group-check)
  go straight to Firestore and apply **no** validation, so a malformed doc surfaces as raw data.
- That Sort Work watch is filter-shaped and replaces its whole map on each snapshot, so it cannot be shared by a
  second consumer without the two clobbering each other.

Upcoming work will source `DocumentModel` fields directly from the Firestore metadata doc, which needs one
validated read path shared across every caller. This PR extracts that path; the field-sourcing itself is the
follow-on (see the [roadmap](../../document-metadata/firestore-sourcing-roadmap.md)).

## 2. Goal & non-goals

**Goal.** Extract a `DocumentMetadataStore` that is the single **validated authority** for Firestore document
metadata — a shared per-document transform (validate + exemplar-enrich) and a validated point read — with
`SortedDocuments` and `db.findFirestoreMetadata` reading through it. Behavior-preserving for Sort Work.

**Non-goals (deferred, not abandoned — see the [roadmap](../../document-metadata/firestore-sourcing-roadmap.md)):**

- **Changing how any `DocumentModel` field is sourced.** Reactive fields (`visibility`, `title`, `properties`,
  `groupId`, `content`) keep their current RTDB initial value **and** their live RTDB listeners, unchanged. The
  follow-on PR sources the Firestore-only axis fields (`concurrent`, `kind`, …) through this store.
- Remote / network documents, teacher supports, history playback, copies, doc-editor snapshots — none of these
  read through this store.
- Tile **content** — stays in RTDB (content is not metadata).

## 3. The `DocumentMetadataStore` (metadata authority)

**No behavior change.** Extract the **shared metadata logic** — the per-document validate + exemplar-enrich
transform, and a validated point read — into a public store keyed by document `key`. Every path that admits a
metadata document into the system routes through that transform, so the store becomes the single authority for
*what a valid metadata document is*.

### Why the store owns the transform, not the collection

The obvious alternative was to fold **all** of Sort Work's Firestore reading into the store — a single
class-scoped filtered map behind a generic by-key API — and delete the equivalent state from
`SortedDocuments`. We deliberately did **not**, because a single filtered map cannot honestly serve more than
one consumer:

- Sort Work's watch is **filter-shaped** (`watchFirestoreMetaDataDocs(filter, unit, investigation, problem)`)
  and applies each snapshot by **replacing the whole map**. A second consumer that set up a watch with a
  different filter would clobber the first. A store that presents a generic `getMetadata`/by-key face while
  actually holding one filtered map *looks* shareable but is not — it works only while Sort Work is the sole
  watcher.
- The genuinely shareable thing is the **per-document transform** (validate + exemplar-enrich) and the
  **point-read API**, not the filtered collection. So the store owns those, and **each consumer owns its own
  filtered maps and its own filter**, routing its snapshots through the store's transform. Two consumers can
  never clobber each other, because the shared thing is the transform, not the collection.

Promoting the store to a single canonical `metadataById` map — with each filter reduced to a key-set view over
it — would also fix the clobbering, but it is premature: there is exactly **one** filtered consumer today, so
there are no duplicate live `DocumentMetadataModel`s to reconcile. That is the natural next step when a second
filtered consumer appears (see "Deferred store evolution").

### Contract

- `metadataFromFirestoreData(data): IDocumentMetadata | undefined` — the single per-document gate:
  `typecheck` the doc (fail → `console.error` + `undefined`, so an invalid doc is treated as absent), then
  apply exemplar enrichment when the key matches an authored exemplar.
- `getMSTSnapshotFromFBSnapshot(snapshot)` — thin batch wrapper over `metadataFromFirestoreData`, used by each
  consumer's reactive watch to build a `DocumentMetadataModel` map (invalid docs omitted).
- `fetchMetadata(key): Promise<IDocumentMetadata | undefined>` — a **validated point read** routed through
  `metadataFromFirestoreData`. Concurrent reads for the same key are **coalesced** into one query; there is **no
  permanent result cache** (the Firestore SDK caches locally).

The filtered watch state (`metadataDocsFiltered` / `metadataDocsWithoutUnit`, `docsReceived`,
`watchFirestoreMetaDataDocs`, and the merged `firestoreMetadataDocs` view) lives on `SortedDocuments`, whose
`onSnapshot` handlers call `store.getMSTSnapshotFromFBSnapshot(snapshot)` and apply the result into their own
maps.

### Validate-everywhere / fail-fast

Because **every** path runs through `metadataFromFirestoreData`, nothing ever surfaces raw or possibly-corrupt
metadata: an invalid `documents/<key>` doc is logged and treated as absent. Consequences (intended):

- **`db.findFirestoreMetadata` callers** (canonical/pointer resolution, `document-workspace.tsx`): get
  `undefined` for an invalid doc where they would previously have gotten malformed data. These call sites
  already handle the not-found `undefined` case.
- The follow-on `openDocument` sourcing (roadmap) inherits the same guarantee: a missing or invalid metadata doc
  is treated as absent and never built into a `DocumentModel`.

### How much Sort Work loads, and why the store is not a bulk cache

Sort Work's watcher is **scoped to its currently-selected filter**, not the whole class: `"All"` loads the whole
class (`context_id` only), but `"Unit"`/`"Investigation"`/`"Problem"` load progressively narrower subsets (the
current problem's docs, plus a separate query for unit-less personal docs). Each consumer holds only what *it* is
currently showing, in its own filtered maps.

So the store's robust, always-true value is **uniform validation/enrichment + coalesced point reads**, not
cross-subsystem bulk caching. The Firestore SDK is the real network cache; with only the four DB-listener paths
each doc is opened once and parked in the documents store, so a store-level result cache would rarely re-hit. If
a future consumer needs the store to *reliably* prefetch, it would own its own query/lifecycle rather than
piggyback a consumer's filter-scoped watcher — see Open items.

### Deferred store evolution

- **Single-model-per-document (canonical identity cache).** When a **second** filtered consumer appears, promote
  the store to a canonical `metadataById: types.map(DocumentMetadataModel)`, reduce each filter to a
  key-set/reference view, and have every source upsert into the canonical map (session-scoped, bounded by class
  size). Building it now — with one consumer and no duplicate live models — is premature.
- **Permanent point-read result cache.** Deferred; the Firestore SDK already caches locally, so `fetchMetadata`'s
  in-flight coalescing is enough.

### Migrations (bounded, low-risk)

- Extract the shared transform into the store; `SortedDocuments` keeps `watchFirestoreMetaDataDocs` and its own
  filtered maps, routing each snapshot through the store's transform (parity with today).
- Make `findFirestoreMetadata` (db.ts) the store's **point-read API** — this immediately also covers the
  workspace group-check ([document-workspace.tsx](../../../src/components/document/document-workspace.tsx)) and
  the canonical/pointer lookups that call it.

**Deferred, opportunistic adopters (noted, not touched):** sync-update `updateFirestoreDocumentProp`, the
creation existence-check in `createFirestoreMetadataDocument`, `findLegacyGroupDocument`, the pointer/canonical
transaction composition, the reactive readiness wait `waitForMetadataDocument`, chat comment-delete, and
multi-class teacher analytics `queryUserDocs` (a different, cross-class scope). Keeping these as-is bounds the PR.

## 4. Sequencing & deliverables

- The store ships first as a standalone, behavior-preserving extraction — valuable on its own, and the substrate
  the follow-on `openDocument` sourcing builds on. Each is its own PR.
- **Deliverables:** `DocumentMetadataStore` + the `SortedDocuments` refactor + `findFirestoreMetadata` routed
  through it; store unit tests; this spec; the
  [roadmap](../../document-metadata/firestore-sourcing-roadmap.md), which records the end goal (remove RTDB
  document metadata), what is done, and what the follow-on does.

## 5. Testing

Store unit tests: `fetchMetadata` returns a validated point read; `undefined` on an empty query; `undefined`
when the doc fails `typecheck` (fail-fast); concurrent-read coalescing; exemplar enrichment via the shared
transform; and the batch transform dropping just the invalid doc while keeping the valid ones. Sort Work behavior
parity (titles / visibility / sort / exemplar display unchanged).

## 6. Open items

- **Prefetch strategy.** The store exposes only the coalesced point-read API; it does **not** own a bulk watcher.
  A future consumer that wants the store to *reliably* prefetch would give it its own reactive query — e.g. a
  whole-class `context_id`-only watcher — at the cost of a standing whole-class `onSnapshot`. Affects
  cost/warmth, not correctness; deferred until there is a demonstrated need.
- The store's point read already scopes by `context_id == classHash`, so cross-class hazards are excluded at
  query time. Deeper per-field validation of hazardous-but-present docs remains future work.
