# The client-written activity document

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-693

**Status**: **Closed**

## Overview

When a student launched from the portal changes one of their CLUE documents, the CLUE app updates a small per-learner activity document in CLUE's Firestore, at most once every 5 seconds, after the change is saved. The researcher dashboard reads these documents, in the same path and shape report-service writes for Activity Player answers (REPORT-153), to count active students, show per-assignment activity (RD-12), and re-run a researcher's packages when the class's work changes (RD-6). No Cloud Function is involved; Firestore rules limit each student to their own document, their own offering's key and the server's clock.

Only real student work counts. A running simulation or DataFlow program changes the document on its own every second; those automatic steps are not activity, while a student's own slider drag, node edit or typing is. A record is written only after the change it reports has been saved, because the dashboard treats an analysis that started before the record's time as up to date. Students on an older CLUE release, or launched from an assignment pinned to an older CLUE version, record nothing until they reach the release with this change.

CLUE-693 was first built as a Cloud Function on history writes (branch `CLUE-693-the-history-write-activity-trigger`, `90ba1f049`, never pushed or deployed). It keyed `changed` by CLUE document key where RD-12 looks up portal offering ids, recorded teachers and unchecked uploader stamps, counted every Simulator and DataFlow tick, and dropped the last edit of each burst. The research on channel `stream/researcher-dashboard/clue-activity` (#838) and the design sketch (global oob `streams/researcher-dashboard/clue-693-client-written-sketch.md`) replaced it with this client-written document.

## Requirements

### Who records

- **R1.** A recorder runs only when `appMode === "authed"`, `user.isStudent`, and the user has a `classHash` and an `offeringId`. Portal and standalone launches both qualify (standalone students hold the same learner token); demo, qa, dev, test, previews, teachers and researchers never write.

### What counts

- **R2.** A local, non-empty history entry of a document the student is editing counts, and nothing else: remote entries (`addHistoryEntryAfterApplying`) and playback copies (`uploadLocalHistory: false`) never reach the recorder.
- **R3.** Tick entries do not count: `model "SimulatorTool"` with an action ending `/step`, and `model "DataflowProgram"` with an action ending `/tickAndProcess`. There is no input-event gate. Entries a tile records as it opens, such as a backfilled text tile title or a row height, count like any other change.

### When it writes

- **R4.** A counted entry is written only after both its history upload has resolved and an RTDB content save whose `lastHistoryEntryId` is the entry or a later entry of the same document's history has succeeded. If no such save is confirmed within 30 s while the tab stays open, it is written anyway. An entry whose upload fails (the metadata document never appears, or the write is rejected) or which the concurrent manager rolls back after a fork is dropped and never written, `pagehide` included.
- **R5.** Throttle: the first counted change after a quiet period is written as soon as R4 allows; later changes wait until 5 s after the previous write's acknowledgment (the throttle, per tab); each write covers every change that has landed by then, and a trailing write always follows the last change of a burst. At most one write is in flight. The recorder never debounces. On `visibilitychange` to hidden, changes that have landed are written as soon as the 5 s throttle allows, and unconfirmed ones keep waiting. On `pagehide`, every pending change is written at once without waiting for its save or the throttle. A write started in `pagehide` may not complete; that is the design's known loss.
  - *(The hidden-tab behavior needs no `visibilitychange` handler: every upload, save and timer already schedules the next write.)*
- **R6.** A failed write keeps its changes for the next write, folded into one retry that keeps whether any was in the launch offering. The wait before the next write doubles with each consecutive failure (10 s, 20 s, 40 s), up to 60 s, and a success resets it to the 5 s throttle.

### The document

- **R7.** The recorder writes `researcher_dashboard/{escapeKey(user.portal)}/activity/{user.classHash}/users/{user.id}` with a merge `set` of `lastActivityAt: serverTimestamp()`, `writeCount: increment(1)`, and `changed.{user.offeringId}: serverTimestamp()` when any change the write covers was in a document of the launch offering: a problem or planning document, or a group document whose owner is the student's group in this offering (`user.userIdForGroupDocuments`). Personal, learning log and class documents bump `lastActivityAt` and `writeCount` only. The key comes from `user.offeringId`, never `DocumentModel.offeringId`, which is unset for problem documents opened from the offering listener.
- **R8.** No identity fields, no cap logic (the rule bounds keys to the offering in the learner's token), and nothing deletes a document.

### Rules and index

- **R9.** Keep the researcher read rule. Add the learner write rule: own `uid` (`platform_user_id`), `class_hash` and token portal (`platform_id`'s host labels equal `{portal}` split on `_`, report-service's comparison); only `lastActivityAt`, `writeCount` and `changed`; times equal `request.time`; `writeCount` up by exactly one; only the token's `offering_id` key changes in `changed`. No time floor: each tab throttles itself, and a student's tabs share one document. No delete. The block's comment says who writes the documents and under what limits.
- **R10.** `firestore.indexes.json` gains a field override exempting `changed` on the `users` collection group from indexing (`indexes: []`), as report-service's does. Nothing queries the map.

### Tests

- **R11.** Rules tests in `firebase-test/src/researcher-dashboard-activity-rules.test.ts`, using a `learnerAuth` fixture in `setup-rules-tests.ts` with the real `user_type: "learner"` and `offering_id` and `platform_id` claims: 19 write cases, including writes in quick succession and two tabs writing at once, both accepted, and the existing client-write refusal test renamed for the researcher, teacher and student-claim tokens it covers.
- **R12.** Recorder unit tests on fake timers, each named for the line it guards: ticks, the upload-and-save condition, the timeout, leading and trailing writes, no debounce, hidden and `pagehide`, the retry backoff and its reset, the key per document type, and the R1 gate per app mode, role, and missing class hash or offering. History-manager tests show an entry is reported only once its upload is accepted.
- **R13.** Staging check: a staging student with `firebaseEnv=staging` edits a text tile and their activity document appears within seconds with the offering key; a running EMG simulation alone writes nothing more; and opening a problem document without editing it is recorded, to measure how often tiles' writes on open set `changed`. *(A post-deploy check, not code; see Not Yet Implemented.)*

### Docs

- **R14.** `docs/firestore-schema.md` gains a "Researcher dashboard activity" section holding the contract: path, fields, what counts, who writes, the 5 s per-tab interval, that a launch without `firebaseEnv=staging` writes to production Firebase, and that an offering pinned to a `/version/` URL records nothing until it is repointed. The list of top-level collections gains `researcher_dashboard`.

## Technical Notes

- **Where it lives.** `src/models/stores/activity-recorder.ts` (the recorder); `FirestoreHistoryManager` and `FirestoreHistoryManagerConcurrent` report each landed local entry through `onLocalEntryUploaded`; `DocumentsModel` passes that callback, with the document, into both managers; `useDocumentSyncToFirebase` reports each successful content save's stamped id through an `onContentSaved` callback, which `EditableDocumentContent` points at the recorder; the recorder keeps the latest per document. `Stores` creates the recorder in its constructor and hands it to `DocumentsModel`; it listens for `pagehide` only once it records a change.
- **The save can carry the previous entry's id.** For a plain tile edit the entry completes before the leading save's `transform` runs, so that save carries the new entry's id. For an edit to a shared model, `recordAction`'s extra `startExchange` await completes the entry after the leading save captured its id, so the leading save carries the previous entry's id. A trailing save covers it only when the follow-up action changes content; otherwise no snapshot follows the entry and it waits for the next save or the 30 s timeout. This is why R4 compares positions in the history, with the 30 s timeout as a backstop.
- **Retried saves.** react-query retries by calling the mutation again with the same snapshot, so `transform` would stamp the old content with a newer entry. The hook keeps each snapshot's first-attempt id in a `WeakMap`.
- **Ticks.** `src/plugins/simulator/model/simulator-content.ts` (`SimulatorTool`, `step`) and `src/plugins/dataflow/model/dataflow-program-model.ts` (`DataflowProgram`, `tickAndProcess`). The entry's `model` is the action's model name and its `action` the full path, so it ends with `/step` or `/tickAndProcess`. The PR names both so a later rename (Scott Cytacki's tick work) updates the recorder too.
- **Group documents** are type `axes`, owned by `group_<offeringId>_<groupId>`; R7 compares the document's `uid` with `user.userIdForGroupDocuments`. Class documents are owned by `class_<classHash>`.
- **The token's offering.** The rule takes the key from the token's `offering_id`; the client from `user.offeringId`. Both come from the same launch. A mismatch would have every write refused: R6's backoff then retries once a minute, each with a console warning.
- **The `{portal}` segment** is `escapeKey(user.portal)`, the escaping CLUE's own `authed/{portal}` root uses, which equals report-service's segment for real portal hosts.
- **Deploy timing:** rules before and indexes before the client release (the released client never writes this path; the exemption must exist before the first write). No functions deploy. Order: staging indexes then rules through `releasing-clue` (compare deployed rules with `master` first), a branch build against staging Firebase for R13, production indexes and rules, then the CLUE release.
- **Review.** Scott Cytacki reviews the PR: the history-manager and save-hook changes and the tick-name coupling.

## Out of Scope

- RD-6 pass 2: the researcher dashboard's CLUE listener, which Firebase project per environment, the per-learner merge of `changed`, and the RD prose that says report-service is the only writer.
- Scott's tick work (a marker on tick entries).
- Pruning activity documents.
- Activity from comments or metadata changes (title, visibility, properties).
- Repointing offerings pinned to a `/version/` URL (documented, R14).
- Deleting the old branch `CLUE-693-the-history-write-activity-trigger`, which waits on Doug's go.

## Not Yet Implemented

- R13's staging check: a post-deploy check, run after the staging rules and indexes deploy against a branch build on staging Firebase.

## Decisions

### Drop an entry whose upload fails or is rolled back
**Context**: R4 released an entry only once its upload resolved. A rolled-back entry (concurrent fork) and one whose metadata document never appears never resolve, so they would stay pending until `pagehide`.
**Options considered**:
- A) Drop it: it records no change, since the change was reverted or never stored.
- B) Let the 30 s timeout also release an entry waiting on its upload.
- C) Leave it pending; `pagehide` writes it.

**Decision**: A (Doug). Neither change is in the history REPORT-109 exports, so neither is activity; B reports a change that is not stored and C leaves a pending list that only grows. The managers report only successful uploads, so the recorder never hears of the rest, with no extra API.

---

### Entries a tile records as it opens
**Context**: Some tiles change the document when they mount, with no student input (a backfilled text tile title, a row height, DataFlow's output config). They complete as local, non-tick entries, so opening a problem document can set `changed`.
**Options considered**:
- A) Count them, and have R13 measure how often opening a document writes.
- B) Skip every non-undoable entry except undo and redo, which also drops data card navigation and `noUndo` shared-variable edits.
- C) Add these actions to the tick list.

**Decision**: A (Doug). They are real content changes and mostly one-time, and the 5 s throttle folds the rest into about one write per open.

---

### Which test proves a group document belongs to the launch offering
**Context**: The sketch said "a group document owned by `group_{user.offeringId}_*`".
**Options considered**:
- A) Prefix match on the stored `uid`.
- B) Compare the stored `uid` with `user.userIdForGroupDocuments`.

**Decision**: B. `document-axes.ts` asks callers to build the owner id and compare rather than parse a stored uid; the result is the same for every document a student can edit.

---

### What "a save at or after the entry" means
**Context**: R4 needs an order between a save's `lastHistoryEntryId` and a pending entry.
**Options considered**:
- A) Any save that succeeds after the entry completed.
- B) A save whose `lastHistoryEntryId` is at the entry's position in the document's history or later.

**Decision**: B. A leading save can succeed after the entry completed while carrying the previous entry's id (shared-model edits), so A would release an entry whose content was not saved.

---

### Where the recorder learns which entry the last save covered
**Context**: The sketch asked for a volatile last-saved history entry id. The first version kept `DocumentModel.savedLastHistoryEntryId`, the envelope's id loaded for the drift check, current on every save. Scott Cytacki's review: the drift check stayed correct only because the history manager copies the value in its constructor, nothing guards that, and the planned settled-state work needs the loaded id.
**Options considered**:
- A) Keep the existing field current on every save.
- B) A second volatile field on `DocumentModel` for the last saved entry.
- C) The save hook reports each successful save to the recorder, which keeps the latest id per document.

**Decision**: C (Scott's Option 2). The document model and `savedLastHistoryEntryId` stay as on master; the "last saved" state lives in the one place that uses it, so nothing else can read it as RTDB's id (for a group document it is only this client's last save). It also drops the MobX reaction per document.

---

### Create the recorder when R1 holds, or always and gate per entry
**Context**: The sketch said `stores.ts` creates the recorder when R1 holds.
**Options considered**:
- A) Create it after authentication, only for a launched student.
- B) Create it with the other services in the `Stores` constructor, and check R1 on each entry.

**Decision**: B. The user is authenticated and their offering known only after the stores exist, and `setAppMode` can change the mode; a per-entry check needs no second hook into authentication. The behavior is R1's either way. Every test store builds a recorder, so it adds its `pagehide` listener only when it first records a change.

---

### How the recorder learns an entry failed or was rolled back
**Context**: R4 drops an entry whose upload fails or is rolled back.
**Options considered**:
- A) The managers report completion, upload, failure and rollback; the recorder tracks each.
- B) The managers report only successful uploads; the recorder never hears of the rest.

**Decision**: B. A rolled-back entry is removed from the queue before upload and a failed one never resolves, so neither reaches the callback.

---

### A retried save stamped older content with a later entry's id
**Context**: react-query reruns the mutation on retry, so `transform` read the latest entry again; a throwaway test showed the retry writing the newer id, which `onSuccess` would hand the recorder as saved.
**Options considered**:
- A) Keep each snapshot's first-attempt id in a `WeakMap` and reuse it on retry.
- B) Leave it; the recorder would release an entry whose content was not saved.

**Decision**: A.

---

### A save whose snapshot a newer one replaced before it ran
**Context**: react-query runs the mutation a few microtasks after `mutate()`, so when two changes land in one synchronous turn, both entries can complete before the first save reads the latest entry, and that save would claim the second change before its content is saved.
**Options considered**:
- A) Stamp every save with the latest entry when its snapshot was taken.
- B) Stamp only the newest snapshot with the latest entry; a snapshot already replaced keeps the entry from when it was taken.

**Decision**: B. A snapshot's own entry completes after the snapshot, so A would under-claim every single edit and make it wait the 30 s timeout; B only under-claims the replaced snapshot, whose newer snapshot's trailing save covers both changes.

---

### An older save's success can move the saved id backwards
**Context**: An older save's `onSuccess` can arrive after a newer one's and move the recorder's saved id to an earlier entry: on a retry, or because each save also waits on the Firestore `tools` update, which can resolve out of order.
**Options considered**:
- A) Guard against it in the hook.
- B) Accept it: an entry already written is unaffected, and a pending one waits for the next save or the 30 s timeout.

**Decision**: B. The id can then name an earlier entry than RTDB holds, which only delays a write.

---

### The `visibilitychange` handler did nothing
**Context**: Deleting the listener left every recorder test green: it only called `schedule()`, which every upload, save reaction and timer already calls.
**Options considered**:
- A) Keep it.
- B) Remove it; the hidden test still guards against a flush on hide.

**Decision**: B. R5's hidden behavior is unchanged.

---

### A 5 s floor in the rule
**Context**: The first version's rule refused a write within 5 s of the stored `lastActivityAt`. The document is per learner, so a student's tabs share it: one tab's writes were refused, three refusals stopped it, its `changed` key waited, and a `pagehide` write could be lost. Scott Cytacki's review.
**Options considered**:
- A) Keep the floor, with R6's refusal retry and stop, and a test keeping the client's constant equal to the rule's.
- B) Drop it and rely on each tab's own throttle.

**Decision**: B. An honest client never writes faster than 5 s per tab, and a student who wanted to flood the document can already write unlimited history and content. The rest of the rule protects the data. R6 becomes a backoff for any failed write.

---

### Recorder lines no test guarded
**Context**: Mutating the recorder left the suite green for lines including the class and offering gate and `pagehide` ignoring the throttle.
**Options considered**:
- A) Add a test for each.
- B) Leave them unguarded.

**Decision**: A. Each new test fails exactly its mutation.

---

### Nothing to delete on this branch
**Context**: The sketch's kept, replaced and deleted table was written against the old trigger branch.
**Options considered**:
- A) Carry the table as written.
- B) Describe this branch: only the read rule and its tests exist, so the exemption and schema section are added fresh and nothing is deleted.

**Decision**: B.
