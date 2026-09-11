# Personal Document AI Evaluations Can Include Agreements (CLUE-607) — Plan

**Status:** implemented. The sections below are the plan as written; where the code that shipped differs from it, the DEVIATIONS section at the end is authoritative. Decisions are recorded under "Decisions". The work was done as the stopping-point steps under "Implementation order".

**Verified against:** master at `2be1c7d42`, as of 2026-09-04, which includes the CLUE-645 work. That is the commit branch `CLUE-607-personal-doc-ai-evaluations-agreements` starts from, and the code state every claim below was checked against.

**Related:** CLUE-370 (removed agreements from personal documents), CLUE-645 (fixed the agreements loop; design in `CLUE-645-ratings-to-summaries-design.md`), CLUE-660 (agreements with human comments, not started).

## Background

An "agreement" is a rating (`yes`, `no`, `notSure`) that a student gives to one of Ada's comments. CLUE-645 made this loop work again. Today it works like this:

1. The analysis pipeline reads a document's Firestore metadata record to get its class (`context_id`), `unit`, `investigation`, and `problem`.
2. It uses those fields to find summaries of similar documents in the same class and problem that have agreements, and puts the agreement counts into the AI prompt.
3. It writes a record to `summaries/` for the document it just analyzed.
4. When a student rates Ada's comment, `onCommentRated` records the rating on that record.

Personal documents never get past step 1. Their metadata record has `unit: null` and no `investigation` or `problem` (see `getDocumentLocationFields` in `src/models/document/document-kinds.ts`, `case "class"`; confirmed 2026-09-04 on a `vibe` personal document in the `demo/ETHANTEST` realm, whose record holds only `context_id`, `createdAt`, `key`, `network`, `properties`, `title`, `type: "personal"`, `uid`, and `unit: null`). `readDocumentMetadata` in `functions-v2/lib/src/ai-categorize-document.ts` sees the missing fields and returns `gap: "no-context"`. So a personal document gets no related summaries in its prompt, and no `summaries/` record, so its ratings are dropped (`onCommentRated` logs and skips).

This is the deliberate outcome of CLUE-370. Before CLUE-370, the missing problem caused the lookup to crash and Ada's comment never appeared. CLUE-370 fixed the crash by skipping the lookup. This story does the real fix.

**The fix in one sentence:** when a student asks for feedback, the app records which unit and problem the student was running at that moment, and the pipeline uses that as the context for personal documents, whose own metadata does not carry one.

## What the pipeline needs, and where it can come from

The pipeline needs four fields for the lookup: `context_id`, `unit`, `investigation`, `problem`. It also stores `offeringId` on the summary record, but `findRelatedSummaries` does not filter on it; it is kept as a record of where the document came from, and is `""` when unknown.

A personal document's metadata record already has `context_id`. The other fields are not on the record, and cannot be: a personal document is not tied to one problem. But the app always knows the problem the student is currently running. These are in the stores: `unit.code`, `investigation.ordinal`, `problem.ordinal`, and `user.offeringId`. The app already uses exactly these values to stamp problem documents at creation (`currentProblemInfo` in `src/lib/db.ts`).

An evaluation is requested by writing to the Realtime Database at `.../documentMetadata/{docId}/evaluation/{evaluator}` (`updateEvaluation` in `src/lib/firebase.ts`). Today the value is `{timestamp}` or `{timestamp, aiPrompt}`. This is the place to add the context. Three code paths write it, and all three run while the student is inside a problem:

- the Ideas button (`handleIdeasButtonClick` in `src/components/document/document.tsx`)
- closing a document (`use-document-sync-to-firebase.ts`, cleanup calls `setLastEditedNow`)
- the `onDisconnect` handler (`setLastEditedOnDisconnect`)

## Changes

### 1. Client: include the running context in the evaluation request

File: `src/lib/firebase.ts`, `updateEvaluation`.

Add a `context` object to the value written. Define its type once, in `shared/shared.ts`, so the client writer and the function reader share it:

```ts
export interface IEvaluationRequestContext {
  unit: string;
  investigation: string;   // ordinal as a string, same as the metadata records
  problem: string;         // same
  offeringId: string;      // "" outside a portal
}
```

Notes:

- Write it for every document type, not only personal ones. Deciding per type in the client would add a second place that knows which documents have a problem. The pipeline decides what to do with it (change 4).
- The context does not carry `context_id`. The metadata record is the only source for the class, and there is no known way for the record and the running class to disagree (Decision 4).
- Every field is written as a string. Firebase does not accept `undefined`, and the functions side (change 2) drops any context whose `unit`, `investigation`, or `problem` is not a non-empty string, so write `""` for a missing `offeringId` and nothing at all for a missing curriculum value. **Superseded:** the client sends the whole context or none of it, and the functions check more than string-ness. See DEVIATIONS.
- The `onDisconnect` version is registered when the document opens, and an `onDisconnect` value is fixed at registration, so its context is the problem being run at that time. That is almost always the problem the student is still in when the connection drops: the assigned-problem menu navigates with `window.location.replace`, which reloads. The exception is `handlePreviewMenuItemClick` in `src/components/problem-menu-container.tsx`, which calls `loadUnitAndProblem` and swaps the problem in place. Those preview items are shown only when `ui.standalone && user.standaloneAuth` — standalone preview, before login — so a student who previews another problem and then loses the connection has the document filed under the problem they opened it in. Accepted rather than fixed: reading the context at disconnect time is not possible with `onDisconnect`, which needs its value up front.
- No Realtime Database rules change is needed. `database.rules.json` allows class members to write anywhere under their class and does not validate the shape of this value.
- Tests: `src/lib/firebase.test.ts` (check the written value; check the `custom` evaluator still writes `aiPrompt` alongside it).

### 2. Queue: carry the context through the three functions

File: `functions-v2/src/on-analyzable-doc-written.ts`.

`handleUpdate` already reads `content.timestamp` and `content.aiPrompt` off the evaluation value. Read `content.context` beside them and add it to `AnalysisQueueDocument` as an optional field, named to say what it is:

```ts
/** The unit and problem the student was running when the evaluation was requested. */
requestContext?: IEvaluationRequestContext;
```

The value comes from the Realtime Database with no type. Class members can write anything under their class, and the open realms let any signed-in user write anything. So do not copy `content.context` into the field as it is. Build a new object from it, field by field, in a small function (`normalizeRequestContext`, with its own unit tests):

- `unit`, `investigation`, and `problem` must each be a non-empty string. If any is not, store no `requestContext` at all. **Superseded:** `unit` must also look like a unit code and not be the placeholder, ordinals must be short digit strings with no leading zero, and a problem ordinal of `0` is refused. See DEVIATIONS. A partial context is no use to the lookup, and dropping it here keeps the check in one place.
- `offeringId` is kept when it is a string and replaced with `""` otherwise.
- Nothing else from the incoming object is copied.

The pending function (`on-analysis-document-pending.ts`) and the imaged function spread the queue record forward (`...queueDoc`), so the field reaches the imaged function with no further change. It also lands on the `done` record. That record is a contract mined by the harness and by `scripts/survey-class-documents.ts`; adding a field is safe, but note it in `analysis-queue-types.ts` where the other fields are documented.

Tests: `functions-v2/test/on-analyzable-doc-written.test.ts` (context present; context absent; partial context dropped; non-string `offeringId` becomes `""`; extra properties dropped; legacy plain-number value still works).

### 3. Screenshot unit: use the request context when the metadata has no unit

File: `functions-v2/src/on-analysis-document-pending.ts`.

The pending function renders the screenshot with the metadata record's `unit`, and falls back to `mods` when that is null, which it always is for a personal document. So a personal document from any other unit is screenshotted with the wrong tile set. With `requestContext.unit` available, use it when the metadata `unit` is missing. This is a separate bug that the same data fixes, and it ships with this story (Decision 5).

The rule: take the first usable value from, in order, the metadata record's `unit` and then `requestContext.unit`; if neither is usable, use `mods`. "Usable" means it passes the existing `renderUnitFor` check (a plain unit code; as shipped this is `isRenderableUnit`, split out of `renderUnitFor`, and it also refuses the placeholder unit code), so a present-but-invalid metadata unit falls through to the request unit, and an invalid request unit falls through to `mods`. No value reaches the renderer without going through that check.

Tests: `functions-v2/test/on-analysis-document-pending.test.ts` (metadata unit wins; request unit used when metadata unit is null; request unit used when metadata unit is invalid; invalid request unit falls back to `mods`; fallback when both are missing).

### 4. Pipeline: use the request context for personal documents only

Files: `functions-v2/lib/src/ai-categorize-document.ts`, `functions-v2/src/on-analysis-document-imaged.ts`.

`readDocumentMetadata(firestoreDocumentPath)` becomes `readDocumentMetadata(firestoreDocumentPath, requestContext?)`. The rule:

- The request context is used only when the metadata record's `type` is `personal` (Decision 1). Learning logs and class-wide documents keep today's behavior and return `gap: "no-context"`. `functions-v2` does not import from `src/`, and `shared/` has no document-type helpers, so compare against the string `"personal"` (the value `PersonalDocument` in `src/models/document/document-types.ts`) and say in a comment where it comes from. This is an exact match: a published personal document (`personalPublication`) does not qualify. Such documents can be sent for evaluation, because `renderOtherDocumentTitleBar` in `src/components/document/document.tsx` renders the Ideas button outside its `!hideButtons` guard, so a published personal or learning-log document shows the button whenever AI evaluation is on. A request from one of them is handled like a learning log: `no-context`, as today. Whether the Ideas button should be hidden on published documents is a separate UI question, not part of this story.
- For a personal document, for each of `unit`, `investigation`, `problem`, `offeringId`: if the record's value is missing or null, take the request's value. **As shipped:** an empty string counts as missing too, matching the completeness check below.
- Fields on the metadata record always win. Never overwrite a stored `unit`, `investigation`, or `problem` with the request's value. A problem document belongs to its problem no matter what the student was running, and the check above means a non-personal document never sees the request at all.
- `context_id` always comes from the record. It has no fallback and the request does not carry it.
- After filling, apply the existing "all four present" check. If still incomplete, return `gap: "no-context"` exactly as today. This keeps the old behavior for old clients and for requests written without a context (see Compatibility).

`categorizeRepresentations` gets the request context as a new parameter, placed after `aiPrompt` and before `deps`: `(representations, apiKey, firestoreDocumentPath, aiPrompt, requestContext, deps)`. The ten calls in `functions-v2/test/ai-analysis-messages-integration.test.ts` pass `deps` as the fifth argument and have to be updated; while there, add an assertion that `requestContext` reaches `deps.readDocumentMetadata`. (An options object would stop the argument list from growing again, but it is not needed for this story.) `onAnalysisDocumentImaged` reads the context off the queue record.

Record where the context came from. Add `contextSource: "document" | "request"` to `DocumentMetadata`. The rule: `"request"` when any of `unit`, `investigation`, or `problem` came from the request; otherwise `"document"`. `offeringId` does not count, because the lookup does not use it and it is normalized to `""` anyway. In practice a personal document has none of the three on its record, so the mixed case should not occur, but the rule covers it if it does. Store it on the `summaries/` record (Decision 3) and on the `done` queue record beside `summaryRecorded`, so that "how many personal documents got summaries" and "do agreement patterns differ between personal and problem documents" are queries rather than guesses. The `done` write is conditional: a run that ended in `no-context` or `no-metadata` has no `DocumentMetadata`, so it carries no `contextSource`. `Summary` in `functions-v2/src/summary-types.ts` gains `contextSource?`, optional because records written before this change do not have it. Both the create and the update paths in `writeSummaryRecord` write it.

Nothing else in the pipeline changes:

- `writeSummaryRecord` writes whatever `DocumentMetadata` it is given. A personal document's record now has the running problem in its context fields.
- `findRelatedSummaries` filters on the same fields. A personal document analyzed while running problem 1.2 finds problem documents and other personal documents from the same class that were analyzed under 1.2. No index change: the composite index in `firestore.indexes.json` is unchanged because the query is unchanged (`contextSource` is stored, not queried).
- `onCommentRated` reads only the document's `key` and finds the summary by id (`{root}-{space}-{key}`). It has no idea what a problem is. No change.
- `firestore.rules`: no change. `summaries` stays admin-only.

Tests: `functions-v2/test/on-analysis-document-imaged.test.ts` and a new or extended unit test for `readDocumentMetadata` (personal document: fill missing fields; problem document: do not overwrite present fields; learning log, class-wide document, and `personalPublication`: still `no-context` even with a request context; personal document without a request context: still `no-context`; `contextSource` set correctly, including the mixed case; `done` record has no `contextSource` on a `no-context` run). `functions-v2/test/related-summaries-emulator.test.ts` if it seeds metadata records: add a personal-document case that gets a summary and appears in another document's lookup.

### 5. Re-analysis of a personal document under a different problem (no code change)

A personal document can be analyzed today under 1.2 and next week under 2.1. The update path in `writeSummaryRecord` rewrites the context fields on every run, so the record moves from 1.2 to 2.1, keeping its agreements (Decision 2). Agreements collected under 1.2 then count toward 2.1 lookups. This is consistent with the drift already accepted in CLUE-645 (Resolved Decision 7): only per-value counts reach the prompt. No code is needed for this; it is the existing behavior, recorded here so nobody adds a reset later without knowing it was decided. If this needs to change, the options are to reset the agreements when the problem changes, or to keep one record per document per problem (which changes the summary id and `onCommentRated`, so it is much bigger).

### 6. Group documents (confirm only)

The story description says group documents and their comments should be included. They already are. A group document uses the `group` axis profile, whose container is `offering`, so its metadata record carries the full context (`getDocumentLocationFields`, `case "offering"`), and the CLUE-645 design says group documents participate exactly like problem documents. The one thing to do is confirm it with a test or a manual run, since CLUE-645 was tested against problem documents. Add a group-document case to the tests in change 4. If that confirmation shows a gap, it becomes a task here.

## Compatibility and deploy order

- Old client, new functions: the request carries no context; personal documents keep getting `no-context`, as today. Nothing breaks.
- New client, old functions: the extra field on the evaluation value is ignored. Nothing breaks.
- So either order works. Deploy the functions first anyway, so the first client release that sends context is also the first one whose context is used.
- No Firestore rules, Realtime Database rules, or index changes. No migration: personal documents acquire a summary on their next analysis, which is the same as CLUE-645's approach for every other document.
- A personal document rated before its first post-deploy analysis is logged and skipped by `onCommentRated`, same as today.

## Verification after deploy

**What has been run.** Steps 1 to 8 were carried out on 2026-09-04 against the local emulator suite
— all emulators on the real project id, so the triggers fire — with real OpenAI calls and one real
Shutterbug render. The `qa` unit was used rather than `vibe`, with `aiEvaluation` and
`showCommentRating` switched on in `src/public/demo/units/qa/content.json` for the run and reverted
afterwards. All eight passed; the results are in the PR description. What remains is a run on
staging with `vibe` and a real portal offering, which is the only thing that exercises a real
`offeringId` and portal authentication.

Use the `vibe` unit (Decision 6). Students can create personal documents in it with File > New (confirmed 2026-09-04 in the `demo/ETHANTEST` realm). For development, the demo realm with `?appMode=demo&demoName=<name>&fakeClass=1&fakeUser=student:1&unit=vibe&problem=1.1` is enough; for the final check use staging (see Scott's notes on CLUE-645 for the offering setup). Use problem 1.1 or higher. An investigation ordinal of 0 is real — `vibe`'s first investigation holds problems 0.1 and 0.2 — and is accepted throughout. A problem ordinal of 0 is the app's unresolved placeholder: the client will not send a context naming it and `normalizeRequestContext` refuses one, so a document evaluated in that state gets no context at all. Steps:

1. As a student in problem 1.1, make a personal document with some text, click Ideas.
2. Check the `done` queue record: `summaryRecorded: "created"`, `contextSource: "request"`.
3. Check `summaries/`: a record with `problem: "1"`, `investigation: "1"`, `unit: "vibe"`, `contextSource: "request"`.
4. Rate Ada's comment. Check the record gains an agreement and `numAiAgreements: 1`.
5. As a second student in the same class and problem, make a similar personal document and click Ideas. Check the function logs show the first record was found, and the prompt (in `fullResponse` or the logs) carried the agreement count.
6. Repeat step 5 with a problem document to confirm personal and problem documents find each other both ways.
7. Make a learning log, click Ideas, and check its `done` record says `summaryRecorded: "no-context"`.
8. Open a published personal document, click Ideas, and check the same: `summaryRecorded: "no-context"`. Note the Ideas button only appears when the document is the workspace document; opening a publication from Class Work shows it in the left panel, which has no such button. In the local run the request was written straight to `.../documentMetadata/{docId}/evaluation/categorize-design` instead, which is the same value `updateEvaluation` writes.

## Files to modify

| File | Change |
|------|--------|
| `shared/shared.ts` | `IEvaluationRequestContext` type and `kPlaceholderUnitCode`, shared by client and functions |
| `src/models/stores/stores.ts` | build the placeholder unit from the shared constant |
| `src/lib/firebase.ts` | `updateEvaluation` writes `context` |
| `src/lib/firebase.test.ts` | cover the written value |
| `functions-v2/src/on-analyzable-doc-written.ts` | `normalizeRequestContext`; store `requestContext` on the queue record |
| `functions-v2/src/analysis-queue-types.ts` | document the new field |
| `functions-v2/src/on-analysis-document-pending.ts` | render unit from `requestContext` when the metadata `unit` is missing or invalid (change 3) |
| `functions-v2/lib/src/ai-categorize-document.ts` | `readDocumentMetadata` fills missing fields from the request for personal documents; `contextSource`; new parameter on `categorizeRepresentations` |
| `functions-v2/src/on-analysis-document-imaged.ts` | pass `requestContext` through; write `contextSource` on the summary record and the `done` record |
| `functions-v2/src/summary-types.ts` | `contextSource?` on `Summary` |
| `functions-v2/test/*` | tests listed under each change, including the signature update in `ai-analysis-messages-integration.test.ts` |
| `docs/document-metadata/metadata-fields.md` | the `evaluation` entry lists the value as `{ aiPrompt?, timestamp }`; add `context?` |
| `docs/firestore-schema.md` | add `contextSource` to the `summaries` record |

## Implementation order

**Process.** All of this work goes in one PR. It is done as the numbered steps below, in order, and each step is a stopping point: when a step is finished and its checks pass, stop and wait for the reviewer to look at the changes before starting the next step. Do not start the next step early, and do not combine steps. Each step is written so that the repository builds and all tests pass when it ends, so a review at any stopping point sees a working tree.

**Checks at the end of every step.** For a step that touches `functions-v2/`: `cd functions-v2 && npm run build && npm run lint && npm test`. The tests need the emulators running in another terminal first: `cd functions-v2 && npm run test:emulator`. For a step that touches `src/` or `shared/`: `npm run lint` and `npm test` from the repository root (a path argument to `npm test` narrows it to the changed files). Report which commands were run and their result at each stopping point.

**Step 1. Shared type.** Add `IEvaluationRequestContext` to `shared/shared.ts` (change 1). Nothing uses it yet. Checks: root lint.

**Step 2. Queue field and normalization.** In `functions-v2/src/on-analyzable-doc-written.ts`, add `requestContext?` to `AnalysisQueueDocument`, add `normalizeRequestContext` (exported, so the tests can call it directly), and have `handleUpdate` store its result (change 2). Document the field in `analysis-queue-types.ts`. Tests: the list under change 2, in `on-analyzable-doc-written.test.ts`. The existing tests there build the evaluation value with `makeDataSnapshot`; the new ones use the object form `{timestamp, context}`. Checks: functions build, lint, tests.

**Step 3. Metadata fill and `contextSource`.** In `functions-v2/lib/src/ai-categorize-document.ts`: the second parameter on `readDocumentMetadata`, the personal-only fill rule, and `contextSource` on `DocumentMetadata` (change 4, first half). Do not change `categorizeRepresentations` yet; pass nothing through, so behavior is unchanged at the end of this step. Tests: the `readDocumentMetadata` cases under change 4. Checks: functions build, lint, tests.

**Step 4. Signature and pass-through.** Add the `requestContext` parameter to `categorizeRepresentations` and pass it to `readDocumentMetadata` (change 4, second half). Update the ten calls in `ai-analysis-messages-integration.test.ts` and add the assertion that the context reaches `deps.readDocumentMetadata`. Checks: functions build, lint, tests.

**Step 5. Imaged function.** In `on-analysis-document-imaged.ts`, read `requestContext` off the queue record, pass it to `categorizeRepresentations`, add `contextSource?` to `Summary` in `summary-types.ts`, write it in both paths of `writeSummaryRecord`, and add it to the `done` record when there is metadata (change 4, rest). Tests: the imaged-function cases under change 4, and the group-document case from change 6. Add the `related-summaries-emulator.test.ts` case if that suite seeds metadata records. Checks: functions build, lint, tests.

**Step 6. Screenshot unit.** In `on-analysis-document-pending.ts`, the unit fallback rule (change 3). Tests: the list under change 3. Checks: functions build, lint, tests.

**Step 7. Client.** In `src/lib/firebase.ts`, `updateEvaluation` writes `context` (change 1). Tests: `src/lib/firebase.test.ts`. Checks: root lint and tests.

**Step 8. Docs.** Update `docs/document-metadata/metadata-fields.md` and `docs/firestore-schema.md` (files table). Re-read this plan against the code and record any departure under a DEVIATIONS heading at the end of this document, the way the CLUE-645 implementation plan does. Checks: none beyond a read-through.

**After step 8.** Run the verification steps above on the demo realm before the PR is opened for review, and note the results in the PR description. The deploy order under "Compatibility and deploy order" applies when the PR is released.

## Decisions

Answered 2026-09-04 by the requester, from the open questions in the first draft.

1. **Only personal documents get this.** Learning logs and class-wide documents are skipped by the pipeline even though the same data would cover them. (Change 4.) The [Jira story](https://concord-consortium.atlassian.net/browse/CLUE-607) only specifies personal documents, so the work was scoped to only those. There wasn't an explicit UX or pedagogical reason for skipping learning logs and class-wide documents.
2. **Old agreements stay on the record when a personal document is re-analyzed under a different problem.** May be revisited later; this is the rule for this story. (Change 5.)
3. **`contextSource` is stored on the `summaries/` record**, not only on the `done` queue record. (Change 4.)
4. **The request context does not carry `context_id`**, and the pipeline does not cross-check the document's class against the running class. (Change 1.)
5. **The screenshot-unit fix ships with this story.** (Change 3.)
6. **Test with the `vibe` unit, not MODS.** The story asks for MODS as the example, but MODS was not a usable host when the story was written (it sent images only, so it never reached the summaries code). After CLUE-371 that is no longer true and MODS would work as well as any other unit. `vibe` is preferred because Scott's CLUE-645 setup notes already measured its deployed config (`showCommentRating: true`, text summaries, a staging class and offering that can be copied), and it is confirmed that students can create personal documents in it. The one reason to stay with MODS would be if someone specifically wants to watch agreement patterns in that curriculum, which is a research question rather than a testing one and can be done after this ships on any unit.

## Review fixes

Changes made 2026-09-04 after a review of the draft that followed the decisions above. All six findings were accepted.

1. The incoming context is normalized field by field at the queue boundary, and `offeringId`'s handling is spelled out. (Change 2.)
2. `contextSource` has a defined rule for a record filled from both sources, and the `done` record carries it only when there is metadata. (Change 4.)
3. The plan no longer claims published personal documents cannot be sent for evaluation. They can, and they stay at `no-context`, with a test. (Change 4.)
4. `offeringId` is described as stored, not queried. (Section "What the pipeline needs".)
5. The new `categorizeRepresentations` parameter position is pinned, and the integration tests that pass `deps` positionally are listed as work. (Change 4.)
6. The screenshot-unit rule says what happens with invalid as well as missing values, with tests for each. (Change 3.)

## DEVIATIONS

Where the code disagrees with this plan, prefer the code. Recorded here as the eight steps were
implemented, 2026-09-04.

### The `summaries` record was not documented anywhere (Step 8)

The files table says to add `contextSource` to the `summaries` record in `docs/firestore-schema.md`.
That file did not describe the `summaries` collection at all — outside the CLUE-645 plan documents,
the record's fields were written down nowhere. So step 8 added a short `## Summaries` section to
`docs/firestore-schema.md` describing the record, the `{root}-{space}-{key}` id, and every field,
`contextSource` among them, and named `summaries` in the top-level collections sentence. This is
more than the plan asked for; the alternative was a field with no record to attach it to.

### `categorizeRepresentations` had thirteen calls to update, not ten (Step 4)

Change 4 says "the ten calls in `ai-analysis-messages-integration.test.ts`". The file has grown
since the plan was written. All thirteen now pass `undefined` for `requestContext`.

### `contextSource` is required on `DocumentMetadata`, so three test fixtures had to change (Steps 3 and 5)

Change 4 says to add `contextSource` to `DocumentMetadata` without saying whether it is optional. It
is required: the pipeline always knows which source it used, and Firestore cannot store `undefined`,
so a fixture without it would make the summary write fail rather than the build. The three
`DocumentMetadata` literals in the tests each gained `contextSource: "document"`. On `Summary` it is
optional, as the plan says, because stored records predate it.

### The renderable-unit check was split out of `renderUnitFor` (Step 6)

Change 3 gives the rule but not its shape. Rather than compare `renderUnitFor`'s result with its
input to find out whether a value was usable, the predicate is now its own exported function,
`isRenderableUnit`, and `renderUnitFor` calls it. One definition of "usable", used by both.

### The client writes all four fields or none (Step 7, revised after review)

Change 1 says to write "nothing at all for a missing curriculum value", field by field. The client
instead writes the whole context or omits it entirely. There is no partial case to write: the stores
hold placeholder values rather than missing ones, so the client checks for the placeholders and
sends nothing when it finds them, which is what an old client sends and what the functions already
handle. Written field by field, a placeholder unit paired with real ordinals would have read as a
complete context.

### Two comments and a log message were reworded (Steps 3 and 5)

Not in the files table, but they contradicted the new behavior once it landed: the `MetadataGap`
doc comment and the `no-context` log message in `readDocumentMetadata` both said a personal document
has no context and always reports `no-context`.

### Where the group-document confirmation landed (Step 5)

Change 6 says to add a group-document case "to the tests in change 4". It is in the
`readDocumentMetadata` tests in `related-summaries-emulator.test.ts`, which is where the code tells
document types apart, and it covers both spellings of the type: `group` and the post-CLUE-604
`axes`. A group document keeps its own context and reports `contextSource: "document"`, confirming
it needs none of this work.

### Tests the plan lists that existing tests already cover (Steps 2 and 4)

Change 2 asks for a "legacy plain-number value still works" case in `on-analyzable-doc-written`.
The two existing scalar-value tests assert the whole queue record with `toEqual`, so they already
fail if a `requestContext` appears on a legacy request; no new test was added for it.

### Unrelated flaky test, seen while running the suite

`functions-v2/test/chat-drain-emulator.test.ts` fails its message-ordering assertion (line 130)
roughly one run in eight, on a clean tree as well as this branch. Nothing in this story is imported
by it. Not fixed here; worth its own ticket.

### The screenshot-unit log was split in two (Step 6, after review)

Change 3 says nothing about logging, and the code it changed carried one `logger.warn` for every
value that was not the document's own unit. With the request unit in play that one line covered two
different events: standing in the request's unit, which is the ordinary path for every personal
document, and reaching `mods` because nothing usable was available, which means the screenshot may
be of unknown-tile placeholders. The first is now `logger.info` and the second stays `logger.warn`,
so the case worth alerting on after this deploy is findable. Note the warning was not introduced by
this story: on master `renderUnitFor(null)` returned `mods`, so it already fired on every personal
document, every run.

### Review of the finished branch: what was fixed, accepted, and deferred (after Step 8)

A reviewer went looking for bugs and found ten. All ten were accurate; six were fixed here, two are
recorded as accepted limitations, and two are pre-existing and go to their own tickets.

**Fixed.**

1. *The store placeholders passed every check.* `createStores` builds a unit whose code is `NULL`
   and an investigation and problem whose ordinals are `0`, and `loadUnitAndProblem` replaces the
   investigation and problem only `if (investigation && problem)` — so a stale offering or a
   mistyped `problem` parameter leaves them in place while the app runs. The context built from
   them is four non-empty strings, which the first version of this work accepted, filing documents
   under a problem that does not exist. Now the client sends no context at all when the unit is the
   placeholder or the problem ordinal is `0`, and `normalizeRequestContext` refuses a unit that is
   not shaped like a unit code, the placeholder included. An investigation ordinal of `0` is
   deliberately still accepted: `vibe`'s first investigation holds problems 0.1 and 0.2. The
   placeholder code lives in `shared/shared.ts` as `kPlaceholderUnitCode` so the three places that
   care about it — the store that creates it, the client that refuses to send it, and the renderer
   that refuses to draw with it — name the same value.
2. *`isRenderableUnit` accepted the placeholder.* It has the shape of a unit code, so a document
   created before its unit loaded would have been rendered with `?unit=NULL`, which fetches nothing,
   and logged at info. It is now refused by name and falls through to the request unit, then `mods`.
3. *No shape or length validation on the incoming context.* The class-scoped trust that lets a
   student author their own context is the exposure CLUE-645 accepted and is still accepted. The
   caps are not: `unit` must match the renderer's pattern and be at most 40 characters, the ordinals
   must be one to three digits with no leading zero, and an `offeringId` over 100 characters becomes
   `""`. Without them a large enough string would push the queue record past Firestore's document
   limit, fail the write, and leave that document with no analysis at all.

   A later review pass added one more rule here: a problem ordinal of `0` is refused, while an
   investigation ordinal of `0` is kept. Problems are numbered from 1 in every unit checked — the
   bundled demo units, and `vibe`, `mods`, `sas`, `msa`, `m2s` and `moth` on the curriculum site,
   several of which do have an investigation 0 — so a problem ordinal of `0` is the app's unresolved
   placeholder. The client already refused to send it; the point of repeating the rule on the server
   is that the request is untrusted, and a rule enforced on one side of that boundary only is a rule
   the next reader cannot see. It does not narrow the accepted exposure: a request can still name any
   real problem in its own class.
4. *The fill used `??` where the check below it used truthiness.* A record holding `unit: ""` kept
   the empty string, failed the completeness check, and reported `no-context` with a usable request
   context sitting unused. Both now treat an empty string as missing.
5. *`contextSource` could be written as `undefined`.* Firestore rejects undefined outright, so a
   `readDocumentMetadata` injected without the field would have turned a summary write into
   `summaryRecorded: "failed"`. It is now spread conditionally.
6. *Nothing said the two rules differ on purpose.* The screenshot uses the request's unit for any
   document; the metadata fill uses the request for personal documents only. That is intended — a
   learning log's tiles are no more at home in `mods` than a personal document's are — and there is
   now a comment saying so and a test that renders a learning log with the request's unit.

**Accepted, not fixed.**

- The `onDisconnect` context can be stale after an in-place problem switch. See the note under
  change 1; the window is standalone preview before login.
- A metadata record with no `type` never qualifies for the fill. `type` is required by
  `isDocumentMetadata` and written by every creation path, so this is a hypothesis about old data.
  The `no-context` log line already prints `type`, which is enough to notice it if it happens.

**Pre-existing, deferred.**

- Closing a document requests another evaluation, so most documents are analyzed twice, each paying
  for another model call and rewriting the summary's context fields.
- The pending queue is written with `.set()`, so a second request arriving before the first is
  consumed overwrites it and never fires `onDocumentCreated`. The second request is lost entirely
  today, not merely its context.

**Files the plan's table does not list.** Two more files changed, both from the fix above:
`src/models/stores/stores.ts` builds its placeholder unit from the shared constant rather than a
literal, and `shared/shared.ts` carries that constant, `kPlaceholderUnitCode`, alongside the
context type. It sits in `shared/` because the store that creates the value, the client that refuses
to send it, and the renderer that refuses to draw with it are in three different packages.

**Checked, nothing to do.** Adding `requestContext` and `contextSource` to the `done` record is safe
for its consumers: `scripts/survey-class-documents.ts` builds its `AnalysisRecord` by naming fields
one at a time in `toRecord`, and nothing in `shared/` reads the done queue at all.
