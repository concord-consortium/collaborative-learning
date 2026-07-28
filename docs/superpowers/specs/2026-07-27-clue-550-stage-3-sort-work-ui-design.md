# CLUE-550 Stage 3 — Sort Work + workspace UI for class-wide documents — Design

> **Status:** Design spec for this PR. Self-contained: it describes exactly what this PR delivers and cites only
> docs already in the repo.
>
> **Where this fits.** Stage 1 landed the two stored axes (`concurrent`, `kind`) and rebased group-document
> *behavior* onto them
> ([2026-07-23-clue-550-stage-1-document-axes-design.md](2026-07-23-clue-550-stage-1-document-axes-design.md)).
> Stage 2 made the app auto-create a class-wide collaborative document — the Driving Question Board (DQB) is the
> default slot — exactly once per class per unit, with **no UI**
> ([2026-07-23-clue-550-stage-2-class-wide-slots-design.md](2026-07-23-clue-550-stage-2-class-wide-slots-design.md)).
> Stage 3 makes those documents **visible, sectioned, titled, and editable**. The roadmap lives at
> [../../document-axes/README.md](../../document-axes/README.md).
>
> **Builds on:**
> - **Stage 1** — the stored `concurrent`/`kind` axes and the kind registry.
> - **Stage 2** — class-wide slot declaration (`classWideDocuments`), registry-derived owner/scope at creation,
>   and title resolution by kind (`getDocumentTitle`).

## Summary — what this PR delivers

1. **Scope guards** — two named predicates over the stored association fields (`hasGroupScope`,
   `hasClassUnitScope`) in a new leaf module. This resolves the scope-modeling checkpoint the project deferred to
   its richest consumer: **narrow named guards, no `scopeLevel` enum and no unified `scope` struct.**
2. **Explicit-null scope fields for the `classUnit` scope**, so "scoped to a unit but not to a problem" is
   directly queryable, following the convention that a scope field written as `null` means *absent scope* —
   with a backfill pass added to Stage 1's one-shot script for documents created before the change.
3. **A unit-scoped Sort Work listener** so class-wide documents survive the Investigation and Problem filters —
   a scope-driven query naming neither `type` nor `kind`.
4. **Sectioning by scope** — `byGroup` puts class-scoped collaborative documents in a "Whole Class" section
   ahead of the numbered groups; `byName` puts them in a "No Name" section. `byGroup` ordering now comes from a
   structured sort key rather than parsing the section label (a slice of review issue #7).
5. **Presentation off the axes** — the workspace title bar and the thumbnail treatment stop branching on
   `type === "group"` and read `concurrent`, with the title resolved from the `kind` registry.
6. **One shared edit predicate** (`canUserEditDocument`) used by both Sort Work and the resources pane,
   replacing the two inline gates (resolves review issue #4).
7. **History-write authorization for synthetic document owners**, established by an emulator test first.

The stored `type` value stays `"group"` (the Stage 1–3 transitional convention). Retiring it is Stage 4.

## The scope-modeling checkpoint, resolved

The project deliberately deferred the question "does scope need a helper at all, and if so what shape?" to the
stage with the most scope consumers. Stage 3 is that stage. Working through its five consumers shows that only
one of them needs to know anything about scope:

| Consumer | Branched on today | What it actually asks |
|---|---|---|
| Workspace title bar (`document.tsx`) | `document.isGroup` | `kind` → registry presentation |
| Thumbnail treatment (`thumbnail-document-item.tsx`) | `type === GroupDocument` | `concurrent` → collaborative styling |
| Edit gate (`sort-work-document-area.tsx`) | `uid === user.id` | `concurrent` + is the user inside the document's scope |
| Sort Work listener (`sorted-documents.ts`) | — | scope *breadth*: a unit-scoped document must survive a problem filter |
| `byGroup` / `byName` sectioning (`document-group.ts`) | `type === GroupDocument` | which cohort the document belongs to |

Four of the five are answered by an axis a consumer already has (`kind`, `concurrent`) or by the query it
already writes. No consumer needs a "this is a class-wide document" flag, and none is introduced — a
consumer that asked that question would be branching on identity again, which is exactly what this project
exists to remove.

**Decision: two narrow guards, no general scope model.** A new leaf module
`src/models/document/document-scope.ts` — structural parameter types only, no model imports, the same shape as
`document-kinds.ts`:

```ts
hasGroupScope(doc)     = !!doc.groupId
hasClassUnitScope(doc) = !!doc.unit && !doc.investigation && !doc.groupId
```

These read only stored association fields — no `type`, no `kind`, no `concurrent`. That matters for a real case:
under the "All" filter Sort Work lists documents from *other* units of the same class, and a class-wide document
from another unit has a `kind` that was never registered in this session (kinds are registered when the current
unit loads). A registry lookup would silently misfile it; a field read cannot.

`hasClassUnitScope` is unambiguous across every document shape CLUE stores today, which is why it needs no
`concurrent` or `type` term to disambiguate:

| document | `unit` | `investigation` | `groupId` | matches? |
|---|---|---|---|---|
| personal, learning log | `null` | — | — | no (`unit` is null) |
| problem, planning, publications | set | set | — | no (has `investigation`) |
| group | set | set | set | no |
| exemplar (from curriculum) | set | set | — | no (has `investigation`) |
| class-wide slot | set | `null` | — | **yes** |

`docs/document-scope.md` gains a section recording these guards, the table above, and the decision not to
introduce a `scopeLevel` enum — with the reasoning that the existing scopes differ along more than one axis (a
personal document is class+owner scoped; a class-wide document is class+unit scoped), so a single ordered level
would be ambiguous.

## Making the scope queryable: explicit-null fields

The bottom row of that table is only true once the `classUnit` scope writes its absent curriculum fields
explicitly. `getDocumentScopeFields`'s `classUnit` case currently returns `{ unit, context_id }`, leaving
`investigation` and `problem` off the Firestore document entirely:

```ts
case "classUnit": return {
  unit: ctx.unit,
  context_id: ctx.context_id,
  investigation: null,   // added: absent scope, stated explicitly
  problem: null          // added
};
```

This follows the convention the rules already encode — `hasScopeField` in `firestore.rules` treats a
field written as `null` as *absent scope*, precisely because class-scoped documents (personal, learning log)
already store `unit: null`. Stamping the same way for `classUnit` makes the client read (`!doc.investigation`)
and the Firestore query (`where("investigation", "==", null)`) agree, and makes a class-wide document's stored
scope self-describing rather than defined by which fields happen to be missing.

### Backfilling existing documents

A class-wide document created before this change has neither field, so `hasClassUnitScope` still accepts it
client-side (a missing field is falsy just as `null` is) but the new Firestore query does not match it — it
would silently disappear from Sort Work under the Investigation and Problem filters. Class-wide documents are
unreleased, so only dev/QA partitions hold any, but the fix is cheap and the tooling already exists: Stage 1's
one-shot backfill script, `scripts/backfill-group-concurrent.ts` — renamed here to
`scripts/backfill-group-document-axes.ts` (see below).

Its collection-group query — `where("type", "==", "group")` — already returns exactly the right superset, since
group and class-wide documents share the transitional type. The script gains a second, independent pass over
the same snapshot:

| pass | selects | stamps |
|---|---|---|
| existing | `concurrent !== true` **and has a `groupId`** | `{ concurrent: true, kind: "group" }` |
| new | no `groupId`, and `investigation`/`problem` absent | `{ investigation: null, problem: null }` |

Both remain additive, idempotent, and batched, and `BackfillResult` grows a counter per pass so a dry run
reports each separately.

Two details worth stating:

- **The existing pass is narrowed to documents that have a `groupId`.** Today it stamps `kind: "group"` on any
  `type == "group"` document missing `concurrent`. A class-wide document is created with `concurrent: true`, so
  in practice it is already filtered out — but if one ever lacked the field it would be mis-stamped with the
  *group* kind, silently breaking its title and its canonical-pointer slot. Selecting on `groupId` makes the
  two passes select disjoint sets by scope rather than relying on a value that a partial write could leave
  missing. This is the same group-scope question `hasGroupScope` asks, expressed in the script.
- **The script is renamed to match what it now does.** `backfill-group-concurrent.ts` →
  `backfill-group-document-axes.ts`, with `backfillGroupConcurrent` → `backfillGroupDocumentAxes` and the test
  file renamed alongside it. It is no longer a one-field backfill: it normalizes the stored axes of every
  group-typed document, and a name naming only `concurrent` would misdirect the next person who needs to add a
  pass. Its header comment — which carries the dry-run/`APPLY=1` usage, since `scripts/README.md` documents
  only the shared setup and does not list individual scripts — is updated to describe both passes.

## The Sort Work query

Class-wide documents carry no `investigation` or `problem`, so the two filters that add those equality clauses
drop them:

| `docFilter` | existing filtered query | class-wide docs included? |
|---|---|---|
| All | `context_id ==` | yes |
| Unit | `+ unit in <variants>` | yes |
| Investigation | `+ investigation ==` | **no** |
| Problem | `+ investigation == , problem ==` | **no** |

`sorted-documents.ts` gains a third listener — a sibling of the existing `metadataDocsWithoutUnit` listener,
which exists for the same reason one level up (it picks up class-scoped personal documents when a unit filter is
applied):

```ts
// active only when the filter is "Investigation" or "Problem"
const queryForUnitScoped = baseQuery
  .where("unit", "in", this.curriculumConfig.getUnitCodeVariants(unit))
  .where("investigation", "==", null);
```

Its snapshot lands in a `metadataDocsUnitScoped` map, merged into `firestoreMetadataDocs` and deduped by key
alongside the other two maps, and its disposer joins the returned composite disposer.

The query names no `type` and no `kind` — it asks for documents scoped to this unit but not to a problem, which
is a question about scope breadth, not about what the document *is*. This is the concrete replacement for PR
#2890's `queryForDqb` (`where("type", "==", "drivingQuestionBoard")` plus client-side unit filtering). It is
equality-only, so Firestore serves it from single-field indexes with no composite index to add.

## Sectioning

### `byGroup`

```ts
if (hasGroupScope(doc))     return `${groupTerm} ${doc.groupId}`;
if (hasClassUnitScope(doc)) return kWholeClassSectionLabel;   // "Whole Class"
const group = this.stores.groups.groupForUser(doc.uid);
return group ? `${groupTerm} ${group.id}` : `No ${groupTerm}`;
```

Group scope is tested first: a group document has both a `groupId` and a `unit`, and the group question is the
more specific one. The final branch is unchanged — a document owned by a class user is filed under that user's
current group.

### `byName`

Class-scoped collaborative documents go to a "No Name" section, matching PR #2890. The class-wide document has
no personal author, and listing it under every class member (the way a group document is listed under each of
its group's members) would repeat one document across the entire list. "No Name" is a distinct label from the
existing "Unknown" bucket, which is used for a document whose owner is not in the class store. No change is made
to `sortNameSectionLabels`, so "No Name" sorts alphabetically among the student names, as in #2890.

### Sort keys instead of label parsing (part of review issue #7)

`sortGroupSectionLabels` currently recovers a group number by stripping non-digits from the display label
(`parseInt(a.replace(/^\D+/g, ''), 10)`). Adding a non-numeric "Whole Class" section makes that worse — #2890
had to special-case the label *string* inside the comparator, and any label whose text does not contain a number
sorts as `NaN`.

`byGroup` instead builds a side sort-key map alongside its document map and passes it to the comparator, exactly
as `byDate` already passes `docMapWithDates` to `sortDateSectionLabels` and `byProblem` already carries a side
`labelMap`:

```ts
type GroupSectionSortKey =
  | { scope: "class" }                        // Whole Class  — first
  | { scope: "group"; groupId: string }       // Group N      — numeric ascending
  | { scope: "none" };                        // No Group     — last

sortGroupSections(labels, sortKeyMap)   // class < group(asc) < none
```

**`label` remains both the display text and the section identity.** The sort key is used only for ordering.
That keeps three existing label-as-identity uses untouched and needs no migration of persisted state:

| Use | Where | Persisted? |
|---|---|---|
| which sections are expanded | `ui.expandedSortWorkSections` (array of labels) | no — session `ui` store |
| which section holds the open document | `persistentUI` tab state `currentDocumentGroupId` = JSON of `{primaryLabel, primaryType, …}` | **yes** |
| re-finding that section on render | `sortedDocumentGroups.findIndex(g => g.label === primaryLabel)` | reads the persisted value |

The rest of review issue #7 — that the open-document state round-trips section structure through a
JSON-stringified display label — is **not** addressed here and stays open. Replacing it means retyping
`IOpenDocumentsGroupMetadata` and touching `sorted-section`, `document-scroller`, `sort-work-view`, and
`persistent-ui`, which is larger than this feature and unrelated to class-wide documents.

## Presentation

Title resolution by `kind` already landed in Stage 2 (`getDocumentTitle` → `getDocumentDisplayTitle`). Stage 3
wires the two remaining presentation sites, and both of them turn out to be `concurrent` questions rather than
`kind` questions — a class-wide document and a group document *look* alike because they are the same kind of
thing; only their titles differ.

- **Workspace title bar** (`document.tsx`): `renderTitleBar`'s `document.isGroup` branch becomes
  `document.concurrent`, and `renderGroupDocumentTitleBar` becomes a collaborative title bar that takes its
  title from `getDocumentDisplayTitle(unit, document, appConfig)` — the registry lookup — instead of the
  hardcoded `` `Group ${document.groupId} Document` ``. The scss hook passed as `docType` becomes
  `document.kind ?? document.type`, so a group document still renders `.titlebar.group` with no style change,
  while a class-wide document gets a class named for its kind.
- **Thumbnail treatment** (`thumbnail-document-item.tsx`): `document.type === GroupDocument` becomes
  `!!document.concurrent` for the purple border and corner badge.

**Deliberate deviation from PR #2890:** its absolutely-positioned, full-width centered title for the DQB
title bar is not ported. It is cosmetic, and it would put `drivingQuestionBoard` in a stylesheet — a
kind-specific rule cuts against the project's requirement that adding another class-wide document be a
*configuration* change. This is the one intentional difference from #2890's UX and should be confirmed in the
parity check.

**No icon is authored.** Stage 2 removed the unused `icon` field from the `classWideDocuments` declaration and
left the question to this stage; nothing here needs one, so no icon field is added to the unit config or to the
kind registry. Adding one later is additive.

## The edit gate (review issue #4)

Two inline gates decide whether the Edit button appears:

```ts
// sort-work-document-area.tsx: only the user's own documents
const showEdit = openDocument?.uid === user.id;
// document-view.tsx: a tab check that stands in for "these tabs only show your own documents"
const showEdit = !openDocument.isRemote && ((tab === "my-work") || (tab === "learningLog"));
```

Both are replaced by one predicate in `document-utils.ts`, beside its sibling question
`isDocumentAccessibleToUser`, and taking the same `{ document, documentMetadata, user }` parameters:

```ts
canUserEditDocument({ document, documentMetadata, user })
  // own document                                    -> true
  // not concurrent                                  -> false
  // class-unit scope: context_id === user.classHash -> true   (any class member)
  // otherwise (group scope): groupId === user.currentGroupId
```

Fields are read preferring the reactive Firestore metadata and falling back to the lazily-fetched full document,
per field — the full document's `groupId` can still be undefined while a groupmate's document is loading, which
would otherwise hide the button until a reload.

`document-view.tsx` adopts it as `!openDocument.isRemote && canUserEditDocument(...)`. That is a real behavior
change beyond class-wide documents — a group document surfaced in the class-work tab becomes editable, and a
classmate's shared document remains non-editable — so it gets its own test coverage and its own line in the
manual check.

**Relationship to CLUE-525 / PR #2930.** That in-flight PR introduces the same rule for group documents as
`canEditSortWorkDocument` in `src/components/document/sort-work-edit-permission.ts`, with five loose primitive
parameters and the metadata merge spelled out at the call site. If it lands in the reshaped form (moved to
`document-utils.ts`, object parameters, the type test isolated behind a named `isCollaborativeDoc` local), this
stage's entire delta is inside the function body: swap that local for `!!concurrent` and add the class-scoped
arm. If it lands as originally written, this stage performs the move and reshape as part of resolving issue #4.
Either way the end state is the same file, name, and signature.

`DocumentModel`'s `metadata` getter does not currently include `context_id` (the model stores it as `contextId`,
from CLUE-576), so it is added there to let the document-fallback path answer the class-scoped arm.

## History-write authorization for synthetic owners

Concurrent documents write history entries to `documents/<key>/history/<entryId>`. That rule gates create and
read on `userOwnsDocument()`, which resolves through the **parent** document — `getDocumentPath()` builds
`.../documents/$(docId)` from the enclosing `match /documents/{docId}`, and `getDocumentOwner()` returns that
document's `uid`. `request.resource.data` — the entry being written — is never consulted, and the rules' helper
for that (`userIsRequestUser()`, used by the comments rules) is not applied here.

A class-wide document's owner is the synthetic `class_<classHash>`, which never equals a student's
`platform_user_id`. The same is already true of a group document's `group_<offeringId>_<groupId>`, so if this
denies history writes it denies them for group documents too — a pre-existing gap that has gone unnoticed
because group documents are unreleased and are exercised in permissive dev/QA partitions.

**This was established by an emulator test before anything was changed.** Five characterization tests were added
to the `history entries` block in `firebase-test/src/documents-rules.test.ts` and run against the Firestore
emulator (`firebase emulators:exec --only firestore "npm test"`). A class member's attempt to create a history
entry under a metadata document owned by a synthetic group (`group_myOffering_3`) or class-wide (`class_<hash>`)
owner **was denied** — `PERMISSION_DENIED` at the `create` rule for the group case, the class-wide case, and the
corresponding read. The two negative-control tests **passed** (a user outside the class, and a class member on a
classmate's single-writer document): their writes were correctly denied both before and after the fix, confirming
the axis under test — not just authentication — was what gated the positive cases.

Because the writes were denied, the rule was rebased onto the `concurrent` axis: create and read are now allowed
when the parent document carries `concurrent: true` and the requester's `class_hash` matches its `context_id`, in
addition to `userOwnsDocument()`. This continues Stage 1's pattern of rebasing rules onto `concurrent`, and covers
group and class-wide documents with one clause (`isConcurrentClassDocument()` in `firestore.rules`). It
deliberately does **not** narrow group-document history to the owning group: the auth token carries no group id,
so the rules cannot express that, and the RTDB rules already grant write on the whole `classes/<classHash>`
subtree, so this matches the existing write surface rather than widening it.

**Follow-up fix: `concurrent` is itself an authorization input, so its write path needed gating too.**
Code review on this change found that `concurrent` was not in `preservesReadOnlyDocumentFields()`'s read-only
set, and `isValidDocumentUpdateRequest()` lets any class member update any document in their class
(`resourceInUserClass()`). That combination let a class member forge the grant `isConcurrentClassDocument()`
checks: update a classmate's ordinary `problemDocument` with `{ concurrent: true }` — no read-only field is
touched, so the update was allowed — which then made that student, and every classmate, able to read and append
history on the classmate's private document. `type` is itself read-only, so it cannot be flipped first to route
around a `type == "group"` check placed elsewhere. A characterization test run against the pre-fix rules
confirmed the forgery: `expectUpdateToFail(db, kDocumentDocPath, { concurrent: true })` from a classmate's session
against another student's `problemDocument` failed with "Expected request to fail, but it succeeded."

The fix closes the escalation at the write path rather than narrowing the read path: a new `concurrentChangeOk()`
function (beside `preservesReadOnlyDocumentFields()` in `firestore.rules`) allows a change to `concurrent` only
when the stored document's `type` is `"group"`, and is wired into `isValidDocumentUpdateRequest()`. This is
transitional by design and is commented as such in the rules: two paths still merge-update `concurrent` onto
pre-existing group documents that predate the field — the on-open backfill in `src/lib/db.ts` and the one-shot
`scripts/backfill-group-document-axes.ts` — so it cannot yet be made unconditionally read-only. Once both backfill
paths have run against every environment, `concurrentChangeOk()` should be deleted and `concurrent` added to
`preservesReadOnlyDocumentFields()`'s read-only set, making it settable only at document creation — a change that
also requires constraining `isValidDocumentCreateRequest()` (firestore.rules:172-180), which today constrains
neither `concurrent` nor `uid`: a truthy `concurrent` at create should imply `type == "group"`, and/or the create
should require `userIsRequestUser()`, or a class member can create a new document stamped with a classmate's
`uid` and `concurrent: true`. That does not reopen the escalation closed above — a create cannot target an
existing document — but it leaves that vector open once the update-path allowance above is removed.

Re-running the full `documents-rules.test.ts` suite (120 tests, including every pre-existing history-entry and
document-update case) and the full `firebase-test` suite (366 tests across all 8 rule files) both passed after
the fix. The seven tests added across both fix rounds remain as the regression guard.

## Carried forward from Stage 2

Stage 2's whole-branch review flagged two items to verify before a slot is turned on. `src/public/demo/units/qa`
declares a `drivingQuestionBoard` slot, so they are live now.

- **Type-based enumeration leak** — a `type: "group"` document with no `offeringId`/`groupId` must not be picked
  up as an ordinary group document. Audited:
  - `documents.byType` / `byTypeForUser` are never called with `GroupDocument`; every call site names an
    exemplar, publication, personal, planning, or problem type.
  - The 4-up view resolves documents through group *users* (`getUserDocument`), not a type scan.
  - `document-group.ts`'s `byGroup`/`byName` were the real leak — a class-wide document landed in
    `Group undefined`. That is what this stage's sectioning fixes.
  - `tile-activity-badges.tsx` gates on `type === GroupDocument`, so a class-wide document passes it. The
    activity listener is group-scoped, so only same-group members' presence appears on a class-wide document —
    incomplete rather than incorrect, and exactly what Stage 4's unified class-scoped channel completes. No
    change here.
  - `document-workspace.tsx`'s `guaranteeInitialDocuments` re-opens a `type: "group"` primary document after a
    reload (group documents are not loaded automatically); a class-wide document restored as the primary
    document is covered by that same branch, which is the behavior we want.
- **Eager-open cost — measured.** `createDeclaredClassWideDocuments` runs on every unit load, including the fast
  path, and opens each declared slot's document into `stores.documents` (subscribing its history manager).
  Measured against `demo/units/qa` (one declared slot, `drivingQuestionBoard`) on a second load — the pointer
  and metadata documents already exist, so the fast path (`pointerRef.get()` then
  `openCanonicalDocumentByKey()`) runs — by timing `stores.unitLoadedPromise` resolving against the class-wide
  document appearing in `stores.documents.all`, in a real Chrome session against a live Firestore project
  (`collaborative-learning-ec215`). Two independent reloads: **670ms** and **730ms** (~700ms average) between
  the unit-loaded event and the document appearing. That crosses the "material" threshold this bullet set (more
  than a few hundred milliseconds), and confirms the reasoning below directly: the fast path is still two
  sequential round trips, not one.
  Read count could not be measured the way originally planned: the Firestore v8 SDK multiplexes every
  listener and one-time read for the whole page (persistent UI, curriculum, class/group listeners, this
  slot's pointer and metadata reads) over one shared long-polling WebChannel connection, so individual reads
  are not visible as separate Network-panel entries — only channel-level HTTP requests shared across
  everything else the page is doing at that moment. By code inspection (not empirical capture),
  `getOrCreateCanonicalDocument`'s fast path is `pointerRef.get()` (one read) followed by
  `openCanonicalDocumentByKey()` → `findFirestoreMetadata()` (a second read), i.e. two sequential reads per
  declared slot before the document opens — consistent with "a handful," but this half of the measurement is
  reasoned, not captured.
  **This is material and not fixed here, per the brief for this bullet: defer the open, not the
  get-or-create.** The get-or-create must still run at unit-load to converge the class on one document per
  slot; what should move is subscribing `stores.documents` and the history manager, which is what makes the
  700ms visible on the critical path today. Filed as a follow-up rather than folded into this stage.

## Roadmap update

[../../document-axes/README.md](../../document-axes/README.md), in this PR:

- `kind` → **done** — presentation now reads the registry (title in Stage 2, title bar here) and no consumer
  branches on kind.
- `scope` → stays **in progress**, with the read side recorded: narrow named guards (`hasGroupScope`,
  `hasClassUnitScope`) over stored association fields, and the checkpoint outcome that no `scopeLevel` enum or
  unified `scope` struct is introduced.
- behavior modules → the edit-gate predicate and the `concurrent`-driven presentation added to the list of
  behaviors reading axes rather than `type`; the history-write rule outcome recorded once known.

## Boundaries and non-goals

- **Presence is Stage 4.** The parallel group/class activity listener and broadcaster, the session/offering
  dimension (review issue #5), and unified activity badges are not touched.
- **The legacy type stays.** Documents still store `type: "group"`; flipping it to `"generic"` and removing
  `GroupDocument`/`isGroup` is the Stage 4 closing cleanup.
- **Read access still keys on `type`.** `isDocumentAccessibleToUser` continues to grant class-wide read via
  `metadata.type === GroupDocument`, which covers class-wide documents for free. Rebasing read access is
  deferred to the `permissions` axis, per Stage 1.
- **Review issue #7 is only partly addressed** — section *ordering* stops parsing labels; the persisted
  label round-trip does not change.
- **No general scope model.** Two guards, no enum, no struct.
- **No icon authoring surface.**

## Testing

- **Unit (Jest):** the two scope guards across every document shape in the table above; `getDocumentScopeFields`
  stamping `investigation: null`/`problem: null` for `classUnit` and nothing else changing for other scope types;
  `byGroup` sectioning (group scope → `Group N`; class-unit scope → `Whole Class`; owner's group; `No Group`) and
  its sort-key ordering (class first, groups numeric ascending, `No Group` last, non-numeric labels
  deterministic); `byName` filing a class-scoped document under `No Name`; the unit-scoped listener firing only
  under the Investigation/Problem filters, and its documents merging and deduping into `firestoreMetadataDocs`;
  `canUserEditDocument` across own / own-group / other-group / other-student / class-wide-as-class-member /
  class-wide-as-outsider / non-concurrent cases, including the per-field metadata-preferring merge with a
  still-loading document.
- **Backfill script (Jest, mock Firestore)** — the existing `backfill-group-concurrent.test.ts` cases carried
  over to the renamed `scripts/backfill-group-document-axes.test.ts`, plus: the new
  pass stamps `{ investigation: null, problem: null }` only on group-typed documents with no `groupId` that
  lack those fields; the existing pass stamps `{ concurrent: true, kind: "group" }` only on documents that
  *have* a `groupId`, so a class-wide document is never stamped with the group kind; the two passes select
  disjoint sets; both are idempotent (a fully-migrated set writes nothing) and a dry run writes nothing while
  reporting each pass's count.
- **Component:** the title bar rendering the registry title for a class-wide document and the unchanged
  `Group N Document` for a group document; the thumbnail collaborative treatment driven by `concurrent`.
- **Rules (emulator):** the synthetic-owner history-write test described above, plus whichever outcome it
  establishes.
- **Manual end-to-end — pending human verification.** This requires two browser profiles signed in as
  different students in one class, which is outside what an automated session can perform; it was not run as
  part of this task. On `demo/units/qa` (declares a `drivingQuestionBoard` slot), with two browser profiles
  signed in as different students in one class, verify:
  1. Sort Work shows a "Whole Class" section containing the class-wide document, under each of the All, Unit,
     Investigation, and Problem filters.
  2. Sorting by Name shows it under "No Name" and under no student.
  3. Its title is the one authored in `classWideDocuments`.
  4. Its thumbnail has the collaborative (purple/badge) treatment.
  5. The Edit button appears for both students; editing from one appears in the other.
  6. Opening it in the workspace shows the authored title in the title bar, not `Group undefined Document`.
  7. A group document's title, thumbnail, section, and Edit button are unchanged.
  8. In the resources pane: My Work and Learning Log still show Edit for the user's own documents; a
     bookmarked document owned by another student does not show Edit.
  Record any deviation here rather than silently fixing it.
- Full `npm test`, `npm run check:types`, `npm run lint:build`, and the `firebase-test` rules suite green.

## References

- Stage 1 design:
  [2026-07-23-clue-550-stage-1-document-axes-design.md](2026-07-23-clue-550-stage-1-document-axes-design.md).
- Stage 2 design:
  [2026-07-23-clue-550-stage-2-class-wide-slots-design.md](2026-07-23-clue-550-stage-2-class-wide-slots-design.md).
- Document-axes roadmap: [../../document-axes/README.md](../../document-axes/README.md).
- Scoping model this stage extends: [../../document-scope.md](../../document-scope.md).
- Key code sites: `src/models/document/document-scope.ts` (new), `src/models/document/document-kinds.ts`,
  `src/models/document/document-utils.ts`, `src/models/document/document.ts`,
  `src/models/stores/document-group.ts`, `src/models/stores/sorted-documents.ts`,
  `src/utilities/sort-document-utils.ts`, `src/components/document/document.tsx`,
  `src/components/document/sort-work-document-area.tsx`, `src/components/navigation/document-view.tsx`,
  `src/components/thumbnail/thumbnail-document-item.tsx`, `firestore.rules`,
  `scripts/backfill-group-document-axes.ts` (Stage 1's one-shot backfill, extended and renamed here).
