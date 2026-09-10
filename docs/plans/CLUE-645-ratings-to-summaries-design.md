# Ratings → Document Summaries Design (CLUE-645)

> Supersedes the 2026-08-20 draft. Restructured 2026-08-24 after design review: summary creation moves
> out of the comment trigger and into the analysis pipeline, per the review's counter-proposal. The
> review's finding numbers (#1–#10) are referenced below where they shaped a decision. Related:
> CLUE-607 is now scoped solely to personal documents and builds on this work.
>
> **Ordering:** CLUE-371 "text+image always" (`docs/plans/CLUE-371-production-mixed-mode.md`) is a
> **decided direction with work in progress** — as of 2026-08-27 the harness-related `shared/` moves
> are merged to master and the pipeline branch (`CLUE-371-ai-feedback-text-and-images`) is paused
> only on a small bug-fix merge and rebase, not on any open decision. This design's **default
> integration point is therefore the post-CLUE-371 pipeline** (summary write in its single
> categorize flow, gated on `sendSummary`), and CLUE-645 implementation should sequence after that
> pipeline refactor lands so the integration is built once, in the same files, rather than built in
> `categorizeSummary` and migrated. The prerequisite rules fix has no such dependency and ships
> immediately. If schedules invert, the contingency (today's text-summarizer branch) is preserved
> under Coverage; only the integration point and day-one population differ.

## Motivation

The AI feedback pipeline was built to learn from student agreement: a student's verdict on an AI
("Ada Insight") comment is recorded on the document's summary, and later evaluations of similar
documents include it in the prompt ("Other users agreed with this summary as follows: yes: 3, no: 1").

That loop is broken in two places. The input signal moved — CLUE-397 replaced the Ada-only agree
buttons with rating buttons that write to a `ratings` map, while the backend still reads the
now-unwritten `agreeWithAi` field. And recording was hardcoded to the `cas` unit.

The previous draft fixed this in place, inside `on-document-summarized`: a comment trigger that read
the Firestore metadata doc, reconstructed an RTDB path, re-summarized the document's current content,
embedded it, and wrote a summary. Review showed that nearly every complication in that draft —
the unit allowlist, the full-context gate, the realm-path fix, the `documentId`-vs-`key` split — was
compensation for putting document work in a comment trigger that lacks context the analysis pipeline
already has. This revision moves the document work to where the context lives.

**The shape in one paragraph:** the analysis pipeline, which already computes the document summary
(`on-analysis-document-pending`) and already computes an embedding of it only to throw it away
(`findRelatedSummaries`), now persists both to `summaries/` at the end of a text-summarizer analysis
run — before it posts Ada's comment. A new, single-purpose comment trigger (`onCommentRated`,
replacing `on-document-summarized`) diffs the `ratings` map and upserts labeled agreement entries
onto a summary that already exists. It never creates a summary, never reads RTDB, never summarizes,
never embeds.

Two consequences fall out by construction. The recorded population is exactly the population the
lookup can use — documents the pipeline actually summarized — so there is no unit allowlist to
hand-maintain and no context gate to enforce. Today that population is the text-summarizer units;
once CLUE-371 lands it becomes every document analyzed by a real evaluator whose summary is worth
sending (see Coverage), making the team's original claim — any unit with AI evaluations by
necessity has agreements — true by construction. And each agreement is recorded against the summary
Ada actually evaluated at the time, rather than a re-summarization of whatever the document says at
rating time. (On re-analysis the stored summary is refreshed in place while agreements are
preserved, so older agreements can drift relative to the newer summary — an accepted trade-off, see
Pipeline change 4 and Resolved Decision 7.)

## Prerequisite (ship first, as its own PR): validate rating values (#10)

A rating value is arbitrary client-supplied text: `isValidRatingUpdate` (`firestore.rules:432`,
`:610`) checks only which map key changed. A student can store any string as their own rating by
writing to Firestore from the browser console.

Today that string is read only by the comment UI (`comment-card.tsx:29-32`); nothing in the analysis
pipeline reads comment `ratings` at all. The exposure arrives with Task 5, which records rating
values on summaries: `mapRelatedSummaries` then keys its agreements record by the raw stored value,
and the prompt builder interpolates that key verbatim into prompt text, so an unchecked value would
reach peers' categorization prompts. Hence "prerequisite" — the enum must land before rating values
are read, not after, or the first values recorded can already be arbitrary.

The channel that is live today is the legacy `agreeWithAi.value`: `onDocumentSummarized` copies it
into `aiAgreements` with no author or value check, and that record is what the prompt builder reads.
Task 5 deletes that consumer; the read-side filter below is what covers values already stored.

- Both rule blocks: add
  `(!(userId in newRatings) || newRatings[userId] in ['yes', 'no', 'notSure'])` — the first clause
  is what permits toggle-off, where the user's key is absent from the new map. (A `get()`-with-default
  formulation silently rejects the delete case; the rules test below must cover it explicitly.)
- **Close the author bypass** (found in code review): the comment-update rule authorizes the
  author-edit branch OR `isValidRatingUpdate()`, and `ratings` was writable by the edit branch — so
  a comment's author could write arbitrary ratings on their own comment without ever hitting the
  enum. Fix: list `ratings` in `preservesReadOnlyCommentFields()`'s read-only set in both blocks,
  so every ratings write — authors included — must pass `isValidRatingUpdate()`. An author rating
  their own comment still works (fails the edit branch, passes the rating branch).
- **Two accepted residues (decided 2026-08-31, simplifying an earlier broader plan).** The create
  path is left as-is: `isValidCommentCreateRequest()` forbids no extra fields, so a hand-crafted
  create can seed a `ratings` map on one's own comment. Accepted: it is a data-integrity nuisance
  only — out-of-enum values are dropped at ingestion (Task 5's reconcile), and because the comment
  is the fabricator's own, its entries carry `isAiComment: false` and Task 6 keeps them out of the
  prompt — and the app itself creates comments through the `postDocumentComment_v2` admin callable,
  so no honest path is involved. And `agreeWithAi` is left untouched by the rules: until Task 5's
  cutover deletes `onDocumentSummarized`, a hand-crafted `agreeWithAi` on a `cas`-unit comment is
  ingested with no author or value check and its raw value can reach peers' prompts. Accepted given
  the user population and the fact that this window has existed since 2025-07 without observed
  abuse; **the Task 5 cutover is the closing event**, and the finding is recorded on the ticket.
- Read side: `mapRelatedSummaries` drops values outside the enum instead of passing them through as
  prompt-visible labels. Rules validate values in `authed` only: `demo` and `dev` let any signed-in
  user write anything (`firestore.rules:880-889`), and `qa`/`test` allow the same inside the
  writer's own root (`:890-899`). This is the second line of that defense rather than the first —
  Task 5's ingestion drops out-of-enum values before they are stored, and no client can write
  `summaries` in any realm, since no rule matches that collection and it falls through to the
  catch-all deny (`:11-13`). What the read side uniquely covers is what is already stored: the
  version-1 entries `onDocumentSummarized` copied out of `agreeWithAi` with no value check.
- **What the read side does not defend against, and why it is left to the write path** (added
  2026-08-31 after a review finding; the containment argument above used to be stated more broadly
  than it holds). `demo` and `dev` allow any signed-in user to write anywhere
  (`firestore.rules:880-889`), and `qa`/`test` allow the same inside the writer's own root
  (`:890-899`). So in those realms the `ratings` map on **someone else's** comment — Ada's included
  — can be replaced wholesale with forged rater keys. Those entries carry valid values, and
  `isAiComment` is derived from the *comment's* author rather than the rater's, so it is `true`:
  neither the enum filter nor Task 6's AI-only filter removes them. They inflate `numAiAgreements`
  and their counts reach the prompts of other documents in the same class, unit and problem in that
  realm. **The enum filter validates values, not attribution**, and no read-side filter can supply
  attribution that was never recorded.
  Attribution is enforced on the write path instead, which is where it belongs: in `authed`,
  `isValidRatingUpdate()` limits a write to the actor's own key, so production is closed. The open
  realms are open deliberately, so testing can write anything, and their data has always been test
  data. Accepted on that basis.
  **Do not answer this by restating the check inside `onCommentRated`.** That function reconciles
  from a fresh snapshot precisely so that lost and reordered events converge; scoping an event to
  its actor's key would make a lost event unrepairable, trading a test-realm data-integrity nuisance
  for a production correctness bug. If the open realms ever need closing, close them in the rules.
- Same treatment for the legacy `agreeWithAi.value` read path while it exists.

## Requirements

- A rating on an Ada comment is recorded as a labeled agreement on that document's summary and
  influences future evaluations of similar documents via the existing agreement-count prompt sentence
- Ratings on human comments are recorded with the same mechanism, labeled `isAiComment: false`, but
  are **not** fed to the prompt in this step (sequencing, not reversal — see Resolved Decision 6)
- Rating add, change, and removal (toggle-off) all update the summary correctly; deleting a comment
  removes its agreement entries
- Agreements carry a server-side timestamp so agreement shifts can be analyzed over time; no client
  schema change is needed for this
- No changes to the chat UI, the `ratings` write hook, or the rating data shape; the only rules
  change is the value validation above
- Group documents participate exactly like problem documents (they are text-analyzed the same way);
  personal and learning-log documents are out of scope pending CLUE-607
- Ratings on curriculum comments (`curriculum/**/comments`) are out of scope: no document, no
  summary, no trigger

## Data Model

### `summaries/{summaryId}` (written by the pipeline)

```typescript
interface Summary {
  key: string;                    // canonical document key
  root: string;                   // realm root of the document ("authed", "demo", "qa", "dev", "test")
  space: string;                  // portal, demo name, or instance id that follows the root
  context_id: string;
  unit: string;
  investigation: string;
  problem: string;
  offeringId: string;
  summary: string;                // the text Ada evaluated
  summaryEmbedding: FieldValue;   // vector, reused from the analysis run
  analyzedAt: number;             // server time of the most recent analysis run
  adaCommentId?: string;          // the MOST RECENT Ada comment; agreements may span older ones
  numAiAgreements: number;        // entries with isAiComment === true (includes version-1 entries)
  numAgreements: number;          // all entries (informational; NOT a query filter in this step)
  aiAgreements: Record<string, AiAgreement>;   // keyed "{commentId}_{raterUid}"; v1 keys are the rater's bare uid
}
```

`summaryId` must be derived identically by both writers, so the shared helper takes
`(root, space, key)` explicitly. The pipeline passes the metadata document's `key` field — which
`findRelatedSummaries` already fetches — with root/space parsed from `firestoreDocumentPath`;
`onCommentRated` passes the parent document's `key` with root/space from its trigger params. Neither
writer ever derives the id from a queue `docId` or the trigger's `documentId` param (which can be a
legacy network-prefixed id — review #5): both go through `key`, so they agree by construction
rather than by the coincidence that a path segment happens to equal the key.

`root` and `space` are stored so the lookup can be **scoped to one realm** — see "Realm scoping"
below. They duplicate what the `summaryId` already encodes, deliberately: the id is not queryable,
and the query is what needs the constraint.

The agreement filter **stays `numAiAgreements > 0`**, and the existing corpus (a handful of legacy
records at most) stays visible (#1). `numAgreements` is stored for analysis and for the future
endorsement step, which will do its own index work.

### `AiAgreement` (written by `onCommentRated`)

```typescript
interface AiAgreement {
  version: 2;
  value: "yes" | "no" | "notSure";   // one shared type; collapse AgreementValue/RatingValue duplication
  raterUid: string;
  commentId: string;
  commentUid: string;                // the rated comment's author
  isAiComment: boolean;              // commentUid === kAnalyzerUserParams.id ("ada_insight_1")
  content: string;                   // the rated comment's text at rating time (stored, not prompted)
  tags: string[];
  updatedAt: number;                 // from the trigger's event.time — server-side, no client change
}
```

Entry keys contain ids; write them with `FieldPath` rather than dot-notation strings so an id
containing `.` or other special characters cannot break the update.

**Legacy version-1 entries** (keyed by the rater's bare uid, no `commentId`, from the old
`agreeWithAi` flow — which attached the flag to a new comment by the rater, not to Ada's) are
left in place, count toward `numAiAgreements`, and are not migrated. A user who agreed under the old
flow and re-rates the same Ada comment produces a second (v2) entry — accepted: the v1 corpus is a
handful of records, effectively one demo document (#9).

## Pipeline Changes

All in the analysis functions as they exist after CLUE-371's pipeline refactor: the pending
function always produces a `docSummary` and records `sendSummary` / `sendImage` per document, and
the imaged function sends one request through the shared builders (CLUE-371 items 5–6). The summary
write is **gated on `sendSummary`**: a `sendSummary: false` summary is scaffolding-only (no
student-authored text), so an agreement pinned to it is low-value and its embedding pollutes the
vector search; `mock` runs produce no representations and are naturally excluded. (Contingency
ordering — today's pipeline: the same changes anchor to the text-summarizer branch, where there is
no `sendSummary` concept and every text-branch analysis writes a record.)

1. **Hoist the embedding.** `getEmbeddings` currently runs inside `findRelatedSummaries` and the
   vector is discarded after the query. The categorize function
   (`categorizeDocumentRepresentations` post-refactor; `categorizeSummary` under the contingency)
   computes it once when a summary is being sent, passes it into `findRelatedSummaries` as a
   parameter, and hands it to the summary write — one call site either way.
2. **Handle `getEmbeddings` returning `undefined`** (it does, on any OpenAI error). Today
   `FieldValue.vector(undefined)` would silently persist a zero-dimension vector — a permanently
   poisoned record, since the existing "reuse if summary unchanged" check treats it as present. On a
   missing vector: skip the summary write, log, and let the run continue to the Ada comment. Never
   write a summary without a real vector. (Also fix the identical latent hazard on the query side,
   where an `undefined` query vector fails `findNearest`.)
3. **Write the summary before posting Ada's comment** in `on-analysis-document-imaged`. Ordering
   matters: if the comment appeared first, a fast rating could reach `onCommentRated` before the
   summary exists and be dropped.
4. **The write has two explicit paths — create and update — because "field-scoped merge that never
   touches the counts" and "counts are non-optional on `Summary`" cannot both hold on first
   creation.**
   - *Create* (no record exists): write the full record, initializing `aiAgreements: {}`,
     `numAiAgreements: 0`, `numAgreements: 0` alongside `key`, the context fields, `summary`,
     `summaryEmbedding`, `analyzedAt`, `adaCommentId`.
   - *Update* (record exists): write **only** `key`, the context fields, `summary`,
     `summaryEmbedding`, `analyzedAt`, `adaCommentId`; never touch `aiAgreements` or either count.
   Do the exists-check and write in a transaction (ratings can arrive concurrently). Two sibling
   tests: "first analysis initializes the counts" and "re-analysis preserves agreements."

   **Accepted trade-off (review fix 4, Resolved Decision 7):** the update path refreshes `summary`
   and `summaryEmbedding` in place while preserving agreements, so an agreement made against an
   earlier summary stays attached to the newer text — content drift moves from rating time to
   analysis time, it is not removed. Accepted because only per-value *counts* reach the prompt,
   never the drifted pairing of one agreement with one summary. If that stops being acceptable
   (e.g. once endorsement text ships), the fix is known: stamp `analyzedAt` on each agreement at
   write time and count only agreements matching the current summary's `analyzedAt`.

Note the summary/embedding cost profile *improves*: embeddings are computed once per analysis run
(where an OpenAI call is already being made) instead of on every rating click, and ratings cost one
transactional Firestore update.

Post-CLUE-371 nuance: under mixed mode, agreements reach the prompt only on requests that include
the summary (`mixed` or `summary-only` message shapes). An `image-only` request — a document whose
text was omitted — carries no related summaries and therefore no agreement counts. That is
consistent, not a gap: such a document also gets no `summaries/` record (the `sendSummary` gate
above), so it neither contributes agreements nor receives them.

## `onCommentRated` (replaces `on-document-summarized`)

Same trigger pattern (`{root}/{space}/documents/{documentId}/comments/{commentId}`), one job:

1. Use `before.ratings` vs `after.ratings` only as a proceed/skip filter (with comment deletion
   handled first — a deleted legacy comment has an unchanged-empty ratings diff but still needs its
   v1 entry removed). Firestore events are at-least-once and unordered, so the source of truth is a
   fresh read of the comment inside the transaction: rebuild this comment's entries to match its
   current `ratings` map, so duplicate and out-of-order events converge and a late event cannot
   resurrect removed state. Drop values outside the enum (prerequisite, read-side defense), and
   normalize optional comment fields (`tags` may be absent) before writing.
2. Read the parent document once for `key` (summary id derivation) and skip curriculum-path or
   missing docs.
3. Load `summaries/{summaryId}`. **If it does not exist: log at info level with the document key and
   skip.** This function never creates a summary (no summarization, no RTDB read, no embedding, no
   realm-path reconstruction — those responsibilities are gone, and the realm bug and dead-path
   failure modes (#4, #5) go with them).
4. In a transaction: upsert or delete `aiAgreements` entries via `FieldPath`, then **recompute both
   counts from the map contents** — never increment (#Worth-fixing). Fix the latent
   `summaryData?.aiAgreements[uid]` optional-chain gap while rewriting.
5. Comment deleted (`before && !after`): remove every entry whose `commentId` matches the trigger's
   comment; for legacy comments, also the bare-uid entry keyed by the comment author (preserving the
   old flow's deletion semantics, resolving #9's ambiguity).
6. **Never delete the summary.** `numAiAgreements: 0` already drops it from the lookup; the summary
   and its embedding belong to the analysis, not to the ratings (#7).
7. Timestamps come from `event.time`, converted to epoch milliseconds (`Date.parse` — `event.time`
   is an ISO string in the v2 typings); `analyzedAt` likewise stores epoch milliseconds
   (`Date.now()` at write). Because a stale early event can reconcile an entry to the current value
   while stamping the older event's time, an event whose own `after` value matches the snapshot
   repairs the entry's `updatedAt` to `max(stored, event time)`; a stale event whose `after`
   disagrees with the snapshot leaves matching entries' timestamps untouched.

The legacy `agreeWithAi` ingestion branch is dropped: nothing has written that field since 2026-02-25
(`adb9762a55`), and existing v1 entries in `summaries` are preserved by rule 5's deletion handling.

### Realm scoping (Track C requirement, added 2026-08-31)

`summaries` is a single flat collection. The `summaryId` begins `{root}-{space}-`, but ids are not
queryable, and `findRelatedSummaries` filters only on `context_id`, `unit`, `problem`,
`investigation` and `key !=`. Nothing confines a match to the realm the query came from, so a record
written under one realm can be returned to a document being analyzed in another whenever those
context fields coincide. That matters because the open realms let a signed-in user author both the
context fields and the agreement counts (see the Prerequisite section), which is a route for
test-realm data to reach a production prompt.

Untriggered today: the collection holds one record and nothing writes to it. It becomes reachable
the moment Track C starts populating it, so Track C must close it, not discover it:

1. The pipeline writes `root` and `space` on every summary record (create and update paths alike).
2. `findRelatedSummaries` adds `.where("root", "==", root).where("space", "==", space)`, from the
   same `firestoreDocumentPath` it already parses for the summary id.
3. **This changes `firestore.indexes.json`** — the composite `summaries` index (`context_id`,
   `investigation`, `problem`, `unit`, `key`, `numAiAgreements`, then the `summaryEmbedding` vector)
   needs `root` and `space` added as equality fields ahead of the vector field. Vector queries
   require an exact composite index, so the deploy has to include it or the lookup returns an error
   rather than degrading. Deploy the index **before** the function that queries it.
4. Existing records predate both fields and will not match a scoped query. Acceptable — the corpus
   is one demo record, and re-analysis rewrites it with the fields present. That holds only for a
   record already at the id the shared helper derives: `onDocumentSummarized` keyed by the metadata
   document id, which differs from `key` on older documents, so such a record is never found again
   and is stranded rather than refreshed. Consistent with Resolved Decision 3 (no backfill), and
   the one production record is not one of them.

## Read Side

`findRelatedSummaries` is unchanged in its filters (`numAiAgreements > 0`, class/unit/problem/
investigation, `key !=`) and its context guard — which now describes reality: documents without full
context simply never acquire a summary, so the no-summary and no-lookup cases line up exactly.
Changes: it receives the query embedding as a parameter (Pipeline change 1), and `mapRelatedSummaries`
counts only entries with `isAiComment === true` (v1 entries count as AI) and drops out-of-enum values.
The prompt text is otherwise untouched — counts only; no student prose is sent beyond what is sent
today.

## Migration and Compatibility

- **Ratings on Ada comments that predate this deploy** have no summary to land on until their
  document's next analysis run; `onCommentRated` logs and skips them. Accepted: the `summaries`
  corpus is measured, not estimated — CLUE-371 spike finding 6a found the collection holds exactly
  one document — no agreements have been recordable outside `cas` since the feature shipped, and
  the input signal has been disconnected since March. There is no live population to strand, and
  the info-level log makes the size of this gap observable in practice. A corollary worth stating:
  since the collection has held one demo record, `findRelatedSummaries` has never returned anything
  in production — **this change is the first time the related-summaries feature runs end to end**,
  so treat early production behavior as a first run, not a regression baseline.
- **No client deploy is required.** The web app is untouched; the rules change (prerequisite) and the
  functions deploy are independent.
- **No index deploy for Track B.** The lookup filter is unchanged by the trigger work. Track C's
  realm scoping does change `firestore.indexes.json` — see "Realm scoping" above.
- **`summaries` stays admin-only**: it falls through to the rules catch-all deny, which is correct —
  note here so nobody adds a client read later.

## Coverage

**Default (post-CLUE-371, the expected ordering):** unit-level coverage is total by construction —
every unit whose `aiEvaluation` is `categorize-design` or `custom` produces a summary on every
analysis run, with `aiPrompt.summarizer` deleted/ignored and nothing to configure. That includes
the currently image-summarized units (`aplus`, `brain`, `seimic`, `mods`); MODS is covered
automatically, satisfying the original story's "use MODS as the example" (the change in what its
feedback is based on is decided and safety-checked inside CLUE-371, not here). What remains
excluded is per-*document*: `sendSummary: false` documents (no student-authored text) and `mock`
runs.

**Contingency (if this work somehow lands on today's pipeline first):** coverage is the units
confirmed 2026-08-24 as `aiPrompt.summarizer: "text"` — `vibe`, `clueful`, `m2sAI` — plus `cas` via
the pending function's hardcoded fallback; the image units are untouched until CLUE-371 converts
them, and "use MODS as the example" waits with them.

Between the two orderings only the integration point and the day-one population differ; nothing
else in this design changes.

## Resolved Decisions

1. **Peer endorsement values and AI-agreement counts are never conflated** in storage or prompt.
   *(2026-08-20, requester.)*
2. **Gating history:** cas-first allowlist → remove entirely → allowlist + context gate → **no gates:
   summary existence is the gate**, an emergent property of "the pipeline writes summaries when it
   analyzes a document and sends its summary." Nothing to hand-maintain. Today a unit opts in via
   `aiPrompt.summarizer: "text"`; post-CLUE-371 every AI-evaluation unit is covered automatically
   (see Coverage). *(Revised 2026-08-24 per review counter-proposal; supersedes all earlier
   versions.)*
3. **No backfill** of legacy `agreeWithAi` comments; v1 entries readable, not migrated. *(2026-08-20.)*
4. **No throttle**; the cost profile now improves by construction. *(2026-08-20, moot 2026-08-24.)*
5. **No client-side rating timestamp.** `IRating` is dropped; `AiAgreement.updatedAt` is stamped
   server-side from `event.time`, and the existing `RATE_COMMENT_*` log events (which fire on every
   click, including toggle-off) remain the fine-grained history. This also dissolves the
   `shared/shared.ts` type-dependency blocker (#2). *(Revised 2026-08-24; supersedes the 2026-08-20
   timestamp decision.)*
6. **Peer endorsements: recorded now, prompted later.** The signal is captured from day one with
   `isAiComment: false`; wiring it into the prompt is a separate follow-up gated on prompt-injection
   fencing, selection criteria (which values, minimum bar, Ada exclusion), a length cap, and sign-off
   on sending student prose to OpenAI in bulk (#6, #8). *(2026-08-24; sequencing of the 2026-08-20
   decision, to be confirmed with the requester.)*
7. **Summary drift on re-analysis is accepted.** Re-analysis refreshes `summary`/`summaryEmbedding`
   in place while preserving agreements, so an older agreement sits attached to newer summary text.
   Accepted because only per-value counts reach the prompt. The known fix if this stops being
   acceptable — stamp `analyzedAt` on each agreement and count only those matching the current
   summary — is recorded at Pipeline change 4. *(2026-08-24, per review of this revision.)*

## Open Questions

1. **Retention — deferred, deliberately.** A summary (a generated description of student work) now
   persists for every analyzed document whose summary is sent — post-CLUE-371 that is every
   AI-evaluation unit — with a 1536-dimension vector each, no expiry, and no deletion path. The
   decision is to ship with indefinite persistence and revisit with real data, for three stated
   reasons. (a) *Deferral forecloses nothing:* the schema already stores `analyzedAt`,
   `context_id`, `offeringId`, and `unit`, which is exactly what either alternative needs — a
   native Firestore TTL on `analyzedAt` is a console setting, and an offering-lifecycle sweep is a
   query. (b) *There is nothing to measure yet:* the lookup has never returned anything in
   production (see Migration), so storage growth and vector-index behavior at scale can only be
   priced from real data. (c) *With one condition:* this is a change in kind, not just volume —
   CLUE has not previously kept a permanent, queryable, AI-generated description of every student
   document — so whoever signed off on CLUE-371's production data handling gets a heads-up before
   this starts accumulating, even if the answer is "fine, leave it."

  The heads-up has been given. We are OK with it but will monitor in case any related problems arise.

2. **Documents commented on but never analyzed get no summary.** Correct under this step's scope
   (only Ada-comment ratings feed the prompt, and an Ada comment implies an analysis). It becomes a
   real constraint for the future endorsement step — put to the team before that step is designed.
3. ~~Which units set `aiPrompt.summarizer: "text"` today?~~ **Resolved 2026-08-24** — see Coverage.
   Under the expected ordering the field is deleted by CLUE-371 and coverage is total; the
   confirmed lists define coverage only in the contingency ordering.

## Testing

Functions tests live in `functions-v2/test/` (emulator suites follow `*-emulator.test.ts`,
jest `maxWorkers: 1`); rules tests live in `firebase-test/src`. `on-document-summarized` has no
existing tests — `onCommentRated`'s suite is new; `functions-v2/test/map-related-summaries.test.ts`
covers the read side and is extended.

- `onCommentRated`: diff cases (add/change/remove, unchanged map, out-of-enum values dropped);
  keying and `FieldPath` writes; counts recomputed from map; `isAiComment` labeling; no-summary →
  logged skip, no write; comment deletion removes v2-by-commentId and legacy v1-by-uid entries;
  never creates or deletes a summary
- Pipeline: summary written before Ada comment; first analysis initializes the counts
  (`aiAgreements: {}`, both counts 0); re-analysis updates only the summary fields and preserves
  existing agreements and counts; missing embedding → no summary write, run still completes;
  summary id derivation matches `onCommentRated`'s (shared-helper fixtures run through both writers
  via `(root, space, key)`)
- Read side: AI-only counts (v1 included), out-of-enum values dropped, embedding passed as parameter
- Rules (`firebase-test/src`): value enum accepted/rejected, key-scoping unchanged, and an explicit
  toggle-off test — deleting your own key must be **allowed** with the enum clause present (the
  case a `get()`-with-default formulation gets wrong)

## Files to Modify

| File | Change |
|------|--------|
| `firestore.rules` | Prerequisite: rating value enum in both `isValidRatingUpdate` blocks |
| `functions-v2/src/on-document-summarized.ts` | Replaced by `on-comment-rated.ts` (new, single-purpose) |
| `functions-v2/src/on-analysis-document-imaged.ts` | Summary create/update write before Ada comment; embedding reuse |
| `functions-v2/lib/src/ai-categorize-document.ts` | Hoist/parametrize embedding; AI-only counts; enum filtering; `undefined`-vector handling — in `categorizeDocumentRepresentations` (post-refactor), or `categorizeSummary` under the contingency ordering |
| `functions-v2/src/index.ts` | Export swap |
| `shared/shared.ts` | Collapse `AgreementValue`/`RatingValue` into one type; `AiAgreement` v2 type |
| Shared summary-id helper (new, alongside path helpers) | Canonical `summaryId` derivation for both writers |
| `functions-v2/test/…` | New `onCommentRated` suite; pipeline-write and read-side test updates |
| `firebase-test/src/…` | Rules tests for the value enum |
| `firestore.indexes.json` | Track C: `root` and `space` added to the `summaries` composite index (realm scoping) |

Client files do change, though client behavior does not. Track A moved the rating values into
`shared/shared.ts` and had `comment-card.tsx` derive its buttons from them; Track C removes the
retired `agreeWithAi` parameter from `chat-panel.tsx` and `document-comment-hooks.ts`. The
stored-comment schema keeps `agreeWithAi`, which `onCommentRated` reads when a legacy comment is
deleted.

## Deviations (Track C, 2026-09-01)

Where this document and the code disagree, prefer the code. The full reconciliation list is in the
implementation plan under DEVIATIONS; recorded here are the three that change something this
document states.

1. **`summaryEmbedding` is a `VectorValue`, not a `FieldValue`** (Data Model). `FieldValue.vector()`
   is what produces a vector; `VectorValue` is what a vector is, and what a read gives back. The
   type had never had a writer, so nothing had caught it.
2. **The categorize function is `categorizeRepresentations`** (Pipeline change 1), and hoisting the
   embedding out of `findRelatedSummaries` also hoisted the metadata read, because the summary write
   needs the same fields the lookup does and reading them twice would be two reads of one document.
3. **A failed summary write does not fail the run** — it is logged, and Ada's comment is posted
   anyway. Pipeline change 3 fixes the *order* of the two writes but says nothing about what happens
   when the first one fails. The evaluation succeeded and the student is owed its feedback; a
   missing record costs only ratings of that comment, which `onCommentRated` already logs and skips,
   and the next analysis writes the record again.

Unchanged by reconciliation, and worth restating because it is the one thing here that has to
happen in a particular order outside the code: **the `summaries` composite index carrying `root`
and `space` must be deployed and built before the functions deploy.** Note the failure mode is
quiet, not loud: a missing index fails the query with `FAILED_PRECONDITION`, which
`categorizeRepresentations` catches and continues past, so the wrong order costs agreement counts
in prompts without anything appearing to break. The measured procedure is in the implementation
plan under "Deploying Track C".
