# Land the ForeverLearning (Ada) integration package in CLUE

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-823

**Status**: **Closed**

## Overview

ForeverLearning (FL) delivered a ready-made CLUE change for the Ada chat tutor (`CONCORD_PRODUCTION_HANDOFF_2026-11-21.zip`): each FL message carries the student's current task and the Dataflow tools available to them, requests survive failures and can be recovered, and a conversation belongs to its learner from the first message. This story validated that package against master, landed it with the fixes it needed, and plans its coordinated release.

## Requirements

### Behavior

- **R1, task context.** Every FL user message carries `activityContext` with the selected section's student-visible text, and `source` when the problem belongs to the loaded unit with a valid `<inv>.<prob>` ordinal. It is omitted (never carried over from an earlier message) when the section has no readable text or exceeds the limits (8,000 characters of task text, 12,288 bytes in all).
- **R2, tool context.** Every FL user message carries `capabilityContext` (`clue.capability_context.v1`) built from the app config, omitted when the config is unavailable. List lengths, name lengths and the 4,096-byte cap are validated in the browser, the rules (shape and list lengths) and the backend.
- **R3, packet.** The backend maps both to `activity_context` and `capability_context` in `clue.context_packet.v2`, keeps them when the workspace is omitted for size, and refuses dispatch if the packet still exceeds `kMaxPacketBytes`. A Dataflow tile's valid saved `outputConfig` is projected.
- **R4, durable delivery.** An FL request is reserved before dispatch, retried only with the reserved body and identity, and its reservation deleted atomically with the accepted reply. Clients can neither read nor write `chatTutorPendingRequests`.
- **R5, recovery.** Each delivery state offers exactly the action in `shared/chat-delivery.ts`; a failure before anything reached FL is retryable; keyboard focus stays in the composer while a delivery is pending or unresolved, including after a recovery click; a failed conversation lookup on open is retried by the next send or recovery; a recovery control never reaches the model; a stale or duplicate control is consumed without effect; the composer cannot send while a delivery outcome is unresolved; delivery notices are attributed as notices, not as Ada, in the transcript and its copied text.
- **R6, ownership.** Under `authed/`, a conversation's owner is fixed by the server from the first message's authenticated uid. No client can create or alter a parent, write into another learner's conversation, or start a conversation under an id outside its own owner prefix. Existing conversations stay reachable for their owner, history and session intact, as long as the owner, class and problem all match: a student whose class changed starts a new conversation. The demo, qa and dev roots stay test modes without per-user isolation.
- **R7, OpenAI path.** OpenAI conversations behave as before apart from R6.
- **R7a, logging.** A delivery failure after a send in this session logs `AI_CHAT_UNAVAILABLE` at most once per sent message however many retries fail, with the delivery state and code in the event context. A `closed` delivery does not log. Recovery clicks do not count as sends, and `AI_CHAT_TIMEOUT` is also logged at most once per sent message, so both stay rates over `AI_CHAT_MESSAGE_SENT`.

### Landing

- **R8, the patch.** The package's code and tests land, with the fixes below.
- **R9, CI coverage.** The rules tests in `functions-v2/test/` run whenever `firestore.rules` changes.
- **R10, PR description.** `npm run build` passes on the PR head, and the description carries a Deploy timing callout the `Deploy Timing` check accepts (indexes before, rules with, functions with), with its numbers re-measured on the PR head. *(partial: the build passes on the branch head; the description and its check are written when the PR is opened)*
- **R11, deployment.** Indexes, rules, Functions and the browser release follow the order under "Deployment", followed by the hosted acceptance pass. *(pending: after merge)*

### Fixes made to the package

1. Deploy timing callout in the `docs/deploy.md` format (the package's heading fails the checker).
2. `firestore.rules` added to the `functions-v2.yml` paths (R9).
3. `docs/fl-integration.md` rewritten as a contract reference, with a procedure for clearing a delivery that needs support; test project renamed `demo-clue-fl-durability`.
4. Comments that narrated the change or went stale were removed or rewritten.
5. `hasChatOwner` and `kChatOwnerFields` in `shared/chat-ownership.ts` replace the drain's self-comparisons and its own field list.
6. FL delivery failures log `AI_CHAT_UNAVAILABLE` again (R7a).
7. Lint and formatting: the 13 `max-len` warnings, the recovery button's layout, a stray space in the rules.
8. An opt-in schema case validates a packet carrying both context fields against FL's capabilities schema.
9. A failure before anything reached FL is recorded as retryable (`FL_NOT_DISPATCHED`) and can be retried without a reservation.
10. While a delivery is set, the composer is `readOnly` and `aria-disabled` rather than `disabled`, so focus stays in the drawer; recovery clicks move focus to the input.
11. The raw workspace is not saved in the reservation, so workspaces up to the browser's 900,000-byte attach limit are answered.
12. A failed conversation lookup on open is not cached; the next send or recovery retries it and attaches the listeners.

### Not merged from the package

- `OWNERSHIP_ONLY.patch`, the tester guides, the upgrade report and `QUALIFICATION.json` (review and stakeholder material).
- The `CLUE_RULES_TEST_PROJECT_ID` harness in `firebase-test/src/setup-rules-tests.ts`.
- `PROPOSED_PR_DESCRIPTION.md` verbatim.

### Deployment

- **Indexes before**: the field override only exempts `chatTutorPendingRequests.snapshotJson` from indexing; nothing writes that collection until the new Functions run.
- **Rules with** the client: the new client cannot work under master's rules, and the released client cannot start new conversations under the new ones.
- **Functions with** the client: they refuse a first message under an unowned id, which the new rules already deny; deploy them when no turn is generating, since a turn old code is mid-way through would be resent under a new `Idempotency-Key`.
- **Settings**: no change. `FL_BASE_URL` and `FL_SOLUTION_ID` must not change while failed reservations exist.
- **Acceptance**: the guide's hosted pass on staging (two real learner launches, a unit with `chatTutorHighlights`), then a short production check (rows 1, 3 and 5). Replay, confirmed FL failure and the recovery states rest on the emulator suite.
- **Rollback**: never back to master and never rules alone. A rollback is a browser, rules and Functions combination that still enforces ownership and handles recovery (in practice a fix forward), after pausing sends and resolving outstanding reservations.

## Technical Notes

- The change spans new `shared/` modules (`chat-delivery.ts`, `chat-ownership.ts`, `fl-packet/activity-context.ts`, `fl-packet/capability-context.ts`), new functions-v2 modules (`chat/delivery-recovery.ts`, `fl-delivery-error.ts`, `turn-persistence.ts`), the browser's `activity-context.ts` and `capability-context.ts`, and changes to `firestore.rules`, `firestore.indexes.json`, the functions-v2 chat files and the chat-tutor components.
- `schema-conformance.test.ts` and `captures.test.ts` are opt-in (`FL_SCHEMA_DIR`, `FL_CAPTURE_DIR`) and skip in CI; the schemas are FL's and are not vendored. The context case needs FL's capabilities schema.
- The new rules tests live in `functions-v2/test/` on `@firebase/rules-unit-testing` v4; they import `firebase/firestore`, which functions-v2 gets only as a peer dependency.
- The log context's `conversationId` is always the owner-bound id, even when an old conversation is reused; the old id is its suffix.
- `chatTutorPendingRequests` is one top-level collection for every root, so demo and qa failures leave records beside production ones; `clean-firebase-roots` does not reach it.
- Pending reservations hold the full request until the turn succeeds or is continued; tutor data is outside the `student-data-deletion` scripts.
- A "Check for reply" click while the original request is still running is consumed only after the lock frees or goes stale (five minutes); the original request still records its outcome.

## Out of Scope

- Any change to FL's API, response format or teaching behavior.
- Whole-tile and wire "Show me" highlights.
- Migrating or rewriting existing conversations; they are reused in place.
- Interrupting a running request from the recovery UI.
- Logging recovery clicks as their own events.
- Deleting a student's `chatTutor` and `chatTutorPendingRequests` data on request (a follow-up story).

## Not Yet Implemented

- The PR description, its Deploy timing callout and the local `check-deploy-timing.ts` run, with every number re-measured on the PR head: written when the PR is opened.
- The follow-up story for deleting a student's `chatTutor` and `chatTutorPendingRequests` data: created when the PR goes up.
- Deployment (indexes, rules, Functions with the client release), the staging acceptance pass and the production check: after merge, following the `releasing-clue` skill.

## Decisions

### Apply the package largely as written, or rework it?
**Context**: The patch applied cleanly to master and every suite it claimed passed there; the problems found were presentation, CI wiring and hygiene.
**Options considered**:
- A) Apply the patch, then fix the specific problems found
- B) Rework the design to fit 3 points

**Decision**: A. Reworking would cost more than the story and discard FL's tested contract.

---

### Where should the new rules tests run?
**Options considered**:
- A) Leave them in `functions-v2/test/` and add `firestore.rules` to that workflow's paths
- B) Port them to `firebase-test/` on the older v1 API

**Decision**: A. One workflow line gives the coverage; a port rewrites three files for no gain.

---

### Do the FL connection settings need changing?
**Options considered**:
- A) Set them as the guide's table says
- B) Leave them

**Decision**: B. Both project `.env` files already hold the guide's values, and the key is the existing secret.

---

### What deploy timing should functions, rules and indexes carry?
**Context**: The new client breaks under master's rules; the released client cannot start new conversations under the new rules or Functions; nothing writes the indexed collection until the new Functions run.
**Options considered**:
- A) indexes before, rules with, functions with
- B) indexes before, rules with, functions after

**Decision**: A (Doug). Deploying Functions later would leave the new client without task context and recovery meanwhile, and adds no breakage the rules don't already cause.

---

### Does the retention of failed reservations need its own story?
**Context**: A failed turn keeps its full request in `chatTutorPendingRequests` until recovered, with no expiry.
**Options considered**:
- A) A follow-up story for deleting `chatTutor` and `chatTutorPendingRequests` data
- B) Rely on the spike's "delete the collection wholesale" plan
- C) Add an expiry here

**Decision**: A (Doug). An expiry would delete a request before its outcome is known, which the package deliberately prevents.

---

### How does support clear a delivery in the "needs support" state?
**Options considered**:
- A) Document a manual procedure in `docs/fl-integration.md`
- B) A follow-up story for a support tool
- C) Leave it out

**Decision**: A (Doug). The procedure mirrors "continue": with a reservation, check FL by request id, apply its turn and trace, copy the source workspace and delete the reservation; without one, leave the turn alone. Advancing the turn keeps the next request from reusing its `Idempotency-Key`. A reserved ownership mismatch needs an engineer.

---

### Should a failure before anything reached FL be retryable?
**Context**: As delivered, any non-FL error before the reservation committed was recorded as `blocked`, and recovery refused both actions without a reservation, so the student was stuck although nothing was sent.
**Options considered**:
- A) Record it as `retryable` (`FL_NOT_DISPATCHED`) and allow a retry without a reservation
- B) Keep the package's behavior; support clears it
- C) A follow-up story

**Decision**: A (Doug). Fix 9. Errors `reserve()` raises itself stay blocked.

---

### How should keyboard focus survive the delivery fence?
**Context**: Every FL turn records a pending delivery, which disabled the focused input; Chrome then drops focus to `body`, outside the drawer's focus trap. Recovery buttons did the same when they were disabled and unmounted.
**Options considered**:
- A) `readOnly` plus `aria-disabled` on the input, Send disabled, and recovery clicks focus the input first
- B) Refocus the input when the fence lifts
- C) A follow-up story

**Decision**: A (Doug). Fix 10; the only option that keeps focus in the drawer through both the pending request and an unresolved failure. Verified in a real browser against the emulators.

---

### How should large workspaces fit the reservation?
**Context**: The reservation held the raw workspace JSON-escaped, so workspaces over about 790 KB exceeded the 980,000-byte limit and every turn from them was blocked.
**Options considered**:
- A) Keep the raw workspace out of `snapshotJson`
- B) Lower the browser's attach budget
- C) Accept it as a limitation

**Decision**: A (Doug), simplified: the workspace is not reserved at all. It is read again after dispatch from the immutable source message or the parent's copy, and "continue" takes it from the source message. Fix 11.

---

### Should `AI_CHAT_UNAVAILABLE` count sends or failed attempts?
**Context**: Keyed on the failure id, one send whose retries kept failing logged once per retry, and the timeout re-armed on each recovery.
**Options considered**:
- A) Key both logs on the delivery's source message
- B) Count failed attempts and reword R7a

**Decision**: A (Doug). Both events stay rates over `AI_CHAT_MESSAGE_SENT`.

---

### Should a failed lookup on open be retried?
**Context**: The transport cached a rejected conversation lookup and attached listeners only on the first success, so one network blip left Ada unusable until the drawer was reopened.
**Options considered**:
- A) Don't cache a rejected lookup; attach the listeners when a later send or recovery resolves it
- B) Tell the student to reopen Ada
- C) Accept it

**Decision**: A (Doug). Fix 12.

---

### Land the package as one commit, two, or many?
**Options considered**:
- A) One commit
- B) Two along the package's seam (complete minus ownership, then ownership), then a commit per fix
- C) Re-split by feature

**Decision**: B. The reverse apply of `OWNERSHIP_ONLY.patch` is clean and the intermediate tree passes every suite, so the security change gets its own reviewable commit; C would hand-split files into untested states.

---

### Log FL failures under the existing event or a new one?
**Options considered**:
- A) `AI_CHAT_UNAVAILABLE` with `deliveryState` and `deliveryCode` added
- B) A new `AI_CHAT_DELIVERY_FAILED` event

**Decision**: A. Existing reporting counts `AI_CHAT_UNAVAILABLE`; a new name would zero that count for FL.
