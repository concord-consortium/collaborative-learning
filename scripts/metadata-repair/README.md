# Firestore document metadata repair

Three one-off scripts that reconcile Firestore document metadata with the realtime database, plus the
modules they share. Written for CLUE-643.

Two defects motivated them, both now fixed in the client, so these are a repair rather than something
that runs on a schedule:

1. **`context_id` names the wrong class** on some metadata documents — 35 in production.
2. **The metadata document is missing entirely** for realtime-database documents that have one —
   around 5,600 across all real spaces. A document without one is invisible to Sort Work, to the
   class dashboard, and to every other Firestore-driven view.

| script | what it does | writes to |
|---|---|---|
| `repair-document-context-id.ts` | rewrites `context_id` to the class the document actually lives in | Firestore |
| `create-missing-document-metadata.ts` | creates the missing metadata documents | Firestore |
| `delete-unrepairable-documents.ts` | removes the residue the repair cannot fix | realtime database |

## Before you start

- **`scripts/serviceAccountKey.json`** — see [the scripts README](../README.md). The key's project
  decides which environment you are pointed at; `create-missing-document-metadata.ts` prints the
  project and database URL at startup, so read those two lines before trusting a run.
- **`scripts/.env` with `PORTAL_ACCESS_TOKEN`** — only needed by
  `create-missing-document-metadata.ts`, and only for `authed/` spaces, where an offering's curriculum
  position is resolved through the portal. Also in [the scripts README](../README.md).
- **`npm --prefix scripts install`** if this is a fresh worktree. `scripts/` has its own
  `package.json` and `node_modules`.

## Order

This matters, and it is not the order the scripts are listed in.

```
1. repair-document-context-id.ts        (either order with 2)
2. create-missing-document-metadata.ts
3. re-run 2 as a dry run                 regenerates the skip report
4. delete-unrepairable-documents.ts      reads that report
```

**1 and 2 are independent** and may run in either order.

**Both must run before `backfill-document-offering-id.ts`**, which finds a document's realtime-database
node through its `context_id` — a wrong one makes the document look unrecoverable, and one that does
not exist yet cannot be scanned at all.

**The deletion runs last, against a report regenerated after the repair.** Not because the deletion is
riskier in itself, but because a document lands in the residue for reasons that are not all
deterministic: 330 of the ~573 unresolved documents get their curriculum position from a portal API
call, so an outage, a rate limit or an expired token would bucket them as unresolvable. Deleting from a
report produced after the repair actually ran means the residue is confirmed rather than predicted. The
script refuses a report more than 24 hours old for the same reason.

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
```

### Environment variables

| variable | applies to | meaning |
|---|---|---|
| `APPLY=1` | all | perform the writes or deletions. Absent means dry run. |
| `SPACES=` | 1, 2 | comma-separated space labels, e.g. `demo/CLUE,authed/learn_concord_org`. Use it to do production alone, or one demo space first. A filter narrows the runnable set but cannot widen it — naming a refused space still refuses it. A filtered run writes its skip report to `…create-missing-skipped.partial.json`, so it cannot be mistaken for the full one the deletion script reads. |
| `DATABASE_URL=` | all | override the realtime-database URL chosen from the credential's project. |
| `REPORT=` | 4 | read a different skip report. |
| `RETENTION_DAYS=` | 4 | age below which a document is refused. Default 365. |
| `MAX_REPORT_AGE_HOURS=` | 4 | how stale a report may be before the run refuses. Default 24. |

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
- **`ownerIsTeacher`** counts metadata documents created for a teacher's document. Their `network`
  cannot be reconstructed and is written as null, so cross-network visibility is not restored.
- **`unsupportedType`** is a refusal, not a failure. The document's type is on neither container
  allowlist, so which axis it belongs on is unknown.

## What these scripts refuse to do

Each refusal exists to prevent a write that would make things worse. None of them is a filter that can
be turned off.

- **`qa` and `dev` spaces.** `delete-qa-user-data.ts` purges their realtime-database side while leaving
  Firestore metadata behind, so every document there reads as damaged by construction.
- **A metadata node whose content is gone.** Creating one would promote an invisible orphan into a
  Sort Work entry that throws when opened.
- **A key absent from the realtime database.** These are Firestore-native metadata documents; a
  `documentMetadata` lookup on them is meaningless.
- **A key that appears under two homes.** "The class this document lives in" has no answer, so the key
  is dropped from the index rather than resolved to whichever home was seen first.
- **A key containing `.`, `#`, `$`, `[`, `]` or `/`.** These cannot appear in a realtime-database path,
  and a lookup on one throws.
- **A type on neither container allowlist** — `section`, `group`, `axes`, `drivingQuestionBoard`. See
  `kClassContainedTypes` in `create-missing-document-metadata.ts` for why each is refused.
- **An offering-contained document whose unit, investigation and problem cannot all be established.**
  Partial positions are not written.
- **Deleting for any reason other than the three that mean "unreachable debris"**, and never in
  `authed/learn_concord_org`, and never a document created within the retention window.

## Design

[docs/superpowers/specs/2026-08-20-clue-643-metadata-repair-design.md](../../docs/superpowers/specs/2026-08-20-clue-643-metadata-repair-design.md)
covers why the field set is what it is, what the production census found, and the arguments behind the
refusals above.
