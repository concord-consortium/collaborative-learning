# Design: `openDocument` sources Firestore metadata

> **Status:** design (uncommitted draft for review).
> **Chore:** CLUE-576.
> **Depends on:** the `DocumentMetadataStore` from
> [`2026-07-17-firestore-metadata-as-document-source-design.md`](./2026-07-17-firestore-metadata-as-document-source-design.md)
> (ships first). **Relates to:** CLUE-524, CLUE-554.
> **Roadmap:** [`docs/document-metadata/firestore-sourcing-roadmap.md`](../../document-metadata/firestore-sourcing-roadmap.md).

## 1. Problem

The client builds a live `DocumentModel` from a **mix of RTDB reads and passed-in arguments**, never
directly from the Firestore `documents/<key>` metadata doc that is now the authoritative store of document
metadata. So a new Firestore metadata field — the axis fields `concurrent`/`kind`, and future
`owner`/`scope`/`access` — cannot reach the live model without extending RTDB metadata (which we are phasing
out) or threading the field through every construction site.

`createDocumentModel` is reached from several sites — the primary `openDocument` path (RTDB + args), the
canonical/pointer path (`openDocumentFromFirestoreMetadata`, which *has* the Firestore doc but forwards into
`openDocument` and re-reads RTDB), four DB-listener builders, teacher supports, and the network/remote path.
There is no single choke point where a document's Firestore metadata is read and applied to the model. This PR
makes `openDocument` that choke point, sourcing metadata through the `DocumentMetadataStore` (the precursor PR).

## 2. Reactivity boundary (the two classes of fields)

The design rests on distinguishing two classes of metadata field, verified against the live listeners:

**A. Firestore-only, effectively immutable-at-creation — *this PR sources these from Firestore*.**
The axes `concurrent`, `kind` (and future `owner`/`scope`/`access`). They do not exist in RTDB, are set once
at creation, and do not mutate during a doc's life. A **one-shot Firestore read at open** is correct — there is
no reactivity to preserve.

**B. Reactive, RTDB-sourced on the `DocumentModel` — *untouched by this PR*.**
`visibility`, `title`, `properties`, `groupId`, `content`. Each keeps its current initial source and its live
updater:

| Field | Live updater (unchanged) |
|---|---|
| `visibility` | `child_changed` on `personalDocs`/`learningLogs` ([db-other-docs-listener](../../../src/lib/db-listeners/db-other-docs-listener.ts)) and `offerings/.../documents` ([db-problem-documents-listener](../../../src/lib/db-listeners/db-problem-documents-listener.ts)) |
| `title` | same `child_changed` listeners (owner's own docs) |
| `content` | `value` on `users/<uid>/documents/<key>` ([db-docs-content-listener](../../../src/lib/db-listeners/db-docs-content-listener.ts)) |
| `groupId` | autorun recompute from the groups store |
| `properties` | outbound sync + partial inbound `child_changed` |

Because we do **not** move these fields' initial read to Firestore, there is **no split-brain**: e.g. visibility
stays 100% RTDB (initial value *and* reactive updates).

**Nuance — a view may already read Firestore metadata reactively.** Sort Work (CLUE-554) already reads
**visibility** reactively off the Firestore metadata at the component level
(`effectiveMetadata = documentMetadata ?? document.metadata` in
[thumbnail-document-item.tsx](../../../src/components/thumbnail/thumbnail-document-item.tsx)), where
`documentMetadata` comes from the `onSnapshot` cache. **Title** is the pending half of that work: for peer docs
it still reads the RTDB `DocumentModel.title` (only reactive for the owner's own docs); giving title the same
reactive Firestore read visibility already has is the natural next step. So the boundary is precisely:
*the `DocumentModel`'s reactive fields stay RTDB-sourced; a view may independently read some fields reactively
off the Firestore metadata.* The `DocumentMetadataStore` (precursor PR) is the shared substrate those
component-level reads — and the pending peer-title reaction — should sit on. Title and visibility are **already
dual-written** (RTDB **and** Firestore, via `useSyncMstPropToFirebase`), which makes them the closest future
cut-over candidates (roadmap).

## 3. `openDocument` choke point

With the store in place:

1. `OpenDocumentOptions` gains an optional `firestoreMetadata?: IDocumentMetadata`.
2. `openDocument` resolves it: `options.firestoreMetadata ?? await store.fetchMetadata(documentKey)`.
3. **If absent → throw** — `openDocument` throws (and its `.catch` rejects the promise), consistent with
   how it already throws when the RTDB metadata envelope is absent. The document is not opened and the failure
   is logged; there is no `createErrorDocument` for this path (that helper handles content-parse errors only).
4. Apply **only the axis fields** (`concurrent`, `kind`, …) from the Firestore doc to the model snapshot. RTDB
   content and all reactive fields (§2) are built exactly as today.

**Entry-point coverage:**

- **Already hold the doc → pass it in (zero new reads):** `openDocumentFromFirestoreMetadata` (canonical/pointer
  + workspace) — which stops discarding the doc and forwards it via `firestoreMetadata`; Sort Work's
  `fetchFullDocument` (reads the store).
- **Hold only RTDB metadata → let `openDocument` fetch from the store:** the four DB-listener builders
  `createDocumentModelFromProblemMetadata`, `createDocumentModelFromOtherDocument`,
  `createDocumentModelFromOtherPublication`, `createDocumentFromPublication`.

**Why error-if-missing is safe.** Every client creation path funnels through `DB.createDocument`, which always
calls `createFirestoreMetadataDocument` — problem, planning, personal, learningLog, publications, and group docs
all get a `documents/<key>` doc (verified). The only creation exception is teacher supports, which build models
directly and **do not traverse `openDocument`**, so they are unaffected.

## 4. Error handling & data hazards

The Aug–Sep 2025 metadata migration ([firestore-migration.md](../../document-metadata/firestore-migration.md))
documents real hazards in legacy docs: conflicting `context_id` (≈13 cases), merged/duplicate history, and
`tools` drift. A missing doc causes `openDocument` to throw and reject the promise — consistent with the existing
missing-RTDB-metadata handling — so the document is not opened and the failure is logged (key + reason) rather
than silently constructing a model from wrong data. This is safe because all creation paths write the Firestore
metadata doc, so the throw path should not occur for migrated or new docs. For hazardous-but-present docs, this
PR reads only the axis fields, which the migration did not corrupt; the store's point read scopes every query by
`context_id == classHash`, so cross-class conflicts are excluded at query time rather than per-open.

## 5. Sequencing & testing

- **Order:** the store ships first (precursor PR), so there is no window in which this choke point runs without a
  validated metadata read available.
- **Enables stored axis props:** once this lands, an axis field currently derived on the `DocumentModel` by a
  getter (e.g. from a `kind`/`type` registry) can instead become a **stored prop** populated from the Firestore
  doc at open. Until then, such a getter is a valid bridge; this PR does not require that conversion.
- **Testing:** `openDocument` populates axis fields from Firestore for both the pass-in and store-fetch paths;
  throws and rejects (promise rejected, failure logged) when the doc is missing; reactive fields (`visibility`,
  `title`, `content`) still update via their RTDB listeners after open; the four listener paths populate axes.

## 6. Open items

- **Prefetch strategy.** The store exposes only the coalesced point-read API; it does **not** own a bulk watcher,
  so `openDocument` falls back to a per-doc point read when no consumer has the doc parked. Reliable prefetch
  would give the store its own reactive query — e.g. a whole-class `context_id`-only watcher — at the cost of a
  standing whole-class `onSnapshot`. Affects cost/warmth, not correctness; deferred until there is a demonstrated
  need.
