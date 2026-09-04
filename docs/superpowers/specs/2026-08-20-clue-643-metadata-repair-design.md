# Repairing Firestore document metadata against the realtime database — design

**Jira:** CLUE-643, steps 2 and 3. **Branch:** `CLUE-643-metadata-repair`, based on master, independent
of `CLUE-643-document-offering-id-backfill`.

Two repairs, both driven by an index built from the realtime database:

1. **Repair `context_id`** on metadata documents whose stored class disagrees with the class the
   document actually lives in — 35 in production, roughly 8 elsewhere.
2. **Create the missing metadata documents** for realtime-database documents that have none — 6,240
   across all real spaces, of which 4,996 are in demo spaces.

The cause is closed (CLUE-647), so this is a one-time repair rather than a mop.

Repair 2 cannot fix everything it finds. A third script deletes that residue — see **Deleting what the
repair cannot fix** below.

## Three scripts over a shared index

The index is the expensive part and both repairs need it, so it becomes a module rather than being
built twice:

```
scripts/lib/rtdb-document-index.ts           shared: walk a space, produce the index
scripts/lib/repair-cli.ts                    space selection, database URLs, the retrying reader
scripts/lib/curriculum-position.ts           decode an offering id, validate against content.json
scripts/lib/document-tools.ts                derive `tools` from content, as the client does
scripts/lib/deletion-plan.ts                 what a deletion run may remove, and why it refuses the rest
scripts/repair-document-context-id.ts        repair 1
scripts/create-missing-document-metadata.ts  repair 2
scripts/delete-unrepairable-documents.ts     the residue repair 2 cannot fix
```

Separate scripts rather than one with modes, because the three have different risk profiles — one
rewrites a field on an existing row, one creates rows, one deletes realtime-database nodes — and an
operator will want to run and judge them separately.

The two repairs are independent of each other and may run in either order. Both must run **before**
`backfill-document-offering-id.ts`, which resolves a document's `offeringId` through its `context_id`
and therefore mis-reports documents whose `context_id` is wrong or whose row is absent. The deletion
runs last of all — see **Order** under the deletion section.

## The index

For one space, walk `classes` → `users` and read **both** child lists per user-class pair:

```
<rtdbRoot>/classes/<classHash>/users/<uid>/documents/<key>          -> content
<rtdbRoot>/classes/<classHash>/users/<uid>/documentMetadata/<key>   -> metadata
```

producing `key -> { classHash, uid, hasContent, hasMetadata }`.

Reading the content list as well as the metadata list is what makes the `-B-` skip rule below
possible, and it is the gap that hid a whole population from the first census. It doubles the shallow
reads — about 21,700 for production, seconds for a demo space.

Use shallow REST reads (`GET <host>/<path>.json?shallow=true&access_token=<token>`), not the admin
SDK's `.once("value")`, which would pull whole subtrees. Get the token from
`credential.getAccessToken()` and refresh it on an interval for long runs. Pool at 40 concurrent
requests. URL-encode each path segment — `authed/localhost:3000` is a real space.

**Assert that each key maps to a single home** and report violations rather than assuming. All 116,000
production keys were distinct, but that is a finding about one space, not a guarantee.

## Space enumeration

Both scripts run over every real space, not just production. Demo is five-sixths of the repair
population, so a production-only run would leave most of the work undone.

Enumerate spaces from Firestore (`<appMode>` collection → space documents), then map each to its RTDB
root. The portal segment is in the RTDB path but not the Firestore path:

| Firestore | RTDB root |
|---|---|
| `authed/<portal>/documents` | `authed/portals/<portal>` |
| `demo/<name>/documents` | `demo/<name>/portals/demo` |

**Skip `qa` and `dev` entirely.** `scripts/delete-qa-user-data.ts` purges their realtime-database side
while leaving Firestore metadata behind, so every document there reads as damaged by construction and
nothing there is repairable. `test` has no spaces. This must be a refusal, not a default — a `qa` run
would try to create thousands of metadata rows for content that no longer exists.

## Repair 1 — `context_id`

For each Firestore document whose key is in the index: if `context_id` differs from the indexed
`classHash`, write the indexed value.

Drive this from the index, **not** from the legacy `contextId` field. Of the 35 production mismatches,
25 carry a legacy `contextId` equal to the true home and 10 carry the placeholder `"ignored"` — copying
the legacy field would fix 25 and silently leave 10 looking correct.

Also compare `uid` against the indexed uid and **report** disagreements without fixing them. That axis
was never analysed, and a wrong `uid` is a different bug with different consequences; surfacing it
costs nothing and guessing at it could do harm.

## Repair 2 — create the missing rows

For each indexed key with content and no Firestore row, create one from the realtime-database node.

The 2026-08-25 dry run over every space: **5,682 rows to create**, 119,819 already present, 665
skipped. The 6,240 above was the earlier census, taken before the skip rules existed and before the
population had another few weeks to grow; 5,682 creatable plus 665 refused is the number that matters.

The starting point is the field set `DB.createFirestoreMetadataDocument` writes (`src/lib/db.ts`):
`type`, `createdAt`, `network`, `key`, `properties`, `uid`, `title` where present, plus the owner and
location fields. Read `getDocumentLocationFields` in `src/models/document/document-kinds.ts` for which
fields each kind carries — but do not import from `src/`; the scripts stay standalone, as the
offeringId backfill does.

That set is necessary and not sufficient, which a census of all 114,882 production rows established
(2026-08-25). Two fields the client never writes at creation belong on these rows anyway:

**`visibility` and `tools`.** Both are maintained by `useDocumentSyncToFirebase`
(`src/hooks/use-document-sync-to-firebase.ts`), whose `updateFirestoreDocumentProp` finds rows by
query and calls `update()`. With no row to match, every visibility toggle and every content save these
documents ever had wrote nothing at all — which is why the census shows both fields decaying on recent
rows while the client still faithfully writes them. Waiting for the owner's next edit is not realistic
for a document last touched years ago, and `tools` decides how Sort Work groups a document: without it
all 5,682 file under "No Tools".

`visibility` comes straight off the node. `tools` is derived from the document's content the way the
client derives it — unique tile types, plus "Sparrow" for arrow annotations — in
`scripts/lib/document-tools.ts`, which exists to be diffed against the client's copy.

The content read is the run's only read of the largest node in the database, so it happens **last**,
after every skip check: the documents a run declines never pull content. It cost about 7 minutes on
top of a 12-minute sweep.

A node with no `content` key is a document created and never saved — it has no tiles, and `tools: []`
says so. Only content that will not parse yields no field at all, because `[]` there would assert an
emptiness the run never established. Across all 5,682 documents, zero fell into that case.

**`strategies` is deliberately absent**, though most existing rows have it. `on-document-tagged`
recomputes it from the comments subcollection *of the metadata row*, so a document with no row can
have no comments and nothing to derive. It fills in the first time a teacher tags one.

Two fields on many existing rows are also deliberately absent. `teachers` is a denormalized
class-teacher list that `firestore.rules` uses only as a fallback for "legacy documents which contain
their own list"; the live path resolves teachers from `context_id`. And `contextId` — camelCase,
distinct from `context_id` — holds the literal string `"ignored"` in 130 of 130 sampled rows. It is
the dead field from the deleted v1 comment path, the same one repair 1 refuses to trust.

**Curriculum fields.** Offering-contained types (`problem`, `planning`, `publication`,
`supportPublication`) need `offeringId`, `unit`, `investigation`, and `problem`. The realtime-database
node carries `offeringId` directly. For the other three, resolve in this order:

1. **Copy from a sibling.** Query Firestore for any existing document with the same `offeringId` and
   take its `unit`/`investigation`/`problem`. Cheap, needs no network, and almost always succeeds — an
   offering with one document usually has many.
2. **Fall back to the portal API** via `fetchPortalOffering` and `getProblemDetails` in `scripts/lib/`,
   as `find-documents-missing-metadata.ts` already does. `fetchPortalOffering` returns an
   `activity_url` such as `https://collaborative-learning.concord.org/?problem=1.3&unit=s%2Bs`, and
   `getProblemDetails` parses `unit` from it and splits `problem` into investigation and problem. It
   is one network round trip per distinct offering, so cache by `offeringId` — the 932 offering-
   contained missing documents in production cover far fewer offerings than that.
3. **Report and skip** if neither resolves. Do not invent values, and do not write the row with the
   fields absent — that would hand it to the offeringId backfill as new work.

Class-contained types (`personal`, `learningLog`, `personalPublication`, `learningLogPublication`)
have no curriculum position, so none of the above applies to them. They are 45 of the 1,244 in
production and a larger share in demo.

They still get **`unit: null`** — written explicitly, not left out. Sort Work finds them with
`.where("unit", "==", null)` (`src/models/stores/sorted-documents.ts`), and Firestore cannot match a
field that is absent, so a row without it is invisible under every filter but "All". All 19,649
class-contained rows in production carry it, and the client's `class` container stamps it. This is the
one place where "omit what you don't know" is the wrong instinct: null here is a value meaning "not
about a unit", not an absence.

**`title` comes from the node, where it is reliably present.** Of the 312 missing production documents
whose type stores a title, **311 carry one** on their `documentMetadata` node. The exception is a
single `personal` document. Stamp `title` only when present, as `DB.createFirestoreMetadataDocument`
does, so Firestore never sees `title: undefined`.

### Publication types need a second source

A publication's `documentMetadata` node is missing fields the Firestore schema has, and those fields
live in the publication list instead. The two list shapes differ, and a script must read both:

| type | list path | where the document key is | fields beyond the node |
|---|---|---|---|
| `publication` | `classes/<class>/offerings/<offeringId>/publications` | `documentKey`, **top level** | `groupId`, `pubVersion`, `userId` |
| `personalPublication`, `learningLogPublication` | `classes/<class>/personalPublications`, `classes/<class>/publications` | `self.documentKey` | `originDoc`, `pubVersion`, `properties`, `uid` |

All three publication-type documents missing rows in production do have a list entry, so this is a
usable source rather than a hope.

**Only `originDoc` is taken from these lists**, and only for `personalPublication` and
`learningLogPublication`. The list also offers `groupId`, and an earlier draft of this design argued
for copying it because `IDocumentMetadata` declares it. Checking the data killed that: exactly **1 of
114,763** production rows carries `groupId`, and the two fields do not mean the same thing. In the
publication list it names the group that *published* the document; in Firestore it is an owner-axis
field meaning the document *belongs to* that group. Copying it would make every published document
read as group-owned. The declaration was not evidence, and the axis reading is the one that matters.

`originDoc` earns its place on the same test: 296 of 296 learning-log publications and 238 of 295
personal publications carry it, against 0 of 14,325 problem publications — which is why a problem
publication is deliberately excluded from the origin-doc lookup.

`pubVersion` and `userId` appear on no Firestore document at all; do not invent places for them. See
the never-mirrored field table in [firestore-migration.md](../../document-metadata/firestore-migration.md).

Entries are keyed by their own push id, so finding one means scanning the list for a matching document
key. The lists are small — one and two entries in the production cases — and cache per class or
offering, since documents share them.

## Skip rules

These are refusals, not filters — each one prevents a write that would make things worse.

**No content, metadata only (`-B-`) — never create a row.** 86 such documents exist outside production,
all from 2021, 83 of them `personal`. Their content is gone. Giving them metadata would promote an
invisible orphan into a Sort Work entry that throws when opened.

**Key absent from the realtime database (`--C`) — never touch.** 7 in production, 1,082 elsewhere.
These are `mcsupports`-style Firestore-native rows plus curriculum documents; they never had a
realtime-database node, so a `documentMetadata` lookup on them is meaningless. Report them.

**Content with no metadata anywhere (`A--`) — out of scope.** 6 documents in the whole database. A
script indexing from `documentMetadata` cannot see them, and six is small enough to handle by hand.

**Keys that are not realtime-database-addressable.** A key containing `.`, `#`, `$`, `[`, `]`, or `/`
cannot appear in an RTDB path and any lookup on it throws. `isRtdbAddressable` in
`backfill-document-offering-id.ts` already encodes this; lift it into the shared lib rather than
duplicating it.

## Safety and reporting

Follow `backfill-document-offering-id.ts`, which is the template these should match:

- **Dry run by default**, `APPLY=1` to write. Print the mode at startup.
- **Batch at 400 writes**, and increment `written` only after a commit resolves, so a crash cannot
  overstate what landed.
- **Per-space and per-type counts** for every bucket, including the skipped ones. Judge a run by the
  per-space lines, not the totals.
- **Report on crash** as well as on success, so a killed run still says what it did.
- **`SPACES=` to limit the run** to named spaces, for staged rollout — production alone, or one demo
  space first.

Repair 2 writes to documents that do not exist yet, so it cannot clobber anything. Repair 1 overwrites
a field on live rows; it should log every before/after pair at 35-odd documents, which is small enough
to read in full.

## Deleting what the repair cannot fix

The skip rules above leave a residue: documents repair 2 will not write a row for, and which therefore
stay invisible to Sort Work, to the class dashboard, and to every Firestore-driven view. They are not
harmless — they are realtime-database nodes no product surface can reach.

The 2026-08-25 dry run over every space put that residue at 665 documents:

| reason | count |
|---|---|
| `unresolvedCurriculum` — no sibling, no portal answer, no decodable offering id | 573 |
| `skippedNoContent` — a metadata node whose content is gone | 86 |
| `nodeUnreadable` | 6 |

None was created in the past year; the newest dates from 2025-04-25, and 455 of the 665 predate 2023.
Three sit in production and the rest in demo spaces. So the residue is debris, and deleting it is
cheaper and more honest than carrying 665 unreachable nodes forward.

```
scripts/lib/deletion-plan.ts               what a run may remove, and why it refuses the rest
scripts/delete-unrepairable-documents.ts   performs the deletion
```

The plan is a separate module from the script that acts on it so the rules can be read and tested
without a database. Every rule refuses rather than adapts:

- **`authed/learn_concord_org` is never touched**, under any flag. Its three entries are content with
  no metadata node — student work rather than demo debris — and want looking at individually.
- **Nothing created inside the retention window** (a year by default, `RETENTION_DAYS` to change it).
  A document still in use is not debris, whatever the repair could not work out about it.
- **Nothing whose realtime-database path cannot be derived** — an unaddressable key, or a space with no
  realtime root. A guessed path is worse than a skipped document.
- **Nothing that names no node to delete**, which would otherwise be a silent no-op counted as success.

Two things the deletion inherits rather than invents: it reads the skip report a dry run writes
(`scripts/output/create-missing-skipped.json`) rather than re-deriving the residue, and it is dry-run
by default with `APPLY=1` to act, like the repairs.

`scripts/output/` is gitignored as a directory rather than by filename. These reports name real classes
and users, so the default has to be "not committed" for anything a run writes, including reports added
later.

Two things specific to it:

- **Content is deleted before metadata.** An interrupted run then leaves a document the same report
  would classify the same way next time, rather than one that has changed category underneath it.
- **Every document is re-checked against the live database immediately before removal** — Firestore for
  a row that has since appeared, the realtime database for a node already gone. A stale report cannot
  cause a wrong deletion; it can only cause a skip, which the run reports.

It never writes to Firestore, because by definition these documents have no Firestore row.

**Order.** Run the deletion last: repair 2 first, then re-run its dry run, then delete from the report
that reflects post-repair reality.

Deleting first is tempting — why repair documents that are about to go? — but it buys nothing and
costs safety. It buys nothing because the deletion's input *is* a repair dry run, so both orders are
three passes over the data; and because the two sets are disjoint, so the residue is never work the
repair would otherwise do.

It costs safety because a document lands in the residue for reasons that are not all deterministic.
330 of the 573 unresolved-curriculum documents are in `authed/` spaces, where the curriculum position
comes from a call to the portal. A portal outage, a rate limit, or a rotated token buckets those
documents as unresolvable, and a deletion run driven by that report would destroy documents a later
run could have repaired. (No portal lookup failed in the 2026-08-25 sweep, so this is a hazard rather
than an observation — but it is one bad afternoon away from being an observation.)

Deleting last means the residue was confirmed by the repair that actually ran rather than predicted by
one that might not. It also gives a free check: if the pre- and post-repair reports name the same
documents, the residue is stable, and that agreement is worth having before anything irreversible.

Tested against the same mock-and-fixture approach as the repairs. The cases that matter: both nodes
planned when both halves exist; only the surviving half planned when one is gone; a protected space
refused; a document inside the retention window refused; a document with no `createdAt` still deletable
outside a protected space; an unaddressable key refused; an entry naming neither half refused; an
`authed` space's paths built from its portal root.

## Testing

Unit tests against a mock Firestore and a mock realtime database, as
`scripts/backfill-document-offering-id.test.ts` does. The cases that matter:

- a mismatch driven by the index where the legacy `contextId` says something different
- a mismatch where the legacy `contextId` is `"ignored"`
- a document whose key is absent from the index — untouched
- a key with metadata but no content — no row created
- a key with content but no metadata — not seen, and not created
- an offering-contained document whose curriculum fields come from a sibling
- an offering-contained document with no sibling and no portal answer — reported, not written
- a class-contained document: an explicit null `unit`, and no offeringId or curriculum fields
- a document whose node carries `visibility` — copied; and one that does not — left off
- tools derived from content, including a never-saved node (`[]`) and unparseable content (no field)
- a key mapping to two homes — reported as a violation
- batch-tail behaviour: a commit that fails does not increment `written`
- a `qa`/`dev` space — refused

## Portal credentials

`fetchPortalEntity` reads `PORTAL_ACCESS_TOKEN` from `scripts/.env`, loaded by `scripts/lib/dot-env.ts`.
`scripts/README.md` documents the process: the token belongs to the portal's `admin_api_user` and lives
in 1Password, Developer Admin vault, under "Learn Portal admin api user". `.env` is gitignored
(`.gitignore:7`).

Verified working against production on 2026-08-20 — two live offerings returned HTTP 200 with the
`activity_url` the parse depends on. So the fallback is a real path, not a speculative one, and its
tests can exercise the parse against a recorded response.

Note that `scripts/` carries its own `package.json` and `node_modules`, which a fresh worktree will not
have installed. `npm --prefix scripts install` before running anything that imports `dotenv`.

## Open questions

None outstanding. Both questions this design opened with were settled against production on 2026-08-20:
`title` is present on 311 of 312 nodes that should carry it, and publication list entries do carry
schema fields the node lacks — both written up above.

One thing to watch rather than resolve: the demo spaces hold 77 publication-type documents needing
rows against production's 3, and the list-shape finding rests on those 3. Report per-type resolution
counts on the first demo dry run rather than assuming the shapes generalize.
