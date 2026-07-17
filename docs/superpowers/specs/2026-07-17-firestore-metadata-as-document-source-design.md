# Design: Sourcing DocumentModel Metadata from Firestore

> **Status:** design (uncommitted draft for review).
> **Origin briefing:** [`2026-07-17-firestore-metadata-as-document-source-context.md`](./2026-07-17-firestore-metadata-as-document-source-context.md).
> **Relates to:** CLUE-524 (client-authoritative Firestore metadata + canonical pointers),
> CLUE-554 (Sort Work reactive visibility/title).

## 1. Problem

The client builds a live `DocumentModel` from a **mix of RTDB reads and passed-in arguments**, never
directly from the Firestore `documents/<key>` metadata doc that is now the authoritative store of document
metadata. So a new Firestore metadata field — the axis fields `concurrent`/`kind`, and future
`owner`/`scope`/`access` — cannot reach the live model without extending RTDB metadata (which we are phasing
out) or threading the field through every construction site.

`createDocumentModel` is reached from several sites — the primary `openDocument` path (RTDB + args), the
canonical/pointer path (`openDocumentFromFirestoreMetadata`, which *has* the Firestore doc but forwards into
`openDocument` and re-reads RTDB), four DB-listener builders, teacher supports, and the network/remote path.
There is no single choke point where a document's Firestore metadata is read and applied to the model.

## 2. Goal & non-goals

**Goal.** Make the Firestore `documents/<key>` doc the source for a `DocumentModel`'s **Firestore-only axis
fields** — `concurrent`, `kind`, and future `owner`/`scope`/`access` — so adding a field to the Firestore
metadata makes it available on the live model **without** touching RTDB metadata or threading it through every
construction site.

**Non-goals for this project (deferred, not abandoned — see the roadmap, §8):**

- Moving the dual-stored reactive fields (`visibility`, `title`, `properties`, `groupId`) off RTDB. They keep
  their current RTDB initial value **and** their live RTDB listeners, unchanged.
- Remote / network documents (`src/hooks/network-resources.ts`) — the non-owner client cannot read the
  owner's Firestore metadata directly; that path is unchanged here.
- Teacher supports (`supports.ts`), history playback, copies, doc-editor snapshots — these construct models
  directly and do not traverse `openDocument`.
- Tile **content** — stays in RTDB (content is not metadata; out of scope entirely).

This project is the **first step** toward the larger goal of removing RTDB document metadata: it moves the
Firestore-only axis fields, which have no RTDB representation and no reactivity to preserve. The remaining
work — giving the dual-stored reactive fields a reactive Firestore read, sourcing remote-doc metadata from
Firestore, and finally retiring the RTDB metadata — is directional, not scheduled. The
[roadmap](../../document-metadata/firestore-sourcing-roadmap.md) records that end state and what should happen
next, so future work in this area moves toward it rather than deepening the RTDB-metadata surface.

## 3. Reactivity boundary (the two classes of fields)

The design rests on distinguishing two classes of metadata field, verified against the live listeners:

**A. Firestore-only, effectively immutable-at-creation — *this project sources these from Firestore*.**
The axes `concurrent`, `kind` (and future `owner`/`scope`/`access`). They do not exist in RTDB, are set once
at creation, and do not mutate during a doc's life. A **one-shot Firestore read at open** is correct — there is
no reactivity to preserve.

**B. Reactive, RTDB-sourced on the `DocumentModel` — *untouched by this project*.**
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
off the Firestore metadata.* The Stage 1 store (§4) is the shared substrate those component-level reads — and
the pending peer-title reaction — should sit on. Title and visibility are **already dual-written** (RTDB **and**
Firestore, via `useSyncMstPropToFirebase`), which makes them the closest future cut-over candidates (roadmap §8).

## 4. Stage 1 — Extract `DocumentMetadataStore`

**Ships first, no behavior change.** Today Sort Work owns the only reactive read of the `documents` collection
(`watchFirestoreMetaDataDocs` → private `firestoreMetadataDocs` maps in
[sorted-documents.ts](../../../src/models/stores/sorted-documents.ts)). Promote that into a public, class-scoped
MST store keyed by document `key`.

**Contract:**

- `getMetadata(key): IDocumentMetadata | undefined` — synchronous cache read.
- `fetchMetadata(key): Promise<IDocumentMetadata | undefined>` — memoized **cache-hit-else-point-read** (returns
  a cache hit if the bulk watcher has loaded the doc; otherwise issues one point query and memoizes it).
- Bulk populate via a reactive `onSnapshot` over `documents` (`context_id == classHash`, plus optional
  unit/investigation/problem filters), backing `DocumentMetadataModel`s keyed by `key`.

**A note on how much Sort Work actually loads.** Sort Work's existing watcher is **scoped to its currently-selected
filter**, not the whole class: `"All"` loads the whole class (`context_id` only), but `"Unit"`/`"Investigation"`/
`"Problem"` load progressively narrower subsets (the current problem's docs, plus a separate query for unit-less
personal docs). So a cache populated *by Sort Work* holds only what Sort Work is currently showing.

**Why the cache helps (and its honest limits).** With only the four DB-listener paths, each doc is opened once
and parked in the documents store, so a memoization cache would never re-hit. The store's robust, always-true
value is therefore narrower than "bulk prefetch": it is the **shared point-read API + memoization** that
de-duplicates reads *across* subsystems when they overlap. On top of that, a bulk watcher opportunistically
turns some point lookups into cache hits — but only for docs within whatever filter the watcher is currently
running. Honest limits: (1) a cold, inactive, or out-of-filter watcher means `openDocument` falls back to a
point read; (2) Sort Work *opening* a full doc already passes its cached metadata into
`openDocumentFromFirestoreMetadata`, so that path is covered today — the store's *new* value is serving the
listener paths and `openDocument`'s fallback. If we want the store to *reliably* prefetch for `openDocument`
(rather than opportunistically), it must own its own query/lifecycle rather than piggyback Sort Work's
filter-scoped watcher — see §10.

**Stage 1 migrations (bounded, low-risk):**

- Move `watchFirestoreMetaDataDocs`'s population into the store; Sort Work reads from the store (parity with
  today).
- Make `findFirestoreMetadata` (db.ts) the store's **point-read API** — this immediately also covers the
  workspace group-check ([document-workspace.tsx](../../../src/components/document/document-workspace.tsx)) and
  the canonical/pointer lookups that call it.

**Deferred, opportunistic adopters (noted, not touched):** sync-update `updateFirestoreDocumentProp`, the
creation existence-check in `createFirestoreMetadataDocument`, `findLegacyGroupDocument`, the pointer/canonical
transaction composition, the reactive readiness wait `waitForMetadataDocument`, chat comment-delete, and
multi-class teacher analytics `queryUserDocs` (a different, cross-class scope). Keeping these as-is bounds Stage 1.

## 5. Stage 2 — `openDocument` choke point

With the store in place:

1. `OpenDocumentOptions` gains an optional `firestoreMetadata?: IDocumentMetadata`.
2. `openDocument` resolves it: `options.firestoreMetadata ?? await store.fetchMetadata(documentKey)`.
3. **If absent → error** (an error document via the existing `createErrorDocument` fallback, not a crash).
4. Apply **only the axis fields** (`concurrent`, `kind`, …) from the Firestore doc to the model snapshot. RTDB
   content and all reactive fields (§3) are built exactly as today.

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

## 6. Error handling & data hazards

The Aug–Sep 2025 metadata migration ([firestore-migration.md](../../document-metadata/firestore-migration.md))
documents real hazards in legacy docs: conflicting `context_id` (≈13 cases), merged/duplicate history, and
`tools` drift. Error-if-missing surfaces a *missing* doc as an explicit, logged error (key + reason) rather than
silently constructing a model from wrong data. For hazardous-but-present docs, this project reads only the axis
fields, which the migration did not corrupt; validating `context_id` against the requesting user's class hash is
recommended but is a store-level concern (Stage 1), not per-open.

## 7. Sequencing

- **Order:** Stage 1 (store) ships before Stage 2 (choke point), so there is no window in which the choke point
  runs with guaranteed per-doc reads, and the extraction — valuable on its own — lands first. Each stage is its
  own PR.
- **Enables stored axis props:** once Stage 2 lands, an axis field currently derived on the `DocumentModel` by a
  getter (e.g. from a `kind`/`type` registry) can instead become a **stored prop** populated from the Firestore
  doc at open. Until then, such a getter is a valid bridge; this project does not require that conversion to
  happen in the same change.

## 8. Deliverables

1. **This design spec** (uncommitted; reviewed and committed by the user).
2. **A migration roadmap doc** — [`docs/document-metadata/firestore-sourcing-roadmap.md`](../../document-metadata/firestore-sourcing-roadmap.md)
   — stating the end goal (remove RTDB document metadata), what is done, what this project does, and what should
   happen next (reactive fields → reactive Firestore reads, remote-doc metadata, then retiring RTDB metadata).
   This fills the gap where the briefing referenced a not-yet-existing `docs/document-axes/README.md`.
3. **Stage 1 code:** `DocumentMetadataStore` + Sort Work refactor + `findFirestoreMetadata` routed through it.
4. **Stage 2 code:** `openDocument` axis sourcing via the store, error-if-missing, entry-point wiring.

## 9. Testing

- **Stage 1:** store unit tests — cache hit, point-read fallback, memoization, bulk-populate keying by `key`;
  Sort Work behavior parity (titles/visibility/sort unchanged).
- **Stage 2:** `openDocument` populates axis fields from Firestore for both the pass-in and store-fetch paths;
  errors (error document) when the doc is missing; reactive fields (`visibility`, `title`, `content`) still
  update via their RTDB listeners after open; the four listener paths populate axes.

## 10. Open items for the plan

- **Watcher strategy for the store.** Sort Work's watcher is scoped to its selected filter (§4), so piggybacking
  it gives only opportunistic, filter-dependent cache hits for `openDocument`. Decide whether the store (a)
  simply exposes the point-read + memoization API and treats any bulk population as a bonus, or (b) owns its own
  reactive query — e.g. a whole-class `context_id`-only watcher — to reliably prefetch. Option (b) costs a
  standing whole-class `onSnapshot`; option (a) is cheaper but leaves per-doc point reads as the common case on
  the listener paths. Affects cost/warmth, not correctness.
- Exact `DocumentMetadataStore` placement in the stores tree and `onSnapshot` lifecycle ownership.
- Whether to validate `context_id` in the store's point-read fallback (hazard mitigation) now or defer.
