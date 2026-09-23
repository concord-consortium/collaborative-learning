# Firestore document metadata repair

Five one-off scripts that repair Firestore document metadata, plus the modules they share. The first
four reconcile it with the realtime database; the fifth gives group documents canonical pointers.

Three defects motivated the first four. None is still being produced by the client, so these are a
repair rather than something that runs on a schedule:

1. **`context_id` names the wrong class** on some metadata documents — 35 in production.
2. **The metadata document is missing entirely** for realtime-database documents that have one —
   around 5,600 across all real spaces. A document without one is invisible to Sort Work, to the
   class dashboard, and to every other Firestore-driven view.
3. **`offeringId` is missing** from about 72,000 offering-contained metadata documents.
   `isInClassUnitContainer` reads the field's absence as "class-contained", so the data has to be
   true before anything relies on that guard.

The fifth exists so the app can stop finding older group documents by query; see
[Group canonical pointers](#group-canonical-pointers).

| script | what it does | writes to |
|---|---|---|
| `repair-document-context-id.ts` | rewrites `context_id` to the class the document actually lives in | Firestore |
| `create-missing-document-metadata.ts` | creates the missing metadata documents | Firestore |
| `delete-unrepairable-documents.ts` | removes the residue the repair cannot fix | realtime database |
| `backfill-document-offering-id.ts` | copies `offeringId` from the realtime-database metadata node | Firestore |
| `backfill-group-canonical-pointers.ts` | claims each group slot's canonical pointer and deletes duplicate group documents and legacy pointers | Firestore, realtime database |

## Before you start

- **`scripts/serviceAccountKey.json`** — see [the scripts README](../README.md). The key's project
  decides which environment you are pointed at; `create-missing-document-metadata.ts` prints the
  project and database URL at startup, so read those two lines before trusting a run.
- **`scripts/.env` with `PORTAL_ACCESS_TOKEN`** — only needed by
  `create-missing-document-metadata.ts`, and only for `authed/` spaces, where an offering's curriculum
  position is resolved through the portal. Also in [the scripts README](../README.md).
- **A `clue-curriculum` checkout** — only needed by `create-missing-document-metadata.ts`, and only
  for `demo/` spaces, where a curriculum position is decoded from the offering id and then checked
  against the unit's `content.json`. Set `CURRICULUM_ROOT` unless the checkout is at
  `~/Development/clue-curriculum`. The run stops if the checkout is not there. Without that stop,
  every decoded position would be refused and handed to the deletion script.
- **`npm --prefix scripts install`** if this is a fresh worktree. `scripts/` has its own
  `package.json` and `node_modules`.

## Order

This matters, and it is not the order the scripts are listed in.

```
1. repair-document-context-id.ts        (either order with 2)
2. create-missing-document-metadata.ts
3. re-run 2 as a dry run                 regenerates the skip report
4. delete-unrepairable-documents.ts      reads that report
5. backfill-document-offering-id.ts      needs 1 and 2; independent of 3 and 4
6. backfill-group-canonical-pointers.ts  needs 1 and 5
```

**1 and 2 are independent** and may run in either order.

**Both must run before `backfill-document-offering-id.ts`**, which finds a document's realtime-database
node through its `context_id` — a wrong one makes the document look unrecoverable, and one that does
not exist yet cannot be scanned at all. It does not depend on the deletion, which only removes
documents that have no Firestore metadata for it to scan.

**Step 6 needs 1 and 5.** `backfill-group-canonical-pointers.ts` trusts each group document's
`context_id`, both to place it in a slot and to find the realtime-database copy it deletes, and skips
a document with no `offeringId`. Either repair can therefore change which documents it sees, which one
wins a slot, and what it deletes. It does not depend on 2–4.

**The deletion runs against a report regenerated after the repair.** Not because the deletion is
riskier in itself, but because a document lands in the residue for reasons that are not all
deterministic: 330 of the ~573 unresolved documents get their curriculum position from a portal API
call, so an outage, a rate limit or an expired token would bucket them as unresolvable. Deleting from a
report produced after the repair actually ran means the residue is confirmed rather than predicted.

The report records the run that wrote it, and the deletion script refuses a report that was written
by an apply run, written against another project or database, or written more than 24 hours ago.
The first refusal enforces step 3. If step 3 is run with `SPACES` still set, its report goes to the
`.partial.json` path, and the file at the default path is still the one step 2's apply run wrote.

## Running them

Every script is **dry run by default** and prints its mode at startup. `APPLY=1` makes it write.

```bash
# 1. Repair context_id. Dry run first — it lists every before/after pair, and at ~35 documents
#    that is small enough to read in full.
npx tsx scripts/metadata-repair/repair-document-context-id.ts
APPLY=1 npx tsx scripts/metadata-repair/repair-document-context-id.ts

# 2. Create the missing metadata documents. Takes about 20 minutes over every space.
npx tsx scripts/metadata-repair/create-missing-document-metadata.ts
APPLY=1 npx tsx scripts/metadata-repair/create-missing-document-metadata.ts

# 3. Regenerate the skip report against post-repair data.
npx tsx scripts/metadata-repair/create-missing-document-metadata.ts

# 4. Delete the residue.
npx tsx scripts/metadata-repair/delete-unrepairable-documents.ts
APPLY=1 npx tsx scripts/metadata-repair/delete-unrepairable-documents.ts

# 5. Backfill offeringId. The dry run takes about 4.5 minutes; TYPES=planning samples one type first.
npx tsx scripts/metadata-repair/backfill-document-offering-id.ts
APPLY=1 npx tsx scripts/metadata-repair/backfill-document-offering-id.ts

# 6. Claim group canonical pointers and delete duplicate group documents.
npx tsx scripts/metadata-repair/backfill-group-canonical-pointers.ts
APPLY=1 npx tsx scripts/metadata-repair/backfill-group-canonical-pointers.ts
```

`backfill-document-offering-id.ts` needs the `documents` collection-group index on `type`, which
staging and production already have. Its header says how to add it to a new environment.

### Environment variables

| variable | applies to | meaning |
|---|---|---|
| `APPLY=1` | all | perform the writes or deletions. Absent means dry run. |
| `SPACES=` | 1, 2, 6 | comma-separated space labels, e.g. `demo/CLUE,authed/learn_concord_org`. Use it to do production alone, or one demo space first. A filter narrows the runnable set but cannot widen it — naming a refused space still refuses it. A filtered run writes its skip report to `…create-missing-skipped.partial.json`, so it cannot be mistaken for the full one the deletion script reads. |
| `CURRICULUM_ROOT=` | 2 | root of a `clue-curriculum` checkout, used to validate demo curriculum positions. Default `~/Development/clue-curriculum`. |
| `PORTAL=` | 2 | portal consulted for an `authed/` offering's curriculum position when no sibling document has it. Default `https://learn.concord.org`. |
| `DATABASE_URL=` | all | override the realtime-database URL chosen from the credential's project. |
| `REPORT=` | 4 | read a different skip report. |
| `RETENTION_DAYS=` | 4 | age below which a document is refused. Default 365. |
| `MAX_REPORT_AGE_HOURS=` | 4 | how stale a report may be before the run refuses. Default 24. |
| `TYPES=` | 5 | comma-separated subset of the offering-contained types to scan, for sampling. Default all. |
| `PAGE_SIZE=` | 5 | Firestore query page size. Default 300. |

### Reading the output

**Judge a run by its per-space and per-type lines, not by the totals.** Each space prints one line per
bucket and then a breakdown per document type. The per-type breakdown is what catches a type nobody
expected — it is how the 108 deprecated `section` documents were found, which would otherwise have been
written onto the wrong container axis.

`create-missing-document-metadata.ts` writes every document it declined to
`scripts/output/create-missing-skipped.json` (gitignored — it names real classes and users). That file
is the deletion script's input.

Counts to read carefully:

- **`written`** is incremented only after a commit resolves, so it understates rather than overstates
  a crashed run. If a run dies, both repairs still print their counts and attach them to the error.
- **`appearedDuringRun`** means a client created the metadata document while the sweep was running.
  Those are left alone, not overwritten.
- **`deletedDuringRun`** (step 5) means a document was deleted between the scan and the write. It is
  not recreated.
- **`ownerIsTeacher`** counts metadata documents created for a teacher's document. Their `network`
  cannot be reconstructed and is written as null, so cross-network visibility is not restored.
- **`unsupportedType`** is a refusal, not a failure. The document's type is on neither container
  allowlist, so which axis it belongs on is unknown.

## What these scripts refuse to do

Each refusal exists to prevent a write that would make things worse. None of them is a filter that can
be turned off.

- **`qa` and `dev` spaces**, in steps 1–4. `delete-qa-user-data.ts` purges their realtime-database
  side while leaving Firestore metadata behind, so every document there reads as damaged by
  construction. The backfill still scans them, since it only writes an `offeringId` it actually
  finds in the realtime database; expect most `qa` documents to show up as `noMetadataNode`.
- **A metadata node whose content is gone.** Creating one would promote an invisible orphan into a
  Sort Work entry that throws when opened.
- **A key absent from the realtime database.** These are Firestore-native metadata documents; a
  `documentMetadata` lookup on them is meaningless.
- **A key that appears under two homes.** "The class this document lives in" has no answer, so the key
  is dropped from the index rather than resolved to whichever home was seen first.
- **A key containing `.`, `#`, `$`, `[`, `]`, `/` or an ASCII control character.** These cannot
  appear in a realtime-database path, and a lookup on one throws.
- **A type on neither container allowlist** — `section`, `group`, `axes`, `drivingQuestionBoard`. See
  `kClassContainedTypes` in `create-missing-document-metadata.ts` for why each is refused.
- **An offering-contained document whose unit, investigation and problem cannot all be established.**
  Partial positions are not written.
- **Deleting for any reason other than the three that mean "unreachable debris"**, and never in
  `authed/learn_concord_org`, and never a document created within the retention window.

## Group canonical pointers

`backfill-group-canonical-pointers.ts` (step 6) gives every group document's slot a canonical pointer at the path the app reads, which is what lets the app stop looking up older
group documents by query (`findLegacy` in `src/lib/db.ts`). Group documents from before 7.3.0 have no
pointer at all, and those from 7.3.0 and 7.4.0 have one at a path those releases used and the app no
longer reads.

For each slot (one class, offering and group) it keeps the document the pointer names, or when there is
no pointer, claims the one `findLegacy` would pick: the lowest document id. Every other group document
in the slot is deleted from both databases, including its `comments` and `history` subcollections, and
so is every 7.3.0 or 7.4.0 pointer in the slot, leaving the current pointer as the only one. Before
deleting a document it re-reads it, and stops the run unless it is still a group document of that slot.
Group documents have not yet been used by real classes, so this deletes leftovers the app could still
open from Sort Work; the script's header gives the reasoning. Each one is copied first to
`scripts/output/group-pointer-backfill/<run time>/`, as a convenience rather than a restore procedure.
It covers `authed` and `demo` spaces, including `authed/learn_concord_org`, and reports rather than
touches a slot it cannot confidently address.

Its dry run should report no document skipped for a missing `context_id`, `offeringId` or `groupId`
before it is applied. A second dry run after an apply run should report nothing to claim, no duplicates
and no legacy pointers to delete.

## Design

[docs/superpowers/specs/2026-08-20-clue-643-metadata-repair-design.md](../../docs/superpowers/specs/2026-08-20-clue-643-metadata-repair-design.md)
covers why the field set is what it is, what the production census found, and the arguments behind the
refusals above.
[docs/superpowers/specs/2026-08-13-clue-643-document-offering-id-backfill-design.md](../../docs/superpowers/specs/2026-08-13-clue-643-document-offering-id-backfill-design.md)
covers the `offeringId` backfill.
