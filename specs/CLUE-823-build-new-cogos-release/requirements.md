# Land the ForeverLearning (Ada) integration package in CLUE

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-823
**Repo**: https://github.com/concord-consortium/collaborative-learning
**Status**: **In Development**

## Overview

ForeverLearning (FL) delivered a ready-made CLUE change for the Ada chat tutor: each FL message carries the student's current task and the Dataflow tools available to them, requests survive failures and can be recovered, and a conversation belongs to its learner from the first message. This story validates that package against master, lands it with the fixes it needs, and deploys it.

## Project Owner Overview

Ada answers better when it knows which task the student is looking at and which Dataflow blocks and devices the unit offers, and today CLUE sends neither. The package adds both, makes a failed or interrupted reply recoverable instead of leaving the conversation stuck, and closes a gap where another learner could claim a conversation before its owner's first message. FL's side is already live in production, so the remaining work is Concord's: review, merge, a coordinated release of the browser app, Firestore rules and Functions, and a short hosted acceptance pass.

The package is sound and its tests pass on master, so the plan is to apply it largely as written. A handful of things in it should not merge as-is (listed under "Not merged as delivered"), and the release has to be coordinated because the new browser app and the new rules each break the other's older counterpart in specific ways.

## Background

The story attaches `CONCORD_PRODUCTION_HANDOFF_2026-11-21.zip` (a fresh download of the attachment is byte-identical to the copy validated here, which was extracted outside the repo and treated as untrusted; no package script was run). Its parts:

| Package file | What it is |
|---|---|
| `CONCORD_INTEGRATION_GUIDE.pdf` (.md, .docx) | Implementer guide: what the change adds, settings, checks, deploy order, hosted acceptance |
| `CONCORD_INTEGRATION_WITH_OWNERSHIP.patch` | The complete change: 45 files, about 2,480 lines added and 230 removed |
| `OWNERSHIP_ONLY.patch` | A review aid for the security part; not to be applied after the complete patch |
| `TEST_PATHS.json`, `QUALIFICATION.json` | The test lists and FL's recorded results |
| `clue_context_packet_v2_capabilities_v1.schema.json`, `conformance-fixtures/` | Packet schema and one captured SSE response, for the opt-in conformance tests |
| `PROPOSED_PR_DESCRIPTION.md` | A drafted PR description with a deploy timing recommendation |
| `ADA_TESTER_GUIDE.*`, `ADA_LATEST_CHANGES.pdf`, `CLUE_UPGRADE_REPORT.*` | Tester and stakeholder material; not repo content |

The patch was cut against an older master (the CLUE-760 merge). Master has moved on by about 60 commits, but none of them touch the patched files in a conflicting way.

### Validation against master

All of this was run in a throwaway worktree of master with the patch applied, Node 22, and the repo's own lockfiles:

| Check | Result |
|---|---|
| `git apply --check` on master | Clean |
| Browser/shared jest (the 31 files in `TEST_PATHS.json`, with the package's schema and capture fixtures) | 325 passed, matching the package |
| functions-v2 jest (the 9 backend/rules files, under `firebase emulators:exec`) | 156 passed, matching the package |
| `firebase-test` rules suite (`npm run test:exec`) | 509 passed, 2 skipped, matching the package |
| `tsc --noEmit` (root and functions-v2) | Clean |
| eslint, including `.eslintrc.build.js`, on the changed files | 0 errors, 13 `max-len` warnings |

Mutation checks confirm the package's tests guard what they claim: removing or weakening each of the owner check on lock, the owner check before dispatch, the owner prefix on first lock, the owner prefix in the rules, the activity-context rule, the reservation delete, the `Idempotency-Key` header, the recovery-id staleness check, the client's send fence, the teacher-tile filter and the legacy owner match each turns at least one test red (by assertion, not by compile error). The patch files' SHA-256 values match `PACKAGE_MANIFEST.json`.

A throwaway rules test (run against both master's rules and the package's) established the cross-version behavior the deploy plan rests on:

- **New browser app against master's rules: chat is unusable.** The new client first reads its owner-bound parent doc, which master's rules deny while the doc is missing. The transport treats that as fatal, so the tutor shows an error for new and existing conversations alike. The new client's first message with `activityContext` is also denied by master's field whitelist.
- **Released browser app against the new rules: existing conversations keep working, new ones cannot start.** The released client creates first messages under the old (unowned) conversation id, which the new rules deny.

### What the change does (as verified in the code)

- **Current task.** `buildActivityContext` (`src/components/chat-tutor/activity-context.ts`) reads the selected problem section (the Problems tab's `currentDocumentGroupId`, falling back to the first section as `ProblemTabContent` does), walks its text tiles in display order, skips teacher-only tiles (`tile.display`), resolves highlight chips to their words, and sends `{task_prompt, source: {system, lesson_id, unit, section}}`. It is read at send time, so switching task without editing the workspace still changes the next message.
- **Available tools.** `buildCapabilityContext` (`capability-context.ts`) reports whether the toolbar has Dataflow, the full node palette (`NodeTypes`, which the Dataflow toolbar shows unfiltered), the Demo output options, and the resolved `servoInputMode` and live output types, using the same resolver (`resolveAllowedOutputTypes`) as the Dataflow tile.
- **Per-tile output settings.** The Dataflow tile projection (`shared/fl-packet/dataflow-tile.ts`) now carries a tile's saved `outputConfig`.
- **Durable delivery.** Before calling FL, the drain reserves the exact request body in a new top-level, client-inaccessible collection `chatTutorPendingRequests/{sha256(messagePath)}`, sends it with an `Idempotency-Key` equal to the request id, and on success deletes the reservation in the same batch that writes the reply, session state and cursor.
- **Recovery.** A failure is recorded on the parent as `delivery: {id, messageId, state, code}` plus a `delivery-<messageId>` notice in the transcript. The browser disables the composer and offers one action per state (retry, check for reply, continue, start a new conversation, or none for "needs support"), written as an immutable `kind: "recovery"` message the trigger consumes once.
- **Ownership.** New conversation ids are `owner:<uid length>:<uid>_<URI-encoded class>_<old id>`. Rules forbid all client parent writes and let a learner check a missing parent only under their own owner prefix; message writes must match the parent's uid, class and problem. The drain refuses to lock or dispatch for a mismatched owner. An existing conversation under the old id is reused only when its uid, class and problem all match.
- **Unchanged.** The OpenAI provider gets the ownership checks but no reservation, context fields or recovery UI. The FL connection settings in `functions-v2/.env.collaborative-learning-ec215` and `.env.collaborative-learning-staging` already hold the values the guide lists (`FL_BASE_URL`, `FL_SOLUTION_ID=concordclue`); only the existing `FL_CONCORDCLUE_API_KEY` secret is used.

## Requirements

### Behavior the merged change must have

- **R1, task context.** Every FL user message carries `activityContext` with the selected section's student-visible text, and `source` when the problem belongs to the loaded unit with a valid `<inv>.<prob>` ordinal. It is omitted (never carried over from an earlier message) when the section has no readable text or exceeds the limits (8,000 characters of task text, 12,288 bytes in all).
- **R2, tool context.** Every FL user message carries `capabilityContext` (`clue.capability_context.v1`) built from the app config, omitted when the config is unavailable. List lengths, name lengths and the 4,096-byte cap are validated in the browser, the rules (shape and list lengths) and the backend.
- **R3, packet.** The backend maps both to `activity_context` and `capability_context` in `clue.context_packet.v2`, keeps them when the workspace is omitted for size, and refuses dispatch if the packet still exceeds `kMaxPacketBytes`. A Dataflow tile's valid saved `outputConfig` is projected.
- **R4, durable delivery.** An FL request is reserved before dispatch, retried only with the reserved body and identity, and its reservation deleted atomically with the accepted reply. Clients can neither read nor write `chatTutorPendingRequests`.
- **R5, recovery.** Each delivery state offers exactly the action in `shared/chat-delivery.ts`; a failure before anything reached FL is retryable (fix 9); keyboard focus stays in the composer while a delivery is pending or unresolved, including after a recovery click (fix 10); a failed conversation lookup on open is retried by the next send or recovery (fix 12); a recovery control never reaches the model; a stale or duplicate control is consumed without effect; the composer cannot send while a delivery outcome is unresolved; delivery notices are attributed as notices, not as Ada, in the transcript and its copied text.
- **R6, ownership.** Under `authed/`, a conversation's owner is fixed by the server from the first message's authenticated uid. No client can create or alter a parent, write into another learner's conversation, or start a conversation under an id outside its own owner prefix. Existing conversations stay reachable for their owner, history and session intact, as long as the owner, class and problem all match: a student whose class changed starts a new conversation. The demo, qa and dev roots stay test modes without per-user isolation, as on master.
- **R7, OpenAI path.** OpenAI conversations behave as before apart from R6.
- **R7a, logging.** A delivery failure after a send in this session still logs `AI_CHAT_UNAVAILABLE`, at most once per sent message however many retries fail, with the delivery state and code in the event context. A `closed` delivery is not a failure and does not log. Recovery clicks do not count as sends, and `AI_CHAT_TIMEOUT` is also logged at most once per sent message, so both events stay rates over `AI_CHAT_MESSAGE_SENT`.

### What landing it must include

- **R8, the patch.** The package's code and tests land, with the fixes under "Fixes the package needs".
- **R9, CI coverage.** The new rules tests in `functions-v2/test/` run whenever `firestore.rules` changes, not only when functions-v2 or shared changes.
- **R10, PR description.** The production browser build (`npm run build`, with the repo's standard 4 GB heap) passes on the PR head. The description carries a Deploy timing callout the `Deploy Timing` check accepts, with the timing Doug chooses for functions, rules and indexes, and its validation numbers re-measured on the PR head.
- **R11, deployment.** Indexes, rules, Functions and the browser release follow the order in "Deployment" below, followed by the hosted acceptance pass in the guide.

### Fixes the package needs

1. **Deploy timing callout.** The proposed heading `**Deploy timing — recommendation for the deployment owner to confirm**` does not match the checker's `^>\s*\*\*Deploy timing\*\*\s*$` (`scripts/lib/deploy-timing.ts`), so the check would fail. Use the `docs/deploy.md` format.
2. **CI trigger.** Add `firestore.rules` to the `paths` of `.github/workflows/functions-v2.yml` (R9).
3. **`docs/fl-integration.md`.** Rewrite as a contract reference: drop the base commit hash, the "local cumulative reference" framing, "Item 4" and other delivery-process language, the "now fail" narrative, the `CLUE_RULES_TEST_PROJECT_ID` instructions (the harness is not merged), and the deploy-timing paragraph (that belongs in the PR). Add a short support section with the manual procedure for clearing a `blocked` delivery. Rename the `demo-clue-item3` test project to a descriptive id.
4. **Comment audit.** Remove comments that narrate the change rather than the code ("Old rules could admit mixed first messages", "First conversations require the updated client"). Update comments the change makes stale: the chatTutor rules header (it says "the create rules pin" the uid, true only of messages now that parent create is `false`), the `onReadError` comment in `firestore-transport.ts` (it calls permission-denied the expected case before the parent exists, but an owner may now read their missing owner-bound parent), and the `kOwnerFields` comment in `drain.ts` once the list moves to `shared/`, and the three comments that still say clients write only `user` messages (the trigger's self-trigger guard, the rules block header, the `FirestoreTransport` class comment). The `conversationDocId` paragraph in `docs/unit-summary-consumers.md` gains one sentence on the owner-bound wrapper.
5. **Self-comparisons.** `sameChatOwner(parent, parent)` and `sameChatOwner(ownerFields, ownerFields)` in `drain.ts` are used to mean "has all three owner fields"; replace with a named helper in `shared/chat-ownership.ts`.
6. **Unavailability logging.** `use-chat.ts` logs `AI_CHAT_UNAVAILABLE` only when `status === "error" && !delivery`, and every FL failure now carries a `delivery`, so FL failures stop producing the event the tutor's usage reporting counts (R7a).
7. **Lint and formatting.** Clear the 13 `max-len` warnings, the hard-to-read layout of the recovery button in `chat.tsx` (its `</button>` sat far right of the line it closes), and the extra space before `data.problemPath` in `firestore.rules`.
8. **Schema check for the new fields.** `schema-conformance.test.ts` validates only packets without `activity_context` or `capability_context`, though the package's schema defines both (a tile's `content` is open in that schema, so the projected tile `outputConfig` has no schema to check against). Add an opt-in case that builds a packet with both and validates it, so running the suite against FL's schema covers the new contract. That needs FL's capabilities schema (`clue_context_packet_v2_capabilities_v1.schema.json`); an older v2 schema rejects `capability_context`, so the test header and the doc name it.
9. **Failures before dispatch are retryable.** A non-`FlDeliveryError` failure with no reservation is recorded as `retryable` with code `FL_NOT_DISPATCHED` instead of `blocked`, and `prepareRecovery` accepts a retry for that code without a reservation; the drain then rebuilds and reserves the request as usual. Failures `reserve()` itself raises as `blocked` (changed source, oversized snapshot) stay blocked.
10. **Keep focus in the composer while fenced.** While a `delivery` is set, the message input is `readOnly` with `aria-disabled="true"` instead of `disabled`, so a focused input keeps focus; Send stays disabled and `onSubmit` returns early, so the fence still holds in the UI as well as in the transport. A recovery button moves focus to the input when clicked, since the button itself is disabled and then unmounted under the focus.
11. **Large workspaces fit the reservation.** The reservation leaves out `parentUpdate.flContent`; the provider sets `flContent` after dispatch from a fresh `readDocument`, and "continue" sets it from the source message's `rightContent`. A saved request is then the request twice (a packet of at most 24,576 bytes plus the prompt), far under the 980,000-byte limit, and workspaces up to the browser's 900,000-byte attach limit are answered as on master.
12. **A failed lookup on open is retried.** A rejected conversation lookup is not cached, and a later send or recovery that resolves it attaches the listeners the failed open never attached, so a network blip when the drawer opens does not leave Ada unusable until it is reopened.

### Not merged as delivered

- `OWNERSHIP_ONLY.patch`, the tester guides, the upgrade report and `QUALIFICATION.json`: review aids and stakeholder material, not repo content.
- The `CLUE_RULES_TEST_PROJECT_ID` override in `firebase-test/src/setup-rules-tests.ts`: a harness for FL's local emulator setup; CI and the repo's documented workflow do not need it.
- `PROPOSED_PR_DESCRIPTION.md` verbatim: its callout fails the check (fix 1) and its numbers must be re-measured (R10).

### Deployment

- **Indexes**: the new `fieldOverrides` entry exempts `chatTutorPendingRequests.snapshotJson` from indexing. Nothing writes that collection until the new Functions run.
- **Rules**: the new browser app cannot work against master's rules, and the released app cannot start new conversations against the new rules (both verified above).
- **Functions**: the new Functions refuse to lock a first message under an unowned id, so a released client's new conversation would wait for a reply that never comes; existing conversations are unaffected. Old Functions with the new client still answer, but without context fields, reservations or recovery.
- **Settings**: no change, including the existing `FL_CATALOG_COMMIT` and `FL_PROTECTION_*` values, which the guide says to preserve; `FL_BASE_URL` and `FL_SOLUTION_ID` must not change while failed reservations exist, because a reservation whose saved endpoint or solution differs from the current config is refused.
- **Acceptance**: the hosted acceptance table in the guide, run on staging with real portal launches (two learner accounts for the ownership row), recording the build and the request and session ids of any failure. The "Show me" row needs a unit with `chatTutorHighlights` enabled. Two rows cannot be run as written from a browser: replaying an accepted request needs a direct API call with the server-side key, and a confirmed FL failure (`CLUE_TURN_FAILED`) can only be produced by FL. `chat-fl-durability-emulator.test.ts` covers CLUE's side of both against a loopback endpoint; FL's side of replay (one reply, original generation kept) is FL's, and its upgrade report records it verified in production. The recovery row's failure states have no practical staging trigger (forcing one would break chat for every staging user), so they rest on the emulator suite as well; staging covers the rest. Staging talks to FL's staging API, so the pass runs on staging before the production release, and a short production check (rows 1, 3 and 5) follows it.
- **In-flight work**: no reservations exist before the new Functions run, so the guide's "reconcile pending requests" step is empty for this first release; deploy the Functions when no turn is generating, since a turn the old code is mid-way through would be sent again by the new code under a fresh reservation and an `Idempotency-Key` the first send never carried, so FL could answer it twice.
- **Rollback**: there is no clean rollback to master. Master's rules reopen the ownership gap, master's Functions ignore reservations and recovery controls, and master's client computes the old conversation id, so every conversation started under an owner-bound id would vanish from its student's view. As the guide says, a rollback deploys a browser, rules and Functions combination that still enforces ownership and handles recovery (in practice, a fix forward on this change), after pausing sends and resolving outstanding reservations, preserving accepted replies, expense records and the private reservations themselves, and then repeats the hosted acceptance pass. Never revert the rules alone.

## Technical Notes

- New files: `shared/chat-delivery.ts`, `shared/chat-ownership.ts`, `shared/fl-packet/activity-context.ts`, `shared/fl-packet/capability-context.ts`, `functions-v2/src/chat/delivery-recovery.ts`, `fl-delivery-error.ts`, `turn-persistence.ts`, `src/components/chat-tutor/activity-context.ts`, `capability-context.ts`, `docs/fl-integration.md`, plus tests.
- Changed: `firestore.rules`, `firestore.indexes.json`, `functions-v2/src/chat-tutor.ts`, `chat/drain.ts`, `fl-client.ts`, `fl-provider.ts`, `provider.ts`, `routing-provider.ts`, `shared/fl-packet/packet.ts`, `sse.ts`, `dataflow-tile.ts`, and the chat-tutor `chat-sidebar.tsx`, `chat.tsx`, `chat.scss`, `firestore-transport.ts`, `transport.ts`, `turn-from-doc.ts`, `use-chat.ts`.
- `schema-conformance.test.ts` and `captures.test.ts` are opt-in (`FL_SCHEMA_DIR`, `FL_CAPTURE_DIR`) and skip in CI by design; the schemas are FL's and are not vendored. They pass against the package's fixtures.
- The rules tests the package adds live in `functions-v2/test/` (using `@firebase/rules-unit-testing` v4, which functions-v2 already depends on), not in `firebase-test/` (v1 API). CI's functions-v2 job runs them under `emulators:exec`.
- The package's functions-v2 rules tests import `firebase/firestore`, which functions-v2 gets only as a peer dependency of `@firebase/rules-unit-testing`, not a declared one. It installs today; declaring it would be a lockfile change and is left out.
- The log context's `conversationId` is always the owner-bound id, even when the transport has reused a conversation under its old id. The old id is the suffix after `owner:<n>:<uid>_<class>_`, so a log row can still be traced to its Firestore doc.
- `chatTutorPendingRequests` is one top-level collection for every root, so demo and qa failures leave records beside production ones; `clean-firebase-roots` does not reach it.
- Pending reservations hold the full request (prompt, context packet) and the raw workspace JSON (`flContent`) until the turn succeeds or is continued. The tutor transcripts themselves are already outside the deletion scripts in the separate `student-data-deletion` repo, which have no `chatTutor` handling.

## Out of Scope

- Any change to FL's API, response format or teaching behavior.
- Whole-tile and wire "Show me" highlights (the guide says they produce no controls; the upgrade report lists whole-tile highlighting as a follow-up).
- Migrating or rewriting existing conversations; they are reused in place.
- Interrupting a running request from the recovery UI.
- Logging recovery clicks as their own events.
- Deleting a student's `chatTutor` and `chatTutorPendingRequests` data on request (a follow-up story).

## Open Questions

### RESOLVED: Judgment call: apply the package largely as written, or rework it?
**Options considered**:
- A) Apply the patch, then fix the specific problems found
- B) Rework the design (for example, keep ownership but drop durable delivery) to fit 3 points

**Decision**: A. The patch applies cleanly, every test suite it claims passes on master, and the problems found are presentation, CI wiring and hygiene rather than design faults. Reworking it would cost more than the story and discard FL's tested contract.

### RESOLVED: Judgment call: where should the new rules tests run?
**Options considered**:
- A) Leave them in `functions-v2/test/` and add `firestore.rules` to that workflow's paths
- B) Port them to `firebase-test/` on its older `rules-unit-testing` v1 API

**Decision**: A. One line in the workflow gives the coverage R9 asks for; a port is a rewrite of three files for no behavioral gain.

### RESOLVED: Judgment call: do the FL connection settings need changing?
**Options considered**:
- A) Set them as the guide's table says
- B) Leave them, since the committed `.env` files already hold those values

**Decision**: B. Both project `.env` files already set `FL_BASE_URL` and `FL_SOLUTION_ID=concordclue`, and the key is the existing secret.

### RESOLVED: What deploy timing should functions, rules and indexes carry?
**Context**: The new client is broken under master's rules; the released client cannot start new conversations under the new rules or the new Functions; old Functions with the new client answer but without the new features; nothing writes the indexed collection until the new Functions run.
**Options considered**:
- A) indexes **before**, rules **with**, functions **with**
- B) indexes **before**, rules **with**, functions **after**

**Decision**: A (Doug took the recommendation). Callout reasons:
- **indexes: before**: the field override only exempts `chatTutorPendingRequests.snapshotJson` from indexing, and nothing writes that collection until the new Functions run.
- **rules: with**: the new client cannot read its missing owner-bound conversation or write the new context and recovery fields under the current rules, and the released client cannot start a new conversation under the new ones; existing conversations keep working, and reloading moves an open tab onto the new client.
- **functions: with**: the new Functions refuse a first message under an unowned id, so the released client cannot start a new conversation against them, but the new rules already deny that write, so deploying them with the rules and client adds no new breakage; deploying them later would leave the new client without task context and recovery for that time.

### RESOLVED: Does the retention of failed reservations need its own story?
**Context**: A failed FL turn keeps its full request and the student's raw workspace in `chatTutorPendingRequests` until a recovery resolves it, with no expiry. The transcripts already sit outside the deletion tooling, so this adds a second copy rather than a new kind of exposure.
**Options considered**:
- A) Record a follow-up story covering deletion of `chatTutor` and `chatTutorPendingRequests` data
- B) Treat it as covered by the tutor spike's existing "delete the collection wholesale" plan
- C) Add an expiry to this story

**Decision**: A (Doug agreed). An expiry would delete a reserved request before its outcome is known, which the package deliberately prevents, and the spike-end plan does not cover a deletion request for one student before then. The follow-up story is created when the PR goes up; it is out of scope here.

### RESOLVED: How does support clear a delivery in the "needs support" state?
**Context**: A `blocked` delivery (a conflicting request identity or a damaged reservation) offers the student no action, and nothing in the package says how support clears it. From the code, clearing it by hand means doing what "continue" does: delete the parent's `delivery`, delete the `chatTutorPendingRequests` record, mark the notice resolved and advance the cursor past the message, after checking with FL by request id whether the turn was answered.
**Options considered**:
- A) Document that manual procedure in the `docs/fl-integration.md` rewrite
- B) A follow-up story for a support tool, with the manual procedure documented meanwhile
- C) Leave it out; the state should not occur in practice

**Decision**: A (Doug). A documented procedure is enough for now: with fix 9, the state covers only identity conflicts, damaged reservations and requests `reserve()` refuses (changed source, oversized snapshot).

### RESOLVED: Should a failure before anything reached FL be retryable?
**Context**: `recordDeliveryFailure` records any error that is not an `FlDeliveryError` and has no reservation as `blocked` ("needs support"), and `prepareRecovery` refuses both retry and continue without a reservation. Such errors happen before dispatch, so nothing reached FL: a transient Firestore transaction error while reserving, a missing tutor user id, or a packet over the limit even after the workspace is dropped. As delivered, each of these leaves the student with no action and needs the manual support procedure.
**Options considered**:
- A) In this story: record a failure with no reservation as `retryable` with code `FL_NOT_DISPATCHED`, and let `prepareRecovery` accept a retry for that code without a reservation (the drain rebuilds the request from the message). About 15 lines and one emulator test. A deterministic cause fails again on each retry, which is visible and harmless.
- B) Keep the package's behavior; support clears these by hand.
- C) A follow-up story.

**Decision**: A (Doug took the recommendation). Fix 9. Prototyped on the patched tree: the change and its emulator test pass with the other 156 functions-v2 chat tests, and reverting the recovery half turns the new test red.

### RESOLVED: Low confidence: a "Check for reply" click while the original request is still running does nothing
**Context**: The control's trigger cannot take the conversation lock until the running request ends or the lock goes stale (five minutes), and the control is left unprocessed; the button simply re-enables.
**Decision**: Accept as a documented limitation. The original request still records its outcome, which updates the UI, and a later click after the lock goes stale is processed. Interrupting a running request is out of scope.

## Self-Review

Roles: Security Engineer, QA Engineer, DevOps Engineer, Education Researcher, Student, WCAG Accessibility Expert. Each finding below was checked against the patched code before it was recorded.

### Education Researcher

#### RESOLVED: FL failures no longer log `AI_CHAT_UNAVAILABLE`
`use-chat.ts` gates the event on `!delivery`, and the patch adds no other logging. Fixed in place as R7a and fix 6.

### DevOps Engineer

#### RESOLVED: No rollback requirement
The guide warns that reverting rules alone reopens the ownership gap and that old Functions cannot honor reservations. Added the Rollback bullet under Deployment.

#### RESOLVED: Pending records from demo and qa roots share the top-level collection
Recorded under Technical Notes; no change needed for this story.

### QA Engineer

#### RESOLVED: Two hosted acceptance rows cannot be run from a browser
Replay and confirmed-failure need FL-side or keyed access. The Acceptance bullet now says which rows are covered by the emulator suite.

### Review round 1 (independent reviewer, package against specs)

A fresh reviewer given only the package and the specs confirmed the commit sequence reproduces the complete patch minus the harness, and every file hash matches the manifests. Its findings, each checked against the code before changing the specs:

#### RESOLVED: Rollback contradicted the guide
Rolling back to master loses ownership and recovery and hides owner-bound conversations. Rewritten to the guide's "compatible combination" rule.

#### RESOLVED: Stale prose the change invalidates
The doc's `CLUE_RULES_TEST_PROJECT_ID` paragraph, the `onReadError` comment in `firestore-transport.ts`, the `kOwnerFields` comment and the `conversationDocId` paragraph in `docs/unit-summary-consumers.md` added to fixes 3 and 4.

#### RESOLVED: Acceptance and deployment gaps
Added the `chatTutorHighlights` precondition, the staging-first order (staging talks to FL's staging API), a production check, the in-flight step, the protection and catalog settings, and the browser build. Corrected what the emulator test proves about replay and which document lists highlights as a follow-up.

#### RESOLVED: New context fields never checked against FL's schema
Added fix 8.

### Review round 2 (independent reviewer, package against specs)

A second fresh reviewer reproduced the commit sequence and the manifests again. Its findings, each checked against the code:

#### RESOLVED: Fix 8 overstated the schema
The schema defines `activity_context` and `capability_context` only; a tile's `content` is open. Fix 8 corrected.

#### RESOLVED: The support procedure did not fit pre-reservation failures
Rewritten for both cases (reservation present or absent), with the `flContent` copy "continue" makes. Whether those failures should reach support at all is the new open question above.

#### RESOLVED: Smaller errors
The id format, the in-flight wording, the rollback's preservation list, the uncertain-request acceptance half, the quoted rules comment, the commit count, the local deploy-timing command, the follow-up story step, stale "self-heals" comments, a firebase-test case left true by construction, a logging gap after a recovery click, a `shared/` test that would have imported browser code, and the harness paragraph lingering in the doc between commits.

### Review round 3 (independent reviewer, package against specs)

A third fresh reviewer reproduced the commit sequence, hashes and diff sizes again. Its findings, each checked against the code:

#### RESOLVED: The logging fix would have skewed the event rates
Having `recover` mark the session as sent also turned on timeout and unavailable logging for recovery clicks, which log no send. Dropped; R7a states the rate basis.

#### RESOLVED: The support procedure and state table did not cover fix 9
A not-dispatched failure that fails the same way on every retry now falls under the support procedure, the doc's state table gains `FL_NOT_DISPATCHED`, and the reserved ownership mismatch is named as an engineering case.

#### RESOLVED: R6 claimed more than the rules enforce
Scoped to `authed/`, with the class-change consequence stated.

#### RESOLVED: Smaller items
The self-contradicting `onReadError` rewrite, two more stale comments, the firebase-test case's remaining by-construction assertion, the costly wrong-key staging exercise (dropped), the log `conversationId` for reused conversations (noted), and wording in the tidy, support and PR steps.

### Review round 4 (multi-role)

Roles: Senior Engineer, QA Engineer, Education Researcher, Security Engineer, DevOps Engineer, WCAG Accessibility Expert. Each finding was confirmed on master plus the complete patch; implementation findings are in implementation.md.

#### RESOLVED: Every FL turn pushes keyboard focus out of the tutor drawer
**Context**: Every FL turn records a pending delivery (`recordPendingDelivery`, `state: "unknown"`, `FL_REQUEST_PENDING`) once its request is reserved, and `chat.tsx` disables the composer input whenever `delivery` is set (`disabled={sending || !!delivery}`). The send itself already refocuses the input when `sending` clears; the pending delivery lands later and disables it again. Chrome moves focus from a disabled element to `body` and does not restore it on re-enable (checked in headless Chrome 152: focus input, disable, re-enable, `activeElement` is `body` both times), and nothing in `chat.tsx` refocuses when the fence lifts. With focus on `body`, Tab leaves the drawer's focus trap. A throwaway jsdom test confirmed the input is disabled during an ordinary FL request and re-enabled after the reply. The OpenAI path writes no delivery and is unaffected. R5 asks for the fence, so the question is how to keep focus, not whether to fence.
**Options considered**:
- A) Keep the input focusable while fenced: `readOnly` plus `aria-disabled` on the input, `disabled` only on Send (the same headless check keeps focus on a `readOnly` input). `sendUserMessage` already refuses while a delivery exists, so nothing new reaches the backend. About 5 lines and a test that the input is read-only, not disabled, under a delivery.
- B) Refocus the input when the fence lifts, if focus fell to `body`, mirroring the refocus after a send. Leaves focus lost for as long as a failure is unresolved.
- C) Merge as delivered and record a follow-up story.

**Decision**: A (Doug took the recommendation). Fix 10. It is the only option that keeps a keyboard or screen reader user inside the drawer during both the pending request and an unresolved failure.

### Review round 5 (multi-role)

Roles: Senior Engineer, Security Engineer, QA Engineer, Education Researcher, Student, WCAG Accessibility Expert. Each finding was confirmed on master plus the complete patch with fixes 6, 8, 9 and 10 and the owner helper refactor applied together, using throwaway tests kept out of the spec branch; implementation findings are in implementation.md.

#### RESOLVED: Every recovery click drops keyboard focus to `body`
The recovery button is disabled on click and then unmounted (the panel hides while the retry is pending, and the delivery clears on success). A throwaway jsdom test with the button focused showed `document.activeElement` as `body` after the retry was accepted and after the reply; focusing the input first keeps it on the input both times. Added to fix 10 and R5.

#### RESOLVED: Large workspaces block every FL turn
**Context**: `reserve()` refuses a snapshot over 980,000 bytes (`turn-persistence.ts`) as `blocked`, and the snapshot holds the request, `serializedBody` (the same request again, JSON-escaped) and `parentUpdate.flContent` (the raw workspace, JSON-escaped). The browser attaches a workspace up to 900,000 bytes (`kMaxAttachedWorkspace`), and master answers those. A throwaway emulator test with an MST-like workspace (escaping adds 24%) dispatched at 787,819 bytes and blocked at 817,819 bytes with no FL call ("Tutor pending request exceeds the durable snapshot limit"), so every message from such a document needs the support procedure.
**Options considered**:
- A) Keep the raw workspace out of `snapshotJson`: store it as its own field on the reservation with its own hash, and have "continue" and the drain read it from there. About 20 lines and an emulator case at 890,000 bytes.
- B) Lower the browser's attach budget, measured on the escaped size, so every attached workspace fits.
- C) Accept it as a limitation and name it in the doc's support section.

**Recommendation**: A. It removes the blocked state rather than documenting it, and keeps the 900,000-byte budget master already serves.

**Decision**: A (Doug took the recommendation), in a simpler form found while prototyping it: the raw workspace is not reserved at all. It is always either the source message's immutable `rightContent` or the parent's own copy, so the provider reads it again after dispatch and "continue" takes it from the source message. Fix 11.

#### RESOLVED: `AI_CHAT_UNAVAILABLE` can outnumber the sends it is a rate over
**Context**: Fix 6 logs once per failure id, and every outcome gets a new id, so a send whose retries keep failing logs once per retry. A throwaway `use-chat` test (one send, then failures `f1`, `f2`, `f3` across two retries) logged `AI_CHAT_MESSAGE_SENT` once and `AI_CHAT_UNAVAILABLE` three times. The package's timeout also re-arms on each recovery (`recoveryAttempt`), so `AI_CHAT_TIMEOUT` behaves the same way. This contradicts R7a's "the event stays a rate over `AI_CHAT_MESSAGE_SENT`", which round 3 settled.
**Options considered**:
- A) Key the logged-failure ref on `delivery.messageId` instead of `delivery.id`, so a sent message logs at most one unavailable event however many retries fail.
- B) Keep one event per failure and reword R7a: the event counts failed attempts, which can exceed sends.

**Recommendation**: A. It keeps the existing report's rate meaningful; the timeout re-arm can be keyed the same way or left as the package has it.

**Decision**: A (Doug took the recommendation), with the timeout log keyed the same way. Prototyped: one send with three failing retries logs one send, one unavailable event and one timeout.
