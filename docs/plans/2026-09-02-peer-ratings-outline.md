# Peer Ratings — Plan Outline

> **Status: outline, not a design.** Short on purpose: a few decisions below change how much work
> this is, and detail written before they are made is likely to be detail about the wrong thing.
>
> Follows on from CLUE-645 (`CLUE-645-ratings-to-summaries-design.md`), which records peer ratings
> but does not use them. Written 2026-09-02, the day Track C shipped to production. Revised
> 2026-09-03 twice: first after reading the merged read path, which showed the reshaping in step 2
> was missing and that the sign-off question had been closed with an argument that did not answer
> it; then again to stop treating the (nearly empty) rating corpus as something to measure before
> deciding anything. Revised 2026-09-04: summary drift is decided (send everything), and the
> re-analysis frequency it turned on was wrong here — see the Closed section.

> **Superseded as a plan, 2026-09-11.** The design and the implementation are in
> [`CLUE-660-plan.md`](CLUE-660-plan.md), which inherits the three decisions closed below —
> confidentiality settled by the class-scoped lookup, summary drift ignored, selection done in
> memory — without re-arguing them. Open questions 1, 3, 5 and 6 are carried forward there with
> defaults; question 2 (teacher weighting) and question 4 (a per-study switch) are recorded as out
> of scope. This file stays as the record of why the work is shaped the way it is.

## The goal

A comment written by a student or a teacher is an assessment of the document, a suggestion about
it, or a fuller agreement or disagreement with what the AI said in the thread. A comment other
people rated highly probably contains something worth knowing about that document.

So: when a related summary is sent to the AI, include the well-rated human comments on that
document, not only the count of how many people agreed with the AI.

The ratings are judgments about the comments, which is exactly what makes them useful — they tell
us which comments are worth passing on.

## What already exists

CLUE-645 records ratings of comments written by people, on the same footing as ratings of Ada's.
Each entry stores the rater, the comment's author, the comment's text and tags as they read at
rating time, and a server-side timestamp. Deleting a comment removes its entries. No client change
is needed to keep gathering the signal.

**There is almost no signal yet, and there will not be for a while.** The rating buttons are recent,
the loop that records ratings onto summaries only started working on 2026-09-02, and CLUE runs with
small research cohorts rather than a public user base. Nothing here can be settled by looking at
production data, now or next month. That is not a reason to wait — it is a reason to make each
decision below cheap to revisit, and to lean on the evaluation harness rather than on live traffic.

Two limits on "every rating" beyond the empty corpus: a rating only lands if the document already
has a summary record (see Smaller things), and out-of-enum values are dropped at ingestion. There is
nothing to backfill in the sense of a migration — the stored entries are already in their final
shape.

### What the prompt path does and does not give us

`mapRelatedSummaries` does carry each entry's `content` and `tags` forward, and `summaryContentParts`
discards them and emits only counts. So the text does already reach the message builder. It just
does not arrive there as a comment.

The structure is `Agreements = Partial<Record<RatingValue, AgreementInfo[]>>` with
`AgreementInfo = {content, tags}`. **Each element is one rating, not one comment.** There is no
`commentId`, no `raterUid` and no `commentUid` in it. That blocks most of what the selection
questions below need to ask:

- Two `yes` ratings on the same comment arrive as two unrelated elements. The only thing linking
  them is the `content` string — and `content` is captured per rating, so a comment edited between
  two ratings yields two different strings. "Rated yes by two people" is not a question this shape
  can answer.
- A `yes` and a `no` on the same comment land under different keys with nothing tying them
  together, so "does a `no` suppress a comment" is unanswerable for the same reason.
- Emitting `content` as it stands repeats one comment once per rater.
- `commentUid` is stored on the entry but is not carried, so the teacher/student question is
  blocked here too.

Two deliberate filters also stand in the way, and these are the ones CLUE-645 named:

- `isPromptableAgreement` drops every entry whose `isAiComment` is false. (It also enforces the
  rating-value enum, which must stay — see step 3.)
- The lookup only considers documents with `numAiAgreements > 0`, so a document carrying nothing
  but peer ratings is invisible to the search.

Both were choices, not oversights. But relaxing them is the small part of the work. **The regroup
is the large part**, and it was the thing this outline previously missed.

### Where the shape lives

`RelatedSummary`, `Agreements` and `AgreementInfo` are declared in `shared/ai-analysis-messages.ts`,
which production and the evaluation harness share on purpose so both build identical requests.
`scripts/ai-harness` uses them in two places: `src/messages.ts` builds its requests from them, and
`src/schemas.ts` (`validateRelatedSummary`) validates the corpus manifest against that exact shape,
with fixture `relatedSummaries` in the corpus data. Any change to the shape lands in all three.

That is a cost, and also the only way to see this working: with no production signal, synthetic
harness fixtures are the only place peer comments will reach a prompt before real classes do.

## Sketch

1. **Decide which comments qualify** — which rating values count, how many raters are needed, and
   whether a teacher's comment is treated differently from a classmate's. See open questions 1
   and 2.
2. **Reshape the read path so a comment is a thing.** Group a summary's `aiAgreements` by
   `commentId` inside `mapRelatedSummaries` and hand the builder one record per comment — its id,
   its author (`commentUid`), its text, its tags, a count per rating value, and the latest
   `updatedAt` among its ratings — instead of one element per rating. The timestamp is carried even
   though nothing sends it yet, so that the drift decision below can be revisited without a second
   shape change. Selection in step 1 then has something to select on. This is the change that
   also touches the harness schema and its corpus fixtures.
3. **Let the prompt carry the text.** Relax `isPromptableAgreement` for the comments that qualify,
   keeping its rating-value enum check (split the function rather than loosening it — the enum
   check is the only defense covering values already stored and the open `demo`/`dev` realms), and
   change `summaryContentParts` to emit the selected comments rather than only counting them. Keep
   peer values and AI-agreement counts separate in the output (CLUE-645 Resolved Decision 1).
   **Selection happens in memory, over the documents the query returned — never in the query
   itself.** A threshold in a Firestore filter needs an index and a staged deploy to change; a
   threshold in code is a constant. Since these numbers are guesses that will be revised (see the
   open questions), they belong where revising them is free, and with a handful of records in the
   collection there is no performance argument for the other choice.
4. **Fence the text, and label whose document it is about.** Two separate requirements:
   - *Fencing.* Student and teacher prose now reaches the model as content. It has to be delimited
     so it cannot be read as instructions, and capped so a long thread cannot crowd out the rest of
     the prompt.
   - *Labeling.* The prompt today introduces these as "AI generated summary of a **similar**
     document". A comment carried under that heading can be read as a comment about the document
     being evaluated, and the model can then repeat it back as though it were. Each comment needs to
     be marked as being about the other document. This is an accuracy requirement, not a
     permissions one — see the closed sign-off question below.
5. **Decide whether peer ratings alone make a document findable.** The count this needs already
   exists: `numAgreements` counts every entry and is initialized to 0 by the pipeline on every
   summary it creates, and recomputed by `onCommentRated` on every rating. It was put there for this
   step. Saying yes costs a filter swap — `numAgreements > 0` in place of `numAiAgreements > 0` —
   and one composite index carrying the new field. The swap is safe by construction:
   `numAgreements` is always greater than or equal to `numAiAgreements`, so it is strictly wider and
   nothing currently found is lost. See open question 3.
6. **Run it through the harness, then exercise it on staging** before production, following the
   pattern CLUE-645 used. The harness run is the substantive evaluation here, not a formality at
   the end.

## Open questions

None of these can be answered from production data — see "What already exists". They are judgment
calls, and the design should make them cheap to revisit rather than right the first time.

1. **Which comments qualify?** The likely starting point is a single `yes`, because anything
   stricter selects nothing in a class of twenty where most comments are rated once or not at all.
   Decide whether a `no` or `notSure` actively suppresses a comment or merely fails to promote it,
   and what the per-summary cap is and which comments survive it. All of these are constants in the
   selection code, per step 3.
2. **Are teacher comments treated differently from student ones?** Storage cannot currently tell
   them apart — `isAiComment` separates the AI from everyone else and stops there. `commentUid`
   names the person but not their role, and nothing on the summary record says which is which, so
   treating teachers differently means either a roster lookup at read time or recording the role on
   the entry at rating time. Neither exists today: "no difference" is the cheap answer and
   "teachers weighted higher" is a real piece of work.
3. **Does a document qualify on peer ratings alone?** Today a document needs someone to rate
   *Ada's* comment before its human comments can travel anywhere. In a small cohort that means two
   separate rating events landing on the same document, which is a high bar — plausibly high enough
   that the feature ships and never fires. The scarcity of data argues for switching to
   `numAgreements > 0` rather than against it.
4. **Should a study be able to turn this off?** This feature does nothing for the first weeks of a
   cohort and then starts doing something once ratings accumulate, so the character of the AI's
   feedback changes partway through a class's use. For a research app that is a confound. The
   research team should decide whether it runs everywhere or sits behind a per-unit or config
   switch that a study opts into.
5. **What does "better" look like?** Somebody has to be willing to say which of two harness outputs
   is the better one. Without that, this ships and nobody can say whether it helped.
6. **Are `tags` sent with the comment text, or dropped?**

*Not a question, but worth doing first:* confirm once that Track C is actually writing summary
records and that ratings are landing on them. That is a check on the 2026-09-02 deploy, not a survey
of the data.

### Closed

- **Who can read the text.** Previously closed here on the grounds that student prose already goes
  to OpenAI. That answers the wrong question: the vendor was never the worry, the audience was. The
  argument that actually closes it is containment.

  The lookup filters on `context_id`, which is the class. A comment can therefore only reach a
  prompt built for another document **in the same class**. And `firestore.rules` already grants
  every member of a class read access to the comments on that class's documents:
  `hasDocumentAccess()` → `userCanAccessDocument()`, whose first clause is
  `request.auth.token.class_hash == docData.context_id`. So no comment text reaches anyone who
  could not already read it, and the realm scoping added in CLUE-645 Track C keeps it inside its
  realm as well. Teacher comments included, and deliberately so: the requester wants a teacher's
  feedback to inform everybody in the class.

  **This holds only while the lookup stays class-scoped.** The corpus will be sparse at first, and
  "relax the filters so we find more related documents" is a natural suggestion. Widening
  `context_id` reopens this question, and whoever proposes it should be sent here first.

  What containment does *not* cover is the model repeating a comment as though it were about the
  document being evaluated. That is step 4's labeling requirement, and it is an accuracy problem,
  not a permissions one.

- **Summary drift: send every qualifying comment, regardless of when the summary was last
  written.** *(Decided 2026-09-04.)*

  The problem. A summary record holds the AI's description of a document, the time that description
  was written (`analyzedAt`), and the ratings people have made on that document's comments. When the
  document is analyzed again the description and the timestamp are overwritten and the ratings are
  left alone, so ratings made against an older description end up stored beside a newer one.

  CLUE-645 Resolved Decision 7 accepted that, because only counts reached the prompt and a count is
  blunt enough to survive the mismatch. It named this step as the point where that reasoning stops
  holding, and recorded a fix: stamp `analyzedAt` on each rating and use only the ratings that match
  the summary's current `analyzedAt` — in plain terms, only ratings made since the last analysis.

  **That fix is cheap for counts and close to fatal here**, and the reason is how often re-analysis
  actually happens. It is not only triggered when a student asks for feedback with the "ideas"
  button (`document.tsx`). The evaluation timestamp is also written when the student leaves the
  document or disconnects — an `onDisconnect` handler plus the cleanup call in
  `use-document-sync-to-firebase.ts`. So a document is re-analyzed roughly every time somebody
  finishes working on it. Under the recorded fix a peer comment would stay eligible only until the
  next time anyone opened and closed that document, which is close to never.

  So: no rule. This is a new and experimental feature and the first job is to get it working. A
  comment such as "you should explain who this is for" is useful to the AI whether or not the
  document has been edited since; its value does not depend on matching the summary text stored
  beside it. Once there is a history worth analyzing, this can be reassessed.

  **Not sending the rating time with the comment, for now.** The half-step of labeling each comment
  with a timestamp was considered and deferred, for four reasons. A bare timestamp means nothing to
  the model without the summary's own time to compare it against, and comparing dates is not
  something gpt-4o-mini does reliably. We do not know what we would want it to do differently, so
  the instruction would be vague and its effect unpredictable. It gives the model a date it may
  repeat back to a student who has no idea what it refers to. And what is stored is the *rating*
  time, not the comment's creation time — the comment's `createdAt` is never copied onto the
  agreement entry — so it is a proxy, and a repaired entry (see Smaller things) carries the repair
  time instead. If this is revisited, the better form is not a raw timestamp but a short phrase
  computed in our own code, added only to comments that predate the current summary, so the
  comparison is done reliably and stated plainly. Step 2 carries `updatedAt` through to the builder
  so that stays a small change, and the harness can run it both ways cheaply, since the fixtures are
  synthetic either way.

- **Resolved Decision 6 was confirmed with the requester** in late August 2026: all comment
  ratings are to matter, AI- and human-authored alike. Decision 6 in the design doc now records
  this. What remains open is only the how — the selection and weighting questions above.

- **What the ratings mean.** They are judgments about comments, and that is the point: they identify
  which human comments are worth passing on.

- **Whether `numAgreements` is reliable enough to filter on.** It is optional on the `Summary` type,
  and the pipeline's update path does not write it — but every record the Track C pipeline *creates*
  carries it, so the only records missing it predate Track C. Production holds one of those; it also
  lacks `root`/`space` and sits at an id the pipeline never revisits, so it is already invisible to
  the realm-scoped lookup. A footnote, not a constraint.

## Smaller things to keep in view

- **Ratings made before a document is analyzed mostly repair themselves.** A rating only lands if
  the document already has a summary, and for peer comments that is not guaranteed — a student can
  comment on a document the pipeline never touched, and those ratings are logged and dropped. But
  `onCommentRated` rebuilds a comment's entries from its whole live ratings map, not from the event
  that woke it, so once the document has a summary, one later click on that same comment restores
  every earlier rater's entry along with the new one. A rating is lost for good only if nobody ever
  touches that comment's ratings again. One caveat: a restored entry carries the repairing event's
  timestamp, not the original rating's, so `updatedAt` is not a reliable history if selection ever
  uses recency.
- **Stored comment text can go stale.** `content` is captured at rating time. A comment edited
  afterwards leaves the entry holding the older wording — and leaves two raters of the same comment
  holding different wordings, which is one reason step 2 has to group by `commentId` rather than by
  text.
- **Retention.** Peer comment text is already stored indefinitely with no deletion path, as part of
  the retention question CLUE-645 deferred. Sending it somewhere new is a fair moment to revisit it.
- **Index before code.** Any new index must be deployed and built before the code that queries it;
  the wrong order fails quietly. Procedure in `CLUE-645-ratings-to-summaries-implementation.md`
  under "Deploying Track C"; the general rule is in `functions-v2/README.md`.
