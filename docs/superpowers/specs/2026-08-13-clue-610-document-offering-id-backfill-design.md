# Backfilling `offeringId` onto Firestore metadata documents — design

**Jira:** CLUE-610. The sweep that runs this script is CLUE-604's; that story is updated once this
is implemented, not before.

**Branch:** `CLUE-610-document-offering-id-backfill`, chained on `CLUE-610-generic-type-rename`.

## The problem

Many Firestore metadata documents for CLUE problem documents have no `offeringId`, even though
every document kept in an offering is supposed to carry one.

This matters because of how the container axis is read. `isInClassUnitContainer`
(`src/models/document/document-axes.ts`) is:

```ts
return !!doc.unit && !doc.offeringId;
```

It identifies the offering container by the **absence** of `offeringId`. A problem document that
has a `unit` but no `offeringId` therefore reads as class-unit-contained — the wrong container.

Nothing is broken today. The guard's only caller is `canUserEditDocument`
(`src/models/document/document-utils.ts`), which returns early on `if (!concurrent) return false`,
and no problem document carries `concurrent`. The guard is unreachable for the affected population.

But the axes work plans to rebase readers onto container-axis guards, and each such rebase makes
this reachable. The field's absence is load-bearing, so the data has to be true before the guards
can rely on it. Fixing it now, in a sweep that is already scheduled, is much cheaper than
discovering it later behind a permissions bug.

## Scope

### Documents in scope

Five Firestore `type` values are offering-contained, per the `containerType: "offering"` entries in
the kind registry (`src/models/document/document-kinds.ts`):

| Firestore `type` | Notes |
|---|---|
| `problem` | The observed gap |
| `planning` | Same container, same exposure |
| `publication` | The problem publication. Note the stored value is `"publication"`, not `"problemPublication"` — `ProblemPublication` in `document-types.ts` is the constant's name, not its value |
| `supportPublication` | |
| `group` / `axes` | The generic axes type — see below. Two values, so six queries for five types |

The group/class-wide type is **either `"group"` or `"axes"`** during the sweep window, depending on
whether `backfill-group-document-axes.ts` has already run. The script accepts both, which makes the
two sweep scripts order-independent — otherwise CLUE-604's runbook acquires a hidden ordering
constraint that nothing in either script would state.

### Documents deliberately excluded

- **Class-wide collaborative documents.** They are also `axes`-typed but are class-unit-contained,
  and must *not* get an `offeringId` — giving them one would break the very guard this work exists
  to make safe. They are told apart by the same discriminator `backfill-group-document-axes.ts`
  uses: a `groupId` means group-scoped, its absence means class-wide.
- **Class-contained and unscoped kinds** — `personal`, `learningLog`, `personalPublication`,
  `learningLogPublication`. They carry no `unit`, so `isInClassUnitContainer` never matches them.
- **Documents with no `type` field.** A Firestore equality query cannot return them. They are
  already broken in ways outside this work, but the census says so explicitly rather than omitting
  them silently.

## Recovery

**One source: the RTDB `documentMetadata` tree.**

```
<space>/classes/<context_id>/users/<uid>/documentMetadata/<key>  →  .offeringId
```

`offeringId` is declared required on `DBBaseProblemDocumentMetadata` (`src/lib/db-types.ts`), which
`problem`, `planning`, `publication`, and `supportPublication` all extend — so for four of the five
types in scope the field should be there.

This lookup already exists in the codebase, as `getOfferingIdFromFirebaseMetadata` in
`scripts/find-documents-missing-metadata.ts`. That script reads `offeringId` only to look up the
offering's unit/investigation/problem, and never writes it back.

### Sources deliberately not used

Two other sources exist and are **not** used:

- **The offering tree.** Problem, planning, and publication metadata live under
  `classes/<ctx>/offerings/<offeringId>/…` (`src/lib/firebase.ts`), so the offering is in the path.
  This is authoritative but requires scanning a class's offerings per document.
- **Matching the class's offerings against the document's own unit/investigation/problem** via the
  portal API. Fuzzy, and ambiguous when a class has two offerings for the same problem.

Neither is built now. The census reports how many documents each would be needed for, and that
number decides whether either is worth building.

### Group documents get no special handling

`DBGroupDocMetadata` extends the *base* metadata rather than the problem metadata, so group
documents have no `offeringId` field in the RTDB tree — the lookup above cannot answer for them.
Their offeringId could be parsed out of their synthetic uid (`group_<offeringId>_<groupId>`), which
is already on the Firestore document.

This is deliberately **not** done. Group documents are recent enough that their Firestore metadata
should already carry `offeringId`; any that does not is a signal about how they were created, and
papering over it with a derivation would hide that signal. They are counted, not repaired. If the
census finds a meaningful number, the derivation is a two-line addition at that point.

## Architecture

### A new script

`scripts/backfill-document-offering-id.ts`, modeled on `scripts/backfill-group-document-axes.ts`:
an exported pure function taking a `Firestore`, unit-tested against a mock, `dryRun` by default with
`APPLY=1` to write.

Neither existing script is the right host:

- **`backfill-group-document-axes.ts`** is driven by `where("type", "==", "group")`, and that query
  being its own work queue is the invariant its merged-write design rests on. The documents in scope
  here are mostly outside that query. Adding a second, disjoint work queue to that file would put two
  unrelated migrations behind one set of counters and one commit path.
- **`find-documents-missing-metadata.ts`** skips any document that already has a `unit` — which is
  precisely the population here. Its whole same-key-sibling mechanism is about the
  unit/investigation/problem triple and answers nothing about `offeringId`. It is also a diagnostic
  one-off: hardcoded `dryRun` and portal, no tests, no batching.

### The shared lookup

`getOfferingIdFromFirebaseMetadata` moves to `scripts/lib/`, and
`find-documents-missing-metadata.ts` switches to the shared copy. Behavior is unchanged; the move is
mechanical, except that the extracted function takes its `database` and base path as arguments
rather than closing over module scope, so it can be tested and reused.

The new module must not use `import.meta`. `scripts/lib/script-utils.ts` does, which is why
`backfill-group-document-axes.ts` imports it lazily inside `main()` — a Jest test cannot load it.
The lookup needs to be statically importable by both the script and its tests.

The reason to share rather than duplicate is forward-looking. When the app stops reading RTDB
metadata, that tree becomes a candidate for removal, and the question at that point is whether
anything in it is not represented elsewhere. One named, tested function that both scripts call makes
that audit a matter of finding its callers.

### Query and pagination

**Six per-type equality queries**, each a paginated collection-group query:

```ts
db.collectionGroup("documents")
  .where("type", "==", t)
  .orderBy(FieldPath.documentId())
  .startAfter(lastDoc)
  .limit(PAGE_SIZE)
```

Per-type rather than one `in` query: cursor pagination over an `in` filter is the one behavior this
design would rather not depend on for a long production run, each type is independently resumable,
and the census partitions by type regardless. The required `COLLECTION_GROUP` ascending index on
`documents.type` already exists in `firestore.indexes.json`, so no index deploy is needed.

Paginated rather than a single `.get()` — unlike its sibling, which loads a few hundred group
documents at once. This query's result set is every problem document in every space, which will not
fit in memory.

### Idempotency works differently here

`backfill-group-document-axes.ts` is idempotent because the field it writes is the field it queries
on: once `type` flips, the document can never be returned again. **That mechanism is unavailable
here.** Firestore cannot query for a *missing* field, so candidates are found by type and filtered
client-side on `!doc.get("offeringId")`.

A re-run therefore rescans everything and re-filters. It is still idempotent — a document repaired
by the previous run now has `offeringId` and fails the client-side filter — but the reasoning is the
opposite of the sibling's, and the file must say so. A reader arriving from the sibling script will
otherwise assume the same query-key invariant applies.

### Spaces

A collection-group query spans every space. The RTDB base path is derived per document from its
Firestore path:

| Firestore path | RTDB base |
|---|---|
| `authed/<portal>/documents/…` | `/authed/portals/<portal>/classes` |
| `demo/<name>/documents/…` | `/demo/<name>/portals/demo/classes` |

The portal segment is already underscore-escaped in the Firestore path, so it is used as-is.

### One RTDB read per document, run concurrently

Each candidate gets its own read of `documentMetadata/<key>`. Caching by user is not worth doing:
the scan is ordered by document id, document ids are random, so two documents belonging to the same
user essentially never fall in the same page and a bounded cache would hit approximately never.
Getting clustering instead would mean ordering by `uid`, which needs a new composite
collection-group index — a real cost, to save reads that are individually tiny.

Latency is handled by concurrency rather than by caching: within each page, candidates are resolved
in fixed-size chunks with `Promise.all`. This keeps memory bounded by the page rather than by the
run, and keeps the number of in-flight RTDB reads fixed.

**Any other path shape is counted and skipped, never fatal.** So is a missing RTDB subtree. Some
demo spaces never received earlier migrations and will have absent or stale trees; a run must
survive them, and the report must attribute their unresolved documents to *them* rather than
folding them into a global number. Every count is therefore reported **per space as well as per
type**.

## The census

The dry run is the deliverable that matters first. It buckets every candidate by *why* it is in
that bucket:

| Bucket | Meaning |
|---|---|
| `alreadySet` | Has a truthy `offeringId`; skipped |
| `resolved` | The RTDB lookup returned an `offeringId` |
| `noMetadataNode` | RTDB `documentMetadata/<key>` absent entirely |
| `nodeWithoutOfferingId` | The node exists, but has no `offeringId` field |
| `unusableDocument` | No `context_id`, `uid`, or `key` to look up with |
| `unknownSpace` | Firestore path matched no known space shape |
| `skippedClassWide` | `group`- or `axes`-typed with no `groupId` — correctly has no offering |

Counted per type and per space.

`noMetadataNode` and `nodeWithoutOfferingId` are different diagnoses pointing at different causes,
and separating them is the point: the first says the consolidated metadata tree was never written
for that document, the second says it was written without the field. Which of the two dominates
determines whether the offering-tree source would help at all.

## Write policy

`APPLY=1` writes only the `resolved` bucket, as `set({ offeringId }, { merge: true })`, batched at
400 like the sibling.

Every other bucket is reported and left untouched. **What to do about documents that cannot be
resolved is deliberately not decided here** — it is decided from the production dry run's numbers.
Leaving them alone is the only policy that keeps the run re-runnable while that question is open.

## Testing

Unit tests against a mock Firestore and a mock RTDB, in the sibling's style:

- Each bucket is reached by a document that belongs in it.
- Class-wide documents — no `groupId`, under *either* type value — are never written to. This is
  the single most damaging possible bug, since it would corrupt the guard this work exists to
  protect, so it is asserted for `group` and `axes` separately.
- Both `group` and `axes` are accepted, so the sweep is order-independent.
- A document that already has `offeringId` is not rewritten.
- The page boundary splits and the final partial batch is actually committed, asserted on commits
  rather than on batch allocations.
- A missing RTDB subtree produces counts, not an exception.
- An unrecognized Firestore path shape produces counts, not an exception.
- The dry run writes and commits nothing.

## Sequencing

This is data repair. No app code changes, no rules change, no client behavior change — so it needs
no drain, no deploy window, and no place in the release chain.

CLUE-604's sweep step becomes **two script runs instead of one, in either order**. Both are dry-run
first, then `APPLY=1`, per environment.

CLUE-604 is updated to describe this once the script exists, so that its runbook can name the real
script, its real flags, and its real output.

## Open question, deliberately deferred

What to do about documents whose `offeringId` cannot be recovered. Resolving it needs the
production dry run's numbers — specifically the split between `noMetadataNode` and
`nodeWithoutOfferingId`, and how the residue distributes across spaces and types. The options are
building the offering-tree source, building the fuzzy portal-API match, accepting a documented
residue, or deciding the affected documents are dead and should be deleted. Choosing now would be
guessing.
