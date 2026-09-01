# Ratings → Document Summaries (CLUE-645) Implementation Plan

**Design:** `docs/plans/CLUE-645-ratings-to-summaries-design.md` — read it first; this plan does not
restate rationale. Decisions live there; where code and this plan disagree, prefer the code and
record the departure (see DEVIATIONS at the end).

**Verified against:** `master` at `c08e75c28` (2026-08-27), post-harness-merge. File and symbol
references below were re-checked on that commit.

**Status (2026-09-01).** Track A shipped in PR #2990. Track B — tasks 3 to 6 — is the branch this
plan sits on. Track C has not started; it is gated on `CLUE-371-ai-feedback-text-and-images`, and
tasks 7 to 11 are the only ones here that describe work still to do.

Tasks 1 to 6 describe work that is finished, and are kept at full detail as the record of what was
asked. What is durable about them now lives where it is enforced: the reconcile and timestamp rules
in `functions-v2/src/on-comment-rated.ts` and its test suite, the id derivation in `getSummaryPath`
and its tests, and every departure from this plan under DEVIATIONS. **The one thing here with no
equivalent in code is the deployment cutover, Task 5 step 3** — removing the export does not delete
the deployed `onDocumentSummarized`, and the old trigger still deletes summaries when their last
agreement goes, so that step has to be read before deploying.

**Structure:** three tracks. Track A (rules fix) and Track B (`onCommentRated`, types, helper,
read side) have no dependency on CLUE-371's in-progress pipeline branch and can start immediately;
Track B's function is testable against fixture summary records because it never creates summaries.
Track C (the pipeline summary write) lands inside CLUE-371's refactored categorize flow and starts
after `CLUE-371-ai-feedback-text-and-images` merges; its tasks are drafted against that plan
(`CLUE-371-production-mixed-mode.md`, items 5–6) and must be reconciled with the merged code before
implementation.

---

## Track A — ship first, independent PR

### Task 1: Validate rating values (design Prerequisite, review #10)

**Files:**
- Modify: `firestore.rules` — both `isValidRatingUpdate()` blocks (documents and curriculum
  comment rules; today at ~:361 and ~:531)
- Create: `firebase-test/src/comment-ratings-rules.test.ts` (follows the existing
  `*-rules.test.ts` pattern)

**Steps** (the full scope after two code-review rounds — the enum alone is not enough; the author
branch and the create path each bypass it):

1. **Enum in `isValidRatingUpdate()`**, both blocks:
   ```
   && (!(userId in newRatings) || newRatings[userId] in ['yes', 'no', 'notSure'])
   ```
   The first clause permits toggle-off (the user's key absent from the new map). Do NOT use a
   `get()`-with-default formulation — it silently rejects the delete case.
2. **Author bypass:** add `"ratings"` to `readOnlyFieldsSet` in `preservesReadOnlyCommentFields()`,
   both blocks, with a comment explaining that a changeable field sits in the read-only list so the
   author-edit branch can never carry a rating change — every ratings write goes through
   `isValidRatingUpdate()`. Author rating their own comment: fails edit branch, passes rating
   branch. Combined content+rating write: denied (no client makes that write shape — the only
   ratings writer is the single-key update in `use-update-comment-rating.ts`).
3. **Accepted residues — deliberately NOT implemented** (decision 2026-08-31, simplifying an
   earlier broader plan; see the design doc's Prerequisite section): the create path can still
   seed a `ratings` map on one's own comment (data-integrity nuisance only; ingestion and the
   prompt filter defang it downstream), and `agreeWithAi` is not frozen by rules — the deployed
   `onDocumentSummarized` remains the consumer of hand-crafted values until Task 5's cutover
   deletes it, which is the closing event. Both residues are noted in the PR description and the
   `agreeWithAi` finding is recorded on the Jira ticket.
4. Rules tests (`comment-ratings-rules.test.ts`, per realm; seed fixtures with rules disabled via
   the harness's admin context):
   - own-key write with each valid value → allowed; arbitrary string / number / object → denied;
     **own-key delete (toggle-off) → allowed**, including while another user's rating remains;
     other-user key write or delete → denied; whole-map replacement → denied; non-`ratings` field
     in the same write → denied
   - author path: valid own-key rating → allowed; content-only edit → allowed; bogus value →
     denied; other-user key → denied; map replacement dropping another user's entry → denied;
     content edit + rating in one write → denied
   - Discipline: with `firestore.rules` reverted to master, the new denial tests must fail and the
     "still allowed" tests must pass — proving the tests track the change and it doesn't overreach.
5. Read-side defense is Task 6 (rules alone don't cover demo/dev realms, which allow any authed
   write).

**Verify:** full `npm test` in `firebase-test/`; `npm run lint` in `firebase-test/`.
**Commit:** `fix: validate comment rating values in Firestore rules (CLUE-645)`
**Note:** rules take effect on deploy, not merge; the deployer should diff the full rules file
against what is live, since deployed rules have lagged master before.

### Task 2: Retention heads-up (design Open Question 1, condition c)

Not code. Send the heads-up to whoever holds the CLUE-371 production-data sign-off: CLUE-645 will
persist an AI-generated summary plus a 1536-dimension vector for every text-analyzed student
document, indefinitely, with no deletion path; TTL/lifecycle cleanup remains available later via
`analyzedAt`/`offeringId`. Record the answer in the design doc's Open Question 1.

---

## Track B — no CLUE-371 dependency, start now

### Task 3: Types — `AiAgreement` v2, collapse the value type

**Files:**
- Create: `functions-v2/src/summary-types.ts`
- Modify: `shared/shared.ts`, `functions-v2/lib/src/ai-categorize-document.ts`

**Steps:**

1. `shared/shared.ts`: **mostly done already** — Task 1 (PR #2990) added
   `kRatingValues` as the canonical list, with `RatingValue = typeof kRatingValues[number]` and
   `IAgreeWithAi["value"]: RatingValue`. What is left here is `AgreementValue`, which still reads
   `IAgreeWithAi["value"]`: make it `export type AgreementValue = RatingValue;` with a
   `@deprecated` comment. The alias **stays** in this change — dropping it would touch client files
   and `shared/ai-analysis-messages.ts`. Alias removal is optional later cleanup, not part of
   CLUE-645.
   Do not re-spell the three values anywhere: `kRatingValues` is the source, and
   `src/components/chat/comment-rating-rules.test.ts` fails if either `firestore.rules` block
   drifts from it.
2. `functions-v2/src/summary-types.ts`: move `Summary` and `AiAgreement` here from
   `on-document-summarized.ts` (which Task 5 replaces). Define per the design's Data Model:
   - `AiAgreementV2` (`version: 2`; `value`, `raterUid`, `commentId`, `commentUid`, `isAiComment`,
     `content`, `tags`, `updatedAt`) and `AiAgreementV1` (the current shape: `version: 1`, `value`,
     `content`, `tags`); `AiAgreement = AiAgreementV1 | AiAgreementV2`.
   - **Timestamps are epoch milliseconds (`number`) throughout**: `updatedAt` from
     `Date.parse(event.time)` (v2 typings make `event.time` an ISO string, not a number or
     `Timestamp`); `analyzedAt` from `Date.now()` at write, matching the old code's `createdAt`
     convention. No `FieldValue.serverTimestamp()` in these fields.
   - `Summary` with `analyzedAt`, `adaCommentId?` (most recent), `numAiAgreements`,
     `numAgreements?`, `aiAgreements: Record<string, AiAgreement>`. **`numAgreements` is optional
     on read**: legacy records predate it; the recompute in Task 5 writes both counts on any
     rating touch, so legacy records self-heal, and nothing queries the field yet.
3. Update `ai-categorize-document.ts`'s import of `AiAgreement` (today from
   `../../src/on-document-summarized`) to the new module.

**Verify:** `npx tsc --noEmit` in root and `functions-v2/`.
**Commit:** `refactor: extract summary types, add AiAgreement v2 (CLUE-645)`

### Task 4: Shared summary-id helper

**Files:**
- Modify: `functions-v2/src/utils.ts` (+ its test)

**Steps:**

1. `getSummaryPath(root: string, space: string, key: string): string` returning
   `summaries/{root}-{space}-{escaped(key)}` — match the escaping the current id scheme implies
   (the existing record ids are `{root}-{space}-{documentId}`; confirm whether `escapeKey` applies
   by checking how the pending queue's `docId` relates to `key` on real records, and encode the
   answer in the helper's test).
2. Both writers (Tasks 5 and 8) call this and only this; neither derives the id from a trigger
   `documentId` param or queue `docId` (review fix 2 — those can be legacy network-prefixed ids).

**Verify:** helper unit test with fixture `(root, space, key)` triples.
**Commit:** `feat: shared summaries path helper (CLUE-645)`

### Task 5: `onCommentRated` replaces `onDocumentSummarized`

**Files:**
- Create: `functions-v2/src/on-comment-rated.ts`
- Delete: `functions-v2/src/on-document-summarized.ts`
- Modify: `functions-v2/src/index.ts` (export swap)
- Create: `functions-v2/test/on-comment-rated.test.ts`

**Steps:**

1. Same trigger pattern (`{root}/{space}/documents/{documentId}/comments/{commentId}`).
   **Delivery model:** Firestore trigger events are at-least-once and unordered, so the event's
   `before`/`after` payloads are used ONLY as a cheap proceed/skip filter — never as the source of
   truth. The transaction re-reads the comment fresh and reconciles from the current snapshot, so
   duplicates and reversed-order events converge and a late event cannot resurrect old state.
   - **Proceed/skip filter, deletion first:** proceed when the comment was deleted
     (`before && !after`) AND `before` carried `ratings` OR legacy `agreeWithAi` (a legacy comment
     has an empty-vs-empty ratings diff — the unchanged-map skip must not swallow its cleanup);
     otherwise proceed only when `before?.ratings` differs from `after?.ratings`.
   - Read the parent document once for `key`; missing doc or missing `key` → log and return.
   - `getSummaryPath(root, space, key)`; summary absent → **info-log with the document key, and
     return** (never create — pipeline owns creation; this is also the migration behavior for
     pre-existing Ada comments).
   - **Transaction — reconcile from snapshot:** re-read the comment document inside the
     transaction. If it no longer exists → deletion path: remove every entry whose `commentId`
     matches, plus the legacy v1 entry keyed by the comment author's bare uid — which comes from
     `before.uid`, since on this path the comment snapshot no longer exists. Otherwise rebuild
     this comment's v2 entries (keyed `"{commentId}_{raterUid}"`, written via `FieldPath` — ids
     may contain dots) to exactly match the current `ratings` map: add missing, update changed,
     remove absent; drop out-of-enum values.
   - **Timestamps under reconciliation:** new/changed entries stamp `Date.parse(event.time)`. For
     an entry whose value already matches the snapshot, if this event's own `after.ratings[uid]`
     equals that value, repair the timestamp to `max(stored, Date.parse(event.time))`; if this
     event's `after` disagrees with the snapshot (a stale event), leave the stored timestamp
     untouched. Without the max-merge, an early stale event that reconciles to the current value
     stamps it with the *older* event's time, and the real event then "preserves" the wrong
     timestamp forever.
   - **Normalize comment fields defensively** (demo/dev rules are permissive, and `tags` is
     optional in the schema — `firestore-schema.ts:49`): `tags: Array.isArray(c.tags) ? c.tags :
     []`, `content: typeof c.content === "string" ? c.content : ""`, and skip the comment entirely
     if it has no `uid`. Never let `undefined` reach a Firestore write.
     `isAiComment: c.uid === kAnalyzerUserParams.id`.
   - Then **recompute `numAiAgreements` (v2 `isAiComment` + all v1 entries) and `numAgreements`
     (all entries) from the map contents** — never increment. This also backfills `numAgreements`
     on legacy records the first time they are touched.
   - **Never delete the summary document** — `numAiAgreements: 0` drops it from the lookup.
   - No RTDB reads, no summarization, no embeddings, no realm-path construction anywhere in this
     file. The legacy `agreeWithAi` ingestion branch is not carried over.
2. `index.ts`: export `onCommentRated`; remove `onDocumentSummarized`. Check nothing else imports
   the old module (Task 3 already moved its types).
3. **Deployment cutover** — removing the export does not remove the deployed trigger, and a
   still-live `onDocumentSummarized` would keep executing its summary-**deletion** path
   (`on-document-summarized.ts:127`) against the new never-delete invariant:
   - Replace `deploy:onDocumentSummarized` in `functions-v2/package.json` with
     `deploy:onCommentRated`.
   - Deploy procedure (record in the PR description): `firebase deploy --only functions` and
     confirm the prompt to delete `onDocumentSummarized`, or run
     `firebase functions:delete onDocumentSummarized` immediately after deploying
     `onCommentRated`. The old trigger must not remain live alongside the new one.
4. Tests (fixture summary records written directly to the emulator/mocked Firestore — this is why
   Track B doesn't wait for Track C): every reconcile case (add/change/remove/mixed); unchanged
   map → no write; **duplicate event delivery is a no-op; reversed-order delivery (`unset → yes`
   processed after `yes → no`) converges to the current snapshot AND the final `updatedAt` equals
   the later event's time (the max-merge repair); a late event arriving after comment deletion
   resurrects nothing**; out-of-enum value ignored; v2 keying and `FieldPath`
   safety (id containing `.`); **an untagged human comment (no `tags` field) produces a valid
   write with `tags: []`**; counts recomputed, v1 entries counted as AI, `numAgreements`
   backfilled on a legacy record; `isAiComment` labeling for Ada (`ada_insight_1`) vs human
   authors; no summary → logged skip, no write, no create; comment deletion removes
   v2-by-commentId and v1-by-uid — **including a legacy comment with `agreeWithAi` and no
   `ratings` map**; summary never deleted at zero agreements; a summary with no `aiAgreements`
   field (the old code's latent crash) handled cleanly.

**Verify:** `npm test` in `functions-v2/`; deploy to a dev project or emulator and click through a
rating on a fixture summary.
**Commit:** `feat: onCommentRated ingests comment ratings into summaries (CLUE-645)`

### Task 6: Read side — AI-only counts, enum filtering

**Do this early in the track.** Task 1 shipped only the rules half of the ticket's prerequisite
acceptance criterion ("rules accept only `yes`/`no`/`notSure` … **and** the read side drops
unrecognized values before they can reach a prompt"). This task is the other half, and it is the
only defense that covers values already stored and the `demo`/`dev` realms.

**Conflict watch:** `ai-categorize-document.ts` is also rewritten on
`CLUE-371-ai-feedback-text-and-images` — an import hunk at the top, and a large replacement of
`categorizeSummary` with `categorizeRepresentations` starting immediately below
`mapRelatedSummaries`. Keep this task's edit tight and confined to `mapRelatedSummaries` so the
merge stays trivial. Task 3's import switch touches the same import hunk.

**Files:**
- Modify: `functions-v2/lib/src/ai-categorize-document.ts` (`mapRelatedSummaries`, ~:116)
- Modify: `functions-v2/test/map-related-summaries.test.ts`

**Steps:**

1. `mapRelatedSummaries`: count only entries that are v1 (implicitly AI) or v2 with
   `isAiComment: true`; drop entries whose `value` is outside the enum (review #10's read-side
   defense — required because demo/dev rules are open). v2 entries with `isAiComment: false` are
   ignored entirely here (recorded, not prompted — design Resolved Decision 6).
2. The prompt text itself (`summaryContentParts` in `shared/ai-analysis-messages.ts`) is unchanged.
3. Extend the existing test file: v1-only, v2 AI-only, v2 mixed AI/peer, out-of-enum values,
   empty-after-filtering (yields an entry with no agreement sentence — match current behavior for
   an empty `agreements` record).

**Verify:** `npm test` in `functions-v2/`.
**Commit:** `feat: related-summary agreement counts are AI-only and enum-filtered (CLUE-645)`

---

## Track C — after `CLUE-371-ai-feedback-text-and-images` merges

> Drafted against `CLUE-371-production-mixed-mode.md` items 5–6. First step of this track is to
> re-read the merged code and reconcile function/field names; record differences under DEVIATIONS.
>
> **Realm scoping is a requirement of this track, not an optional extra** (added 2026-08-31; see the
> design doc's "Realm scoping" section for why). The `summaries` lookup filters only on the context
> fields, so nothing confines a match to the realm it was written in. Track C is what first
> populates the collection, so it is what must close this: `root` and `space` written on the record
> (Task 8), filtered in the query (Task 7), and added to the composite index (Task 7). Do not ship
> the pipeline write without all three.

### Task 7: Hoist the embedding; handle the `undefined` return

**Files:**
- Modify: `functions-v2/lib/src/ai-categorize-document.ts`

**Steps:**

1. Move the `getEmbeddings` call out of `findRelatedSummaries` (today at :91) into the categorize
   entry point (`categorizeRepresentations` in the CLUE-371 implementation plan; it runs only when
   a summary is being sent). Pass the vector into `findRelatedSummaries` as a parameter.
2. **Widen the return contract** — the CLUE-371 implementation plan pins `categorizeRepresentations`
   to `Promise<{completion, messageShape}>` (`CLUE-371-production-mixed-mode-implementation.md`
   ~:346), which leaves the imaged handler without anything Task 8 needs. Hoist the metadata read
   out of `findRelatedSummaries` into the entry point too, and return
   `{completion, messageShape, summaryEmbedding, documentMetadata}` where `documentMetadata` is
   the validated `{root, space, key, context fields}` (or `undefined` when the read failed /
   summary wasn't sent). Record this as a deviation against the CLUE-371 plan's stated contract,
   per both plans' DEVIATIONS protocol.
3. `getEmbeddings` returns `undefined` on any OpenAI error (:158-170). Handle it at both uses:
   no query (related summaries `[]`, log) and no summary write (Task 8) — never
   `FieldValue.vector(undefined)`, which persists a permanently poisoned zero-dimension vector.
4. **Scope the query to its realm.** Add `.where("root", "==", root).where("space", "==", space)` to
   the `findNearest` query, from the `root`/`space` this function already parses out of
   `firestoreDocumentPath` for the metadata read. Without it a record written under one realm can be
   returned to a document analyzed in another whenever the context fields coincide.
5. **Add both fields to the `summaries` composite index in `firestore.indexes.json`**, as equality
   fields ahead of the `summaryEmbedding` vector field (the index today is `context_id`,
   `investigation`, `problem`, `unit`, `key`, `numAiAgreements`, vector). A vector query needs an
   exact composite index: without it the lookup errors rather than degrading, so **deploy the index
   before the function**. Records that predate the fields stop matching; that is one demo record, and
   re-analysis rewrites it.

**Verify:** existing categorize tests plus an explicit `getEmbeddings → undefined` case, and a test
that a summary in another realm is not returned.
**Commit:** `refactor: compute summary embedding once, handle embedding failure (CLUE-645)`

### Task 8: Pipeline writes the summary record

**Files:**
- Modify: `functions-v2/src/on-analysis-document-imaged.ts`

**Steps:**

1. After a successful categorization with `sendSummary` true, and **before** creating Ada's
   comment (ordering per design Pipeline change 3 — a fast rating must not beat the summary into
   existence), write `getSummaryPath(root, space, key)` in a transaction with two explicit paths
   (design Pipeline change 4):
   - *Create:* full record — `key`, `root`, `space`, context fields, `summary`, `summaryEmbedding`,
     `analyzedAt` (server time), `adaCommentId`, `aiAgreements: {}`, `numAiAgreements: 0`,
     `numAgreements: 0`.
   - *Update:* only `key`, `root`, `space`, context fields, `summary`, `summaryEmbedding`,
     `analyzedAt`, `adaCommentId`; never touch `aiAgreements` or either count. `root`/`space` are
     written on this path too, so a record that predates them gains them on the next analysis.
   `root`/`space`/`key` and the context fields come from Task 7's widened return
   (`documentMetadata`) — the imaged handler has no metadata of its own under the CLUE-371
   contract, and never derives any of this from the queue `docId`. No `documentMetadata` (read
   failed, or summary not sent) → no write, with a logged reason. On the *update* path, if the
   existing record predates `numAgreements`, leave it — Task 5's recompute backfills it on the
   next rating touch.
2. `adaCommentId`: the comment created in this run (write the summary first with the field absent,
   then update it after the comment `add()` returns its ref — or restructure to create the comment
   ref first; either way the summary exists before the comment is readable).
3. `sendSummary` false, `mock` evaluator, or missing embedding (Task 7) → no write, with a logged
   reason.
4. **`root` and `space` are optional on the `Summary` type, so the compiler will not tell you if the
   update path forgets them.** They are optional because this type describes what a *reader* may
   find and no stored record carries them until this task ships (see the doc block on `Summary` in
   `functions-v2/src/summary-types.ts`). The only thing that enforces writing them on both paths is
   the Task 9 test case for it — do not drop that case as redundant.

**Verify:** Task 9.
**Commit:** `feat: analysis pipeline persists document summaries for agreements (CLUE-645)`

### Task 9: Pipeline tests

**Files:**
- Modify: `functions-v2/test/on-analysis-document-imaged.test.ts` (or the post-CLUE-371 equivalent)

Cases: first analysis initializes the counts; re-analysis updates only summary fields and preserves
agreements and counts; summary exists before the Ada comment; `sendSummary: false` / `mock` /
missing embedding → no write, run completes; id-derivation fixtures — the same `(root, space, key)`
triples run through Task 4's helper from both writers and land on the same path; `root` and `space`
written on both the create and the update path (**the only enforcement there is** — the fields are
optional on the type, so a missing write compiles cleanly; see Task 8 step 4); a record in another
realm with otherwise matching context fields is not returned by the lookup.

**Commit:** `test: pipeline summary-write coverage (CLUE-645)`

### Task 10: Docs and coordination

- `CLUE-371-production-mixed-mode.md`: add under its DEVIATIONS heading that the imaged step now
  also writes `summaries/` (pointing at the CLUE-645 design doc).
- Function header comments ("one of three functions…") in the touched functions: mention the
  summary write.
- Design doc: mark Open Question 1 with Task 2's answer; add a Deviations section if Track C
  reconciliation changed anything.

**Commit:** `docs: record summary write in pipeline plan and function headers (CLUE-645)`

### Task 11: Remove the dead `agreeWithAi` client write path

Deferred out of Track B (2026-09-01, on a review finding) to keep that PR backend-only. Nothing has
supplied this parameter since CLUE-397 removed the agree buttons (`adb9762`), and with
`onDocumentSummarized` deleted no backend consumer reads it either — the only remaining reader is
`on-comment-rated.ts`'s deletion filter, which reads the field off *stored* comments.

**Files:**
- Modify: `src/components/chat/chat-panel.tsx`, `src/hooks/document-comment-hooks.ts`,
  `shared/shared.ts`

**Steps:**

1. Delete `IPostCommentOptions.agreeWithAi` and its pass-through: the `postComment` destructure, the
   `logCommentEvent` payload field, and the `postCommentMutation.mutate` call.
2. Delete the optimistic-comment field in `document-comment-hooks.ts` and `agreeWithAi` from
   `IClientCommentParams` in `shared/shared.ts`.
3. **Keep `IAgreeWithAi` and the `agreeWithAi` field in `src/lib/firestore-schema.ts`.** They
   describe comments already stored, which `on-comment-rated.ts` reads on the deletion path.
4. This is type-only. `postDocumentComment` stores `{...comment}`, so a hand-crafted call could
   still write the field; what makes that harmless is that nothing reads it, which the Track B
   cutover already achieved. Do not describe this as closing a hole.

**Verify:** `npm test` and `npm run lint` at the root, plus the chat Cypress specs — this is the
only task in this plan that touches client files, so it is the only one the functions-v2 suite does
not cover.
**Commit:** `refactor: remove the dead agreeWithAi client write path (CLUE-645)`

---

## Suggested order

Task 1 immediately (independent PR). Task 2 in parallel (not code). Then 3 → 4 → 5 → 6 on a
`CLUE-645` branch — reviewable and mergeable before CLUE-371's branch lands, since `onCommentRated`
is inert until summaries exist (its no-summary skip is the designed behavior, and merging early
means the trigger swap is already soaked). Track C (7 → 8 → 9 → 10) as a second PR once
`CLUE-371-ai-feedback-text-and-images` merges, starting with the reconciliation pass.

## Acceptance (done when…)

1. Rules reject out-of-enum rating values and allow toggle-off, with tests in `firebase-test/src`.
2. Rating an Ada comment on an analyzed document updates its summary's `aiAgreements` and counts;
   the next evaluation of a similar document carries the agreement counts in its prompt.
3. Rating a human comment records an `isAiComment: false` entry that never reaches the prompt.
4. Toggle-off, re-rating, and comment deletion (including legacy `agreeWithAi`-only comments) all
   reconcile entries and counts — and reconverge correctly under duplicate or out-of-order event
   delivery; the summary document itself is never created or deleted by the rating trigger.
5. Re-analysis of a rated document refreshes its summary and preserves its agreements; first
   analysis initializes empty agreements and zero counts.
6. No client files changed; `summaries` remains admin-only. Track B changes no indexes; Track C adds
   `root` and `space` to the `summaries` composite index (see 9).
7. A rating on a document with no summary produces an info log and nothing else.
8. The deployed `onDocumentSummarized` trigger is deleted in the same cutover that deploys
   `onCommentRated`; the `package.json` deploy script is updated to match.
9. The related-summaries lookup returns records from its own realm only, and the index it needs is
   deployed before the function that queries it.

## DEVIATIONS

Where the code disagrees with this plan or the design doc, prefer the code, and record the
departure and reason here (and in the design doc when it changes a decision).

### Task 1, as merged in PR #2990

- **Narrower than the plan's step 3 and step 4.** `agreeWithAi` was not added to the read-only
  sets, and no field is forbidden at creation. Reason: keeping the change small, decided after the
  create-path clause was found to close only half of its own path (the `postDocumentComment_v2`
  callable stores whatever a caller sends, and rules do not govern it). Both are recorded as
  accepted residues in the design doc's Prerequisite section; the `agreeWithAi` path closes when
  Task 5's cutover deletes `onDocumentSummarized`. The rules tests for those cases were removed
  with them, so the file holds 40 tests, not the larger set the plan's step 5 lists.
- **Wider than the plan in one respect, which acceptance criterion 6 did not anticipate.** It
  touches two client files: `shared/shared.ts` gained `kRatingValues`, and
  `src/components/chat/comment-card.tsx` now derives its rating buttons from that list, so a
  fourth value fails to compile until it has a label and an icon. It also adds
  `src/components/chat/comment-rating-rules.test.ts`, which reads `firestore.rules` and fails if
  either block's list drifts from `kRatingValues` — the same pattern as
  `tutor-provider-rules.test.ts`. This was a code-review requirement: the `firebase-test` suite
  does not run in CI, so that pin test is the only CI coverage the rules change has until
  `ci-firebase-rules-tests` lands. Read acceptance criterion 6 as "no client behavior changes".
- **The design doc's Prerequisite rationale was wrong and has been corrected.** It claimed a
  rating value reaches peers' prompts today. Nothing in the pipeline reads comment `ratings` at
  all yet; only the comment UI does. The exposure arrives with Task 5, which is what makes the
  enum a prerequisite. The value that reaches prompts today is the legacy `agreeWithAi.value`.

### Track B ordering, and where the `AiAgreement` types landed

- **Task 6 runs before Tasks 3, 4 and 5**, at the requester's direction: it is the second half of
  the ticket's prerequisite acceptance criterion, and the only defense that covers rating values
  already stored and the `demo`/`dev` realms, which rules do not govern.
- **Task 6 creates `functions-v2/src/summary-types.ts` and puts the `AiAgreement` types in it**,
  which the plan assigns to Task 3. Task 6's AI-only filter needs `AiAgreementV2.isAiComment`, so
  the type has to exist by then; landing it in its final home the first time avoids writing it
  twice in the file both this change and `CLUE-371-ai-feedback-text-and-images` touch. Task 3 is
  correspondingly narrower: `Summary` moves, and `AgreementValue` is deprecated.
- Task 6 also drops `ai-categorize-document.ts`'s `AgreementValue` import. The cast it served
  (`cur.value as AgreementValue`) is gone: after the enum filter the value is a `RatingValue` by
  check, not by assertion.

### Task 3, as implemented

- **`Summary` moves in Task 5, not Task 3.** The plan calls step 2 a move out of
  `on-document-summarized.ts`, but that function is still live and still writes the old shape
  (`createdAt`, and none of `analyzedAt`, `numAgreements`, `adaCommentId` —
  `on-document-summarized.ts:165-177`). Defining the new `Summary` here would not move anything: it
  would add a second type of that name with no consumer until Task 5, while the old one stayed put.
  Task 5 deletes that file and adds `on-comment-rated.ts`, so the type and its first user land in
  the same commit.
- **`AgreementValue` is deleted, not deprecated.** The plan keeps it as an alias because dropping it
  "would touch client files and `shared/ai-analysis-messages.ts`". That was true before PR #2990;
  on current master the only live consumer in the tree is `shared/ai-analysis-messages.ts`, where
  `Agreements` now keys off `RatingValue` directly. A deprecated alias with one consumer in the same
  directory is a name new code can pick by mistake, not a courtesy.
  `CLUE-371-ai-feedback-text-and-images` does not touch either changed line — its edits to that file
  start at `defaultAiPrompt` — and its other `AgreementValue` references are in the two files Task 6
  already rewrote.

### Task 5, as implemented

- **The whole `aiAgreements` map is written, rather than per-entry `FieldPath` updates.** The plan
  calls for `FieldPath` because an entry key holds ids that may contain dots, which `update()` would
  read as a path. Inside the transaction the whole map has already been read and the correct map
  computed, so `transaction.update(ref, {aiAgreements, numAiAgreements, numAgreements})` writes it
  as one field: dot notation never enters the picture, and a removal is simply absence from the new
  map. That removes the hazard instead of steering around it, and it is the direct expression of
  "reconcile from the snapshot". Cost is unchanged — one document write either way. The plan's
  dot-in-an-id case is still tested, and still passes.
- **`isAiAgreement` lives in `summary-types.ts`** and is called by both the count in this function
  and `isPromptableAgreement` on the read side, so "a version-1 entry is an AI agreement by
  construction" is written down once.
- **`Summary` moved here**, per the Task 3 deviation above: `on-document-summarized.ts` is deleted
  in this commit, so the type and its first consumer arrive together.
- **The deployment cutover is not in the commit.** `functions-v2/package.json` gains
  `deploy:onCommentRated` in place of `deploy:onDocumentSummarized`, but removing the export does
  not remove the deployed trigger. Whoever deploys must run `firebase deploy --only functions` and
  accept the prompt to delete `onDocumentSummarized`, or run
  `firebase functions:delete onDocumentSummarized` straight after deploying `onCommentRated`. The
  two must not be live at once: the old one still deletes a summary when its last agreement goes,
  which contradicts the never-delete invariant.
- **The tests were checked by breaking the code, not by running them against a previous version** —
  there is no previous version, and `onDocumentSummarized` had no tests. Six guards were each
  disabled in turn (enum filter, stale-event guard, max-merge guard, legacy v1 removal on deletion,
  never-delete-the-summary, and the nothing-to-write short circuit) and each was caught by at least
  one test. Two gaps found that way have been closed: nothing covered a timestamp being rewound by
  an agreeing stale event, and the two "no write" tests could not tell a skipped write from an
  identical one, because the emulator does not move `updateTime` when the data does not change.
  Both now assert on the log line instead.
