# Session Context: Sourcing Client Document Construction from Firestore Metadata

> **What this is:** a briefing for a **new, independent design/research session**. It is *not* a design spec.
> The new session should start with `superpowers:brainstorming` (likely after a research/exploration pass) and
> produce its own design spec. When that's done, the results feed back into the paused **CLUE-550** work.
>
> **You (the new session) have no memory of the conversation that produced this.** Everything you need to begin
> is below, with file/line pointers to verify against the live code.

## Why this project exists (origin)

While planning **CLUE-550** (class-wide Driving Question Board), we introduced two new *stored* document
metadata fields — `concurrent` and `kind` — on the **Firestore** metadata document (`IDocumentMetadata`). We
wanted the live, editable `DocumentModel` to carry `concurrent` as a normal stored property. We couldn't do it
cleanly, because:

- The live `DocumentModel` is **not** hydrated from the Firestore metadata document. The main open path reads
  the **Realtime Database (RTDB)** instead.
- The RTDB metadata (`DBDocumentMetadata`) does **not** have the new fields, and we are deliberately **phasing
  RTDB metadata out** (per the CLUE-550 review), so extending it is the wrong direction.

So in CLUE-550 we fell back to deriving `concurrent` on the `DocumentModel` from a kind registry (via
`kind ?? type`) rather than reading a stored value. That works while `concurrent` is collinear with `kind`, but
it is a workaround: **any** future Firestore metadata field (the axes `owner`, `scope`, `access`, …) faces the
same wall — it can't reach the live model without either extending RTDB metadata or per-field threading.

**The idea:** if we're going to give client document construction access to the Firestore metadata *anyway*, do
it **first**, as its own effort. Then CLUE-550's axes — and every future metadata field — become ordinary
stored properties populated from the single source of truth.

## The core problem (precise)

The client builds a `DocumentModel` from a **mix of RTDB reads and passed-in arguments**, never directly from
the Firestore metadata document that is now the authoritative store of document metadata.

Concretely, `createDocumentModel(snapshot)` ([src/models/document/document.ts:363](../../../src/models/document/document.ts#L363))
is called from these sites:

| Site | Source of the fields | Notes |
|---|---|---|
| [db.ts:960](../../../src/lib/db.ts#L960), [db.ts:967](../../../src/lib/db.ts#L967) (`openDocument`) | RTDB: `documentRef` (content) + `metadataRef` (`DBDocumentMetadata`), plus args | **Primary path.** Reads RTDB, not Firestore. |
| [db.ts:1024](../../../src/lib/db.ts#L1024) (`openDocumentFromFirestoreMetadata`) | takes Firestore `IDocumentMetadata`, then **forwards into `openDocument`** | Even the "from Firestore" entry point re-reads RTDB — the Firestore doc is used to locate the doc + pass a few fields, not to build the model. |
| [document.ts:489](../../../src/models/document/document.ts#L489) (`createDocumentModelWithEnv`) | a caller-supplied snapshot | copies / history playback |
| [supports.ts:380](../../../src/models/stores/supports.ts#L380) | support content | teacher supports |
| [network-resources.ts:33–95](../../../src/hooks/network-resources.ts#L33) (7 sites) | a **network snapshot** from another class/teacher | remote/read-only docs; the client is not the owner and local Firestore metadata is typically **not available** |

So there is no single choke point where a document's Firestore metadata is read and applied to the model.

## The goal

Make the Firestore metadata document the source for a `DocumentModel`'s **metadata** fields, so that adding a
field to the Firestore `IDocumentMetadata` makes it available on the live model **without** touching RTDB
metadata or threading it through every construction site.

Scope note: this is about **metadata** (title, visibility, groupId, unit, the new axes, …). Tile **content**
still lives in RTDB and is out of scope — the model keeps reading content from RTDB; only the metadata sourcing
changes.

## Context you must fold in

- **CLUE-524** moved Firestore metadata *creation* client-side and made it authoritative (the client writes the
  `documents/<key>` metadata doc itself, with a `canonical` pointer layer). See
  `docs/superpowers/specs/2026-07-11-scoped-singleton-document-pointers-design.md`. This means for
  newly-created docs the Firestore metadata is present and client-written.
- **The Aug–Sep 2025 metadata migration** (`docs/firestore-metadata-migration.md`) consolidated the multiple
  per-document Firestore metadata docs into one `documents/<key>` doc and is the reason Firestore is now the
  intended single source of truth. Read it — it documents real data hazards (conflicting `context_id`,
  duplicate/merged history, `tools` list drift) that a Firestore-sourced open path may surface.
- **RTDB metadata is being phased out.** This project is a concrete step toward completing that.
- **Sort Work already bulk-reads Firestore metadata** via `watchFirestoreMetaDataDocs`
  ([src/models/stores/sorted-documents.ts:156](../../../src/models/stores/sorted-documents.ts#L156)) into
  `DocumentMetadataModel`s. There may be an opportunity to reuse that read/cache rather than adding a per-open
  Firestore fetch.
- **The document-axes roadmap** (`docs/document-axes/README.md`) is the umbrella refactoring; this project
  unblocks the stored axes. Coordinate with it and update its status when done.
- **The paused CLUE-550 plan** (`docs/superpowers/plans/2026-07-17-clue-550-stage-0-1-concurrent-kind-axes.md`)
  has a `DocumentModel.concurrent` **getter** (Task 1.3) chosen precisely because of this gap. When this project
  lands, revisit that decision — `concurrent` (and `kind`) can become stored props populated from Firestore.

## Open questions to research / decide (starter list — not exhaustive)

1. **Where's the choke point?** Should `openDocument` read the Firestore `documents/<key>` doc and apply it to
   the model, replacing (or supplementing, during transition) the RTDB `metadataRef` read? Or introduce a new
   unified builder that all sites funnel through?
2. **Reactive vs one-shot.** Firestore metadata changes remotely (visibility, title, `canonical`, future
   axes). Should the model's metadata fields be **reactive** to the Firestore doc (a listener), or read once at
   open? Note the access code already *prefers* reactive Firestore visibility over the static loaded value
   ([document-utils.ts](../../../src/models/document/document-utils.ts) `isDocumentAccessibleToUser`).
3. **Guaranteed presence & fallback.** Is a Firestore metadata doc always present before a doc is opened?
   (Client-created since CLUE-524; migrated for legacy.) What about docs with RTDB content but missing/looked-up
   Firestore metadata? Define the fallback (derive? RTDB? error?).
4. **Remote / network documents.** The `network-resources.ts` docs come from other classes where the client
   likely cannot read the owner's Firestore metadata. Do they keep a separate construction path, get a
   network-supplied metadata source, or something else? This is the biggest structural wrinkle.
5. **Performance.** A naive per-open Firestore read adds latency and cost, especially where many docs open
   (Sort Work, 4-up). Can the Sort Work Firestore cache be reused? Batch reads? A shared metadata store?
6. **Timing / history drift.** The first-session history-drift check depends on metadata being ready (a known
   CLUE-550 hazard, gist issue #6). Ensure the new ordering doesn't reintroduce or worsen drift.
7. **Migration data hazards.** Per `firestore-metadata-migration.md`, some Firestore docs have wrong
   `context_id`, stale `tools`, or merged history. A Firestore-sourced open path may expose these — decide
   whether to tolerate, validate, or repair.
8. **Transition strategy.** Can we cut over the primary path first and leave remote/support/playback on their
   current construction, then converge? What's independently shippable?

## What the new session should produce

1. Start with `superpowers:brainstorming` (it may direct a research/exploration pass first, given the wrinkles
   above — the network-doc and reactivity questions especially).
2. A design spec at `docs/superpowers/specs/YYYY-MM-DD-<name>-design.md` (uncommitted; the user reviews and
   commits CLUE spec docs themselves).
3. Optionally a research findings doc if the exploration warrants it.

Then return to the CLUE-550 session with: the chosen approach, whether `DocumentModel.concurrent`/`kind` should
become stored props, and any sequencing (does this ship before CLUE-550 Stage 1, or alongside it?).

## Key files to read first

- `src/lib/db.ts` — `openDocument` (~900–990), `openDocumentFromFirestoreMetadata` (~1024),
  `createFirestoreMetadataDocument` (~545), `findFirestoreMetadata` (~694).
- `src/models/document/document.ts` — `createDocumentModel` (363), `createDocumentModelWithEnv` (489), the
  `DocumentModel` props (~60) and `metadata` getter (~135).
- `src/lib/db-types.ts` — `DBDocumentMetadata` (RTDB metadata, ~50–115) vs `shared/shared.ts` `IDocumentMetadata`
  (Firestore metadata, ~133–160).
- `src/models/document/document-metadata-model.ts` — the Sort Work MST mirror of the Firestore metadata.
- `src/models/stores/sorted-documents.ts` — `watchFirestoreMetaDataDocs` (156), `getMSTSnapshotFromFBSnapshot` (114).
- `src/hooks/network-resources.ts` — the remote/network construction sites.
- `docs/firestore-metadata-migration.md`, `docs/firestore-schema.md`, `docs/firebase-schema.md`,
  `docs/document-axes/README.md`.
