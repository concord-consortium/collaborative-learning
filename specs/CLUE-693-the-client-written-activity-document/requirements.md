# The client-written activity document

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-693
**Repo**: https://github.com/concord-consortium/collaborative-learning
**Implementation Spec**: [implementation.md](implementation.md)
**Status**: **In Development**

## Overview

When a student launched from the portal changes one of their CLUE documents, the CLUE app updates a small per-learner activity document in CLUE's Firestore, at most once every 5 seconds, after the change is saved. The researcher dashboard reads these documents, in the same path and shape report-service writes for Activity Player answers (REPORT-153), to count active students, show per-assignment activity (RD-12), and re-run a researcher's packages when the class's work changes (RD-6). No Cloud Function is involved; Firestore rules limit each student to their own document, their own offering's key and the server's clock.

## Project Owner Overview

The portal's researcher dashboard needs to know when the students in a CLUE class change their work: to show how many are working now, which assignments they are working in, and when a researcher's analysis is out of date. Activity Player classes already have this through report-service. This story gives CLUE classes the same records, written by the CLUE app itself as each student's change is saved, so the dashboard reads both platforms the same way.

Only real student work counts. A running simulation or DataFlow program changes the document on its own every second; those automatic steps are not activity, while a student's own slider drag, node edit or typing is. A record is written only after the change it reports has been saved, because the dashboard treats an analysis that started before the record's time as up to date. Students on an older CLUE release, or launched from an assignment pinned to an older CLUE version, record nothing until they reach the release with this change.

## Background

CLUE-693 was first built as a Cloud Function on history writes (branch `CLUE-693-the-history-write-activity-trigger`, head `90ba1f049`, never pushed or deployed). Comparing it with REPORT-153 and RD-12 (global oob `streams/researcher-dashboard/clue-693-vs-report-153.md`) showed it keyed `changed` by CLUE document key where RD-12 looks up portal offering ids, recorded teachers and unchecked uploader stamps, counted every Simulator and DataFlow tick (about 15 invocations a second per running EMG simulation), and dropped the last edit of each burst. The research on channel `stream/researcher-dashboard/clue-activity` (#838, 2026-10-22) and the design sketch (global oob `streams/researcher-dashboard/clue-693-client-written-sketch.md`) replace it with a client-written document; every decision in that sketch is Doug's (2026-10-22) and is carried here.

This branch, `CLUE-693-client-written-activity-document`, is cut from `master` `5b2a13bfa` with the researcher read rule and its tests (`1e9c2dfe1`) cherry-picked as `2c6803b1d`. The trigger, its tests, its export, its README section, the `users.changed` index exemption and the `docs/firestore-schema.md` section were never on this branch, so nothing is deleted here; the exemption and the schema section are added fresh.

How CLUE saves a change today, which the recorder hooks into:

- **History.** `TreeManager.completeHistoryEntry` (`src/models/history/tree-manager.ts:181`) drops empty entries and calls `historyManager.onHistoryEntryCompleted` for each local entry. `FirestoreHistoryManager` (personal, problem, planning and learning log documents) writes it with a `docRef.set` it does not await (`firestore-history-manager.ts:247`), and skips it when `uploadLocalHistory` is false (history playback, `canvas.tsx:393`). `FirestoreHistoryManagerConcurrent` (group and class documents) queues entries and uploads up to 20 in a transaction (`firestore-history-manager-concurrent.ts:227-397`); a `RemoteHeadChangedError` leaves the queue for the receive side to drain. Remote entries arrive through `addHistoryEntryAfterApplying`, which never calls the history manager.
- **Content.** `useDocumentSyncToFirebase` (`src/hooks/use-document-sync-to-firebase.ts`) saves the content to RTDB on every MST snapshot, through a 1 s lodash throttle and a react-query mutation with `retry: true`. Its `transform` stamps the save with `lastHistoryEntryId`, the id of `treeManager.latestDocumentHistoryEntry` when the mutation runs (`:248-262`). `saveState` reaches `Saved` only when no newer change is pending, which never happens while a simulation runs.
- **Who is launched.** `user.isStudent` is `type === "student"` (`src/models/stores/user.ts:163`), the client remap of the token's `user_type: "learner"`. `user.id` is the portal user id (`auth.ts:252`), `user.classHash` and `user.offeringId` come from the launch, and `user.portal` is the portal host, escaped with `escapeKey` for Firestore roots (`src/lib/root-id.ts:8`).

## Requirements

### Who records

- **R1.** A recorder runs only when `appMode === "authed"`, `user.isStudent`, and the user has a `classHash` and an `offeringId`. Portal and standalone launches both qualify (standalone students hold the same learner token); demo, qa, dev, test, previews, teachers and researchers never write.

### What counts

- **R2.** A local, non-empty history entry of a document the student is editing counts, and nothing else: remote entries (`addHistoryEntryAfterApplying`) and playback copies (`uploadLocalHistory: false`) never reach the recorder.
- **R3.** Tick entries do not count: `model "SimulatorTool"` with an action ending `/step`, and `model "DataflowProgram"` with an action ending `/tickAndProcess`. There is no input-event gate. Entries a tile records as it opens, such as a backfilled text tile title or a row height, count like any other change (Doug, 2026-10-22).

### When it writes

- **R4.** A counted entry is written only after both its history upload has resolved and an RTDB content save whose `lastHistoryEntryId` is the entry or a later entry of the same document's history has succeeded. If no such save is confirmed within 30 s while the tab stays open, it is written anyway (a late write costs at most one extra re-run). An entry whose upload fails (the metadata document never appears, or the write is rejected) or which the concurrent manager rolls back after a fork is dropped and never written, `pagehide` included: its change was never stored or was reverted.
- **R5.** Throttle: the first counted change after a quiet period is written as soon as R4 allows; later changes wait until 5 s after the previous write's acknowledgment; each write covers every change that has landed by then, and a trailing write always follows the last change of a burst. At most one write is in flight. The recorder never debounces: a new change does not push back a write that is already due. On `visibilitychange` to hidden, changes that have landed are written as soon as the 5 s floor allows, and unconfirmed ones keep waiting. On `pagehide`, every pending change is written at once without waiting for its save or the floor, the one accepted early write, since the alternative is none. A close within 5 s of the previous write is refused by the rule and lost, and a write started in `pagehide` may not complete; that is the design's known loss.
- **R6.** A write refused inside the 5 s window (another tab wrote) keeps the change pending and retries 5 s later; after 3 consecutive refusals the recorder stops until the next counted change.

### The document

- **R7.** The recorder writes `researcher_dashboard/{escapeKey(user.portal)}/activity/{user.classHash}/users/{user.id}` with a merge `set` of `lastActivityAt: serverTimestamp()`, `writeCount: increment(1)`, and `changed.{user.offeringId}: serverTimestamp()` when any change the write covers was in a document of the launch offering: a problem or planning document (both are loaded from `offerings/{user.offeringId}`) or a group document whose owner is the student's group in this offering (`user.userIdForGroupDocuments`). Personal, learning log and class documents bump `lastActivityAt` and `writeCount` only. The key comes from `user.offeringId`, never `DocumentModel.offeringId`, which is unset for problem documents opened from the offering listener.
- **R8.** No identity fields, no cap logic (the rule bounds keys to the offering in the learner's token), and nothing deletes a document.

### Rules and index

- **R9.** Keep the researcher read rule (`firestore.rules:827-829`). Add the learner write rule tested in the research's step 2: own `uid` (`platform_user_id`), `class_hash` and token portal (`platform_id`'s host labels equal `{portal}` split on `_`, report-service's comparison); only `lastActivityAt`, `writeCount` and `changed`; times equal `request.time`; `writeCount` up by exactly one; only the token's `offering_id` key changes in `changed`; at least 5 s since the stored `lastActivityAt`. No delete. The block's comment, which says the documents are written only by functions-v2's `onHistoryEntryCreated`, is rewritten to say who writes them and under what limits.
- **R10.** `firestore.indexes.json` gains a field override exempting `changed` on the `users` collection group from indexing (`indexes: []`), as report-service's does. Nothing queries the map. The override also covers CLUE's other `users` collections, none of which has a `changed` field or a query on one.

### Tests

- **R11.** Rules tests in `firebase-test/src/researcher-dashboard-activity-rules.test.ts`: the research's 19 write cases plus its 3 floor-timing cases, using a `learnerAuth` fixture in `setup-rules-tests.ts` with the real `user_type: "learner"` and `offering_id` and `platform_id` claims. The existing "refuses every client write" test, which once the learner can write is true only because `studentAuth` says `"student"`, is renamed for what it shows (writes from the class's researcher, teacher and student-claim tokens are refused) with its body kept; delete and wrong-learner writes are pinned by the write cases below. The write cases: the learner creates their own document with server times, with or without a `changed` key, and with `increment` for `writeCount`; another learner's document, class or portal is refused; another offering's key is refused, alone or beside the learner's own; client times, extra fields and a `writeCount` other than one more are refused; a second write inside 5 s is refused and one after it accepted; an update that changes a stored key of another offering is refused; delete is refused; teacher, researcher, plain-user and anonymous tokens are refused even on matching paths; a learner token missing `offering_id` or `platform_id` is refused; the class's researcher reads what a learner wrote; a non-merge overwrite that drops another offering's key is refused; `update()` with a dotted path to the learner's own key is accepted and to another key refused; resetting or skipping `writeCount` on update is refused; an update that leaves `lastActivityAt` unchanged is refused; a staging token is accepted on the staging segment, with or without a trailing slash on `platform_id`; a segment that matches only when underscores are read as dots is refused; an existing document with no `lastActivityAt` refuses the write. The timing cases: a write 5,000 ms after the previous acknowledgment is accepted 10 times running; one 4,900 ms after is refused; two tabs writing at once give exactly one success. The timing cases sleep in real time, about a minute between them.
- **R12.** Recorder unit tests on fake timers, each named for the line it guards: a tick entry writes nothing; a non-tick entry waits for both the upload and the content save; a save of an earlier entry does not release a later one; the timeout releases it; two changes inside 5 s give one leading and one trailing write; the trailing write covers a change made while the leading write was in flight; a steady stream of changes still writes every 5 s (no debounce); hidden writes only landed changes; `pagehide` writes unconfirmed ones, inside the floor too; a refusal retries, three consecutive refusals stop it, and the next counted change starts it again; the key per document type (problem, planning, group of this offering, personal, learning log, class); the R1 gate per app mode, per role, and for a launch with no class hash or no offering. A test asserts the client interval equals the rule's floor. The history-manager tests show the managers report an entry only once its upload is accepted: never for a failed upload, a missing metadata document, a transaction aborted by a moved head, an entry rolled back before upload, or a playback copy, which is how those entries are never written.
- **R13.** Staging check: a staging student in a portal-launched class with `firebaseEnv=staging` edits a text tile, and their activity document appears within seconds with the offering key; a running EMG simulation alone writes nothing more; and opening a problem document without editing it is recorded, to measure how often the writes made by tiles as they open (a default text tile title, a row height, DataFlow's output config) set `changed`. *(A post-deploy check, not code.)*

### Docs

- **R14.** `docs/firestore-schema.md` gains a "Researcher dashboard activity" section holding the contract: path, fields, what counts, who writes, the 5 s floor, and that a launch without `firebaseEnv=staging` writes to production Firebase. It also says activity is recorded only for students on a CLUE release that includes the recorder, launched from an offering that uses the current version: an offering pinned to a `/version/` URL records nothing until it is repointed (Doug, 2026-10-22). The list of top-level collections gains `researcher_dashboard`.

## Technical Notes

- **Files** (from the sketch, checked at `2c6803b1d`): new `src/models/stores/activity-recorder.ts` and its test; `src/models/history/firestore-history-manager.ts` and `firestore-history-manager-concurrent.ts` (an `onLocalEntryUploaded` callback; the single-writer `set` promise is kept instead of dropped); `src/models/stores/documents.ts` (passes the callback, with the document, into both managers, `:260-280`); `src/models/document/document.ts` and `src/hooks/use-document-sync-to-firebase.ts` (a volatile last-saved history entry id, set in the save's `onSuccess`); `src/models/stores/stores.ts` (creates the recorder when R1 holds); `firestore.rules`; `firestore.indexes.json`; `firebase-test/src/setup-rules-tests.ts` and `researcher-dashboard-activity-rules.test.ts`; `docs/firestore-schema.md`.
- **The save can carry the previous entry's id** (throwaway jest test against the real hook and react-query 3.39.2, 2026-10-22). For a plain tile edit (`addTile`, `TextContent setText`) the entry completes before the leading save's `transform` runs, so that save carries the new entry's id. For an edit to a shared model (a table's `DataSet addCanonicalCasesWithIDs`, `setCanonicalCaseValues`), `recordAction`'s extra `startExchange` await completes the entry after the leading save captured its id, so the leading save carries the previous entry's id; the entry was covered by the trailing save that the tile's own shared-model sync triggered. When no later save comes, R4's 30 s timeout releases the entry. This is why R4 compares positions in the history rather than waiting on "a save after the entry completed".
- **Ticks** (`src/plugins/simulator/model/simulator-content.ts:202`, `.named("SimulatorTool")` at `:25`; `src/plugins/dataflow/model/dataflow-program-model.ts:243`, `model("DataflowProgram")` at `:166`). The entry's `model` is `getActionModelName(call)` and its `action` the full action path (`tree-monitor.ts:236-237`), so an action path ends with `/step` or `/tickAndProcess`. `DataflowProgram processAfterProgramChange` is not a tick and counts. Measured in the research (doc editor): ticks excluded, a running simulation writes nothing; continuous editing writes 12 a minute at a 5 s floor; a slider drag (`Variable commitTemporaryValue`) and DataFlow edits (`NumberNodeModel setValue`, `SensorNodeModel setSensorType`, `DataflowNode setPosition`) each record their own non-tick entry. The PR names both tick action names so a later rename (Scott Cytacki's tick work) updates the recorder too.
- **Group documents** are type `axes` (`document-types.ts:19`) owned by `getGroupOwnerId(offeringId, groupId)`, `group_<offeringId>_<groupId>` (`document-axes.ts:35`). Its comment asks callers to build the id and compare rather than parse a stored uid, so R7 compares the document's `uid` with `user.userIdForGroupDocuments`. Class documents are owned by `class_<classHash>`.
- **The token's offering.** The rule takes the key from the token's `offering_id`; the client takes it from `user.offeringId`. Both come from the same launch: `Portal.offeringId` is the bare id from the portal JWT's `offering_id`, the `offering` URL's last segment, or the standalone user's offering (`src/models/stores/portal.ts:179-185`), and the learner's Firebase token is minted for that launch, so `string(offering_id)` equals it. A mismatch would have every write refused: R6's stop after three refusals lasts only until the next counted change, so a student who keeps editing makes one refused write (and one console warning) every 5 s.
- **The `{portal}` segment** is `escapeKey(user.portal)`, the same escaping CLUE's own `authed/{portal}` Firestore root uses (`root-id.ts:8`), which equals report-service's segment for real portal hosts.
- **The floor.** Both the client's 5 s and the rule's `duration.value(5, "s")` compare server times: 5,000 ms after the write's acknowledgment was accepted 10 of 10, 4,900 ms refused, and two tabs give one write (research step 4).
- **Rules harness** (research step 2, rerun not needed: this branch's `firestore.rules` is byte-identical to the harness's base, checked 2026-10-22): the draft rule passed 19 emulator cases unchanged, removing each clause in turn was caught by a case, and the full rules suite passed (511). `chat-tutor-rules.test.ts:14` keeps its own local `learnerAuth`, with ids of its own.
- **Deploy timing** (Doug, 2026-10-22): **rules: before** (the released client never writes this path; the new client's writes are refused until the rule is deployed); **indexes: before** (exempts the field before the first write creates index entries for it). No functions deploy: the trigger was never deployed. Order: staging indexes then rules through `releasing-clue` (compare deployed rules with `master` first, since a rules deploy publishes the whole file); a branch build against staging Firebase for R13; production indexes and rules; then the CLUE release.
- **Review.** Scott Cytacki reviews the PR (Doug, 2026-10-22): the history-manager and save-hook changes and the tick-name coupling.

## Out of Scope

- RD-6 pass 2: the researcher dashboard's CLUE listener, which Firebase project per environment, the per-learner merge of `changed`, and the RD prose that says report-service is the only writer.
- Scott's tick work (a marker on tick entries).
- Pruning activity documents.
- Activity from comments or metadata changes (title, visibility, properties).
- Repointing offerings pinned to a `/version/` URL (documented, R14).
- Deleting the old branch `CLUE-693-the-history-write-activity-trigger`, which waits on Doug's go.

## Open Questions

### RESOLVED: Judgment call: which test proves a group document belongs to the launch offering
**Context**: The sketch says "a group document owned by `group_{user.offeringId}_*`".
**Options considered**:
- A) Prefix match on the stored `uid`.
- B) Compare the stored `uid` with `user.userIdForGroupDocuments`.

**Decision**: B. `document-axes.ts` asks callers to build the owner id and compare rather than parse a stored uid, and a student edits only their own group's document. Same result as A for every document a student can edit.

### RESOLVED: Judgment call: what "a save at or after the entry" means
**Context**: R4 needs an order between a save's `lastHistoryEntryId` and a pending entry.
**Options considered**:
- A) Any save that succeeds after the entry completed.
- B) A save whose `lastHistoryEntryId` is at the entry's position in the document's history or later.

**Decision**: B. The throwaway test shows a leading save can succeed after the entry completed while carrying the previous entry's id (shared-model edits), so A would release an entry whose content was not saved.

### RESOLVED: Judgment call: nothing to delete on this branch
**Context**: The sketch's kept, replaced and deleted table is written against `5b2a13bfa..90ba1f049`.
**Options considered**:
- A) Carry the table as written (keep the exemption and schema doc, delete the trigger files).
- B) Describe this branch: only the read rule and its tests exist; the exemption and schema section are added fresh, and nothing is deleted.

**Decision**: B. The sketch's table was written against the old branch; on this one only the read rule and its tests exist.

## Self-Review

Roles: Senior Engineer, Security Engineer, QA Engineer, Education Researcher, Operator.

### Senior Engineer

#### RESOLVED: An entry whose upload never lands has no release
R4 releases an entry only once its upload resolves, and the 30 s timeout covers only the content save. Two code paths leave an upload that never resolves: `FirestoreHistoryManagerConcurrent.rollbackLocalEntries` removes rolled-back entries from the upload queue for good (`firestore-history-manager-concurrent.ts:458-460`; their effects are reverted and revert entries are appended as remote-style entries), and `FirestoreHistoryManager.waitForMetadataDocument` rejects after 5 s when the Firestore metadata document never appears, after which no history is saved for the session (`firestore-history-manager.ts:131-168`). Under R4 as written such entries stay pending until `pagehide` writes them (R5), and their change is never recorded while the tab is open.
**Options considered**:
- A) An entry that is rolled back or whose upload fails is dropped: it records no change, since the change was reverted or never stored (recommended; the managers report the rollback or failure through the same callback as the upload).
- B) The 30 s timeout also releases an entry waiting on its upload, so it is written late either way.
- C) Leave R4 as written; `pagehide` writes them.

**Decision**: A, added to R4 (Doug, 2026-10-22). A rolled-back entry's change was reverted and a failed upload's change is not in the history REPORT-109 exports, so neither is activity; B would report a change that is not stored, and C leaves a pending list that only grows.

### Security Engineer

No findings. The rule's clauses were each shown load-bearing in the research (step 2's one-by-one removal), `user.id` is the portal user id the token's `platform_user_id` carries (`auth.ts:252,279`), and previews launch as `demo` (`auth.ts:181-185`), so R1 excludes them. A student can forge their own activity at most every 5 s; the sketch accepts that.

### QA Engineer

#### RESOLVED: R11 named its cases only by count
The 19 write cases and 3 timing cases live in `/tmp/clue-activity-research/`, which is emptied at every boot, so "the research's 19 cases" would point at nothing. Fixed in place: R11 now lists each case.

### Education Researcher

No findings. The exclusion of ticks and the per-document-type key follow the sketch; activity recorded only after the save matches how RD treats `lastActivityAt`.

### Operator

No findings. Deploy timing and order are in Technical Notes; with the client released before the rules, every write is refused and R6 stops the recorder after three refusals per change, so the cost is console noise (one refused write every 5 s while a student keeps editing), not lost work.
