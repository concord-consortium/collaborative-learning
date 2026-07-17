# Firestore Metadata Sourcing — Roadmap

> **Purpose:** describe the path toward making Firestore the single source of document *metadata* and
> **removing RTDB document metadata entirely**. It records the end goal, what is already done, what the current
> project does, and — most importantly — **what should happen next**. The later steps are not scheduled: the
> guidance is directional. Whenever we work in this area, we should move *toward* this end state rather than
> adding to the RTDB-metadata surface.
>
> **Related:** [firestore-migration.md](./firestore-migration.md) (the Aug–Sep 2025 *data* consolidation), and
> the design spec
> [`superpowers/specs/2026-07-17-firestore-metadata-as-document-source-design.md`](../superpowers/specs/2026-07-17-firestore-metadata-as-document-source-design.md).

## The goal: remove RTDB document metadata

Document *metadata* currently lives in two places: the authoritative Firestore `documents/<key>` doc and a set
of RTDB metadata structures (the `DBDocumentMetadata` envelope and the type-specific metadata paths). Maintaining
both is the cost — every metadata field has to be written, read, and (for reactive fields) listened to in two
stores. **The goal is to make Firestore the single source of document metadata and retire the RTDB metadata
entirely.**

Firestore is already the *authoritative* metadata store: the Aug–Sep 2025 migration consolidated the metadata
into one `documents/<key>` doc, and CLUE-524 made metadata *creation* client-side and authoritative (client
writes `documents/<key>` itself, atomic with the canonical pointer). What remains is to make the live client
*read* its metadata from Firestore instead of RTDB — field by field — until nothing reads RTDB metadata and it
can be deleted.

**Scope note:** this is about *metadata*, not tile **content**. Content stays in RTDB and is out of scope — RTDB
is not going away, only its duplicate *metadata* is.

## Current state: two classes of metadata field

The live, editable `DocumentModel` is still built from **RTDB reads + passed-in args**, not from the Firestore
doc. Its metadata fields fall into two classes:

| Class | Fields | Source on the live `DocumentModel` today | Reactive today? |
|---|---|---|---|
| **Firestore-only, immutable-at-creation** | `concurrent`, `kind`, future `owner`/`scope`/`access` | not on the model yet — exist only in Firestore | No (never mutates) |
| **Dual-stored, RTDB-sourced on the model** | `visibility`, `title`, `properties`, `groupId` | **RTDB** (initial value + live listeners) | Yes, via RTDB listeners |

The Firestore-only fields have no RTDB representation at all, so they are the natural first move. The
dual-stored fields are the harder, later work: each is currently kept live by an RTDB listener, so moving one
means giving it a *reactive* Firestore read before the RTDB listener can be retired (sourcing only its initial
value from Firestore while updates still arrive from RTDB would create a split-brain).

## What this project does now

- **Axis fields (`concurrent`, `kind`, …) become Firestore-sourced** on the `DocumentModel`, applied at
  `openDocument` from the `documents/<key>` doc. Adding a new Firestore-only field then reaches the live model
  with no RTDB change and no per-site threading.
- **A shared, class-scoped `DocumentMetadataStore`** centralizes reads of the `documents` collection (extracted
  from Sort Work's private cache). This is the substrate the next steps build on.

This moves the first field class — the Firestore-only axes — and does not disturb the dual-stored reactive
fields.

## What should happen next

None of these is scheduled. The guidance is directional: when working in this area, advance these rather than
deepening the RTDB-metadata dependency. Together they are what remains before RTDB metadata can be removed.

1. **Move the dual-stored reactive fields to reactive Firestore reads.** `visibility`, `title`, `properties`,
   `groupId` read their initial value from RTDB and stay live via RTDB listeners. For each: add a reactive
   Firestore read (an `onSnapshot` on `documents/<key>`, hosted on the `DocumentMetadataStore`), switch the
   `DocumentModel` field to read from it, then retire the corresponding RTDB listener and RTDB write.
   `title`/`visibility` are the closest — see the concrete example below.
2. **Give remote / network documents a Firestore metadata source.** Their metadata currently comes from RTDB via
   the `getNetworkResources` cloud function; the client cannot read another class's Firestore metadata directly,
   but the function can. Moving that function to read Firestore metadata is the biggest structural step and
   removes the last RTDB-metadata reader for remote docs.
3. **Retire the RTDB metadata.** Once no reader depends on the RTDB metadata envelope / type-specific metadata
   paths, stop writing them and remove them. This is the end state.

### Concrete example: `title` vs `visibility` (from current code)

`title` and `visibility` show how far along one small piece already is, and what "move a field" looks like in
practice:

- **Both are already written to RTDB *and* Firestore** on every change (the metadata sync writes each property
  to both stores). So moving them does not need a new write path — only a Firestore-driven *read/reactivity*
  path.
- **Sort Work already reads `visibility` reactively from the Firestore metadata.** Its thumbnails resolve
  visibility from the Firestore-sourced metadata (falling back to the model's own metadata), kept live by the
  `documents` `onSnapshot`. So a peer's visibility change is reflected.
- **`title` is not yet reactive the same way — this is the current deficiency.** Sort Work still renders a
  document's title from the in-memory `DocumentModel`, which is RTDB-sourced and only kept current by RTDB
  listeners for the viewing user's *own* documents. For a *peer's* document, a title change is not reflected and
  the displayed title can be stale.
- **The next step** is to give `title` the same reactive Firestore path `visibility` has — read/sync the title
  from the Firestore metadata rather than the RTDB-sourced model — hosting that reactive read on the shared
  `DocumentMetadataStore` so any view (or the model itself) consumes it without adding its own `onSnapshot`.

## Status

| Item | State |
|---|---|
| `documents/<key>` is the authoritative metadata store | Done (migration + CLUE-524) |
| `DocumentMetadataStore` (shared class-scoped read layer) | In progress — Stage 1 |
| Axis fields Firestore-sourced on `DocumentModel` | In progress — Stage 2 |
| Dual-stored reactive fields read reactively from Firestore | Next (unscheduled) — start with `title` |
| Remote/network docs sourced from Firestore metadata | Next (unscheduled) — needs the cloud-function change |
| RTDB document metadata removed | End state — after the above |
| Tile content | Out of scope — stays in RTDB |
