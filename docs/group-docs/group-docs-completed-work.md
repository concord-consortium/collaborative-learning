# Group Documents: Completed Work

Completed group-document work, in the order it landed. For where things stand today as a user or tester, see [group-docs-current-state.md](group-docs-current-state.md). For planned work, see [group-docs-plan.md](group-docs-plan.md). Original stories for GD-1 through GD-5 live in [group-docs-brainstorm.md](group-docs-brainstorm.md#breaking-down-the-work-for-full-document-clobbering).

## GD-1: Basic group-document UI

Open a group document on the right side of CLUE; create a Firebase/Firestore location for group documents; add a new document type so the rest of the system can treat it differently. Members' writes overwrite each other and remote changes are not visible — deliberately unsafe foundation work that subsequent stories build on.

## GD-2: Read/write mode with Firestore listener

Open the group document in a mode that monitors history entries from Firestore and applies remote entries to the local document model the same way an undo applies patches, including the shared-model update code. Concurrent-edit handling is left to GD-5/GD-6. Implementation: `FirestoreHistoryManagerConcurrent` in [src/models/history/firestore-history-manager-concurrent.ts](../../src/models/history/firestore-history-manager-concurrent.ts).

## GD-3: Pause/resume debug controls

A button/hotkey that pauses upload of history entries to Firebase and resumes on demand. With pause active, two clients can manufacture the conflict scenarios needed to verify subsequent stories. Used throughout the manual reproduction scripts in [test-scripts/](test-scripts/).

## GD-4: History viewer

Developer-facing panel showing the list of history entries with the user who made each change. Replaces console-only inspection. Distinct from the user-facing **history scrubber** (the playback slider students see), which is a separate UI; the viewer is for inspecting and debugging the entry stream during development. Foundation for later end-user features (history-aware undo, scrubber improvements, etc.).

## GD-5: Firestore-transaction-based history writes — split

Originally one story covering both transaction infrastructure for safe history append *and* fork detection/rollback. Landed in two pieces:

- **Transaction infrastructure** as **CLUE-376**: `metadata.lastHistoryEntry`, `previousEntryId` chaining, Firestore transactions in `uploadQueuedHistoryEntries()`. After this story two clients no longer clobber each other's history-tail metadata, but local entries that lost the race were not yet rolled back — the chain would just chain off whatever remote head it found.
- **Fork detection and rollback** became **GD-6** (below).
- **Conflict merging**, originally envisioned as GD-5's future-work tail, became **GD-9 and GD-10** in the planned-work doc.

## GD-6: Corruption Prevention (PR #2835 / CLUE-485)

Client-side fork detection and rollback in two places that share a single codepath.

**Receive-side fork detection.** When a remote entry arrives whose `previousEntryId` doesn't match the local head, the client reverses its local uncommitted entries (using their undo patches) back to the fork point, drops them from the upload queue, and applies the remote entries.

**Send-side fork detection.** The upload transaction in `uploadQueuedHistoryEntries()` reads `metadata.lastHistoryEntry` on each attempt. If that id doesn't match what the client expected (i.e., another client has committed entries this one doesn't yet know about), the transaction aborts rather than chaining queued local entries onto a stale head. Once aborted, the Firestore listener delivers the unknown remote entries and the receive-side handler drains the queue via the shared rollback path.

**Shared codepath.** Both entry points route through a single rollback method, `detectAndResolveFork`. This is the extension point GD-9 plugged into; future merging work (GD-10, GD-14) extends it further.

After GD-6, the document and history are no longer corrupted by concurrent edits — but any conflict rolls back *all* of one user's local changes, which GD-9 then addressed.

## GD-9: Document-Level Merging (PR #2838 / CLUE-316)

Replaces the all-or-nothing rollback from GD-6 with a partial merge based on disjoint scopes.

Each entry's patches are partitioned into three scope kinds:
- `tile:<id>` — changes inside one tile's `tileMap` entry
- `shared:<id>` — changes inside one shared model's `sharedModelMap` entry
- `doc` — a single bucket covering `rowMap`, `rowOrder`, `annotations` (sparrows), document name, metadata, and anything outside `tileMap`/`sharedModelMap`

On fork detection, local uncommitted entries are walked oldest-first. The first entry whose scope set intersects any incoming remote entry's scope set triggers rollback of that entry and every later local entry. Earlier non-conflicting local entries survive and the remote entries are applied on top.

The scope module ([entry-scopes.ts](../../src/models/history/entry-scopes.ts)) is pure — no MST, no Firestore — so future undo/redo can reuse the "can I apply this entry given what has happened since?" primitive.

Two changes touching the same tile (even at disjoint sub-paths) still conflict — that's GD-14's territory in the plan. Two changes both touching the `doc` bucket still conflict — that's GD-15's territory.

Design and out-of-scope items: [merge-independent-forks-design.md](../superpowers/specs/2026-04-22-merge-independent-forks-design.md).

## GD-18: Settled-state document saves (PR #3086 / CLUE-751)

Every RTDB content save records whether its `lastHistoryEntryId` is exact, so the saved content is known to be the document's state at that entry, and that entry is already in Firestore. Group documents save only from a settled history, so the saved content is canonical state at a known position. Implementation: `ContentSaveSender` in [src/models/document/content-save-sender.ts](../../src/models/document/content-save-sender.ts), with the commit and settled signals supplied by `FirestoreHistoryManagerConcurrent` in [src/models/history/firestore-history-manager-concurrent.ts](../../src/models/history/firestore-history-manager-concurrent.ts). The sender is a plain class: it sends one write at a time, except on page hide and at the end of the drain, always the newest state, and shows `Retrying` when writes keep failing.

**Saving the snapshot taken when an entry completes.** A content snapshot is kept when each local history entry completes. Once that entry commits (the upload transaction succeeds), the sender saves the snapshot, stamped with the entry's id and its Firestore index. The snapshot is usable only if, when the entry completed, no other entry that could hold changes was open, no tracked flow that had changed state was running, and no load entry was waiting to join history. A snapshot is also voided if another member's entry is applied, or a fork rollback or merge happens, before its entry commits. This lets a lone runner whose entries complete faster than they upload keep making exact saves, each one upload behind. While entries wait to commit, the sender keeps the newest snapshot and, of the older ones, only one per second (the minimum gap between saves), up to 10 in all. A commit saves the newest snapshot kept among its entries, which is at most about a second behind it. A group document never saves content from a local entry that hasn't committed, and never makes an intermediate save: other members save in its place, and history holds every canonical entry.

**Idle members save the current state when settled.** An idle member has no local entries of its own, so it saves its current content when its history is settled: nothing queued or uploading, no apply in progress, nothing in the download buffer, no entry open, no running call with changes no entry holds yet, and a session that is still exact. The save is stamped with the last canonical entry (`expectedRemoteHead` and its index), not the last entry in local history, because after a fork rollback that is a local-only revert entry.

**Stale-check and jitter.** Before a group save, the sender compares the save's chain index with the index in the envelope's `exactThrough`. If the envelope is already at or past it, the save is skipped. Otherwise it waits a random 0 to 200 ms, checks again, and saves. Local history can't order two entry ids from before the load point, which is why the index is stored. A committing writer learns of its commit before the other members receive the entry, so it usually saves first and the idle members skip. An envelope whose `exactThrough` doesn't name its `lastHistoryEntryId` can't be ordered against a save, so it counts as behind.

**The envelope listener.** A group document listens to the envelope's `lastHistoryEntryId` and `exactThrough` children, not its content, so it checks that `exactThrough` names the id but can't check the content hash. It drives the stale-check, and when the envelope reaches this client's newest committed entry, the save indicator shows Saved even though another member made the save. The activity recorder is told the saved id the same way, so it doesn't wait out its timeout for every change an active editor makes.

**The envelope fields.** `DBDocument` in [src/lib/db-types.ts](../../src/lib/db-types.ts) has these optional fields:

- `exactThrough: { id, index, contentHash, since }` on an exact save. `id` and `index` are the stamped entry and its Firestore `index`. `since` is the entry from which history recreates the content; it carries forward while each load is exact, and restarts at the loaded id when it isn't. `contentHash` is `hashString` of the content string. A client that doesn't know the field saves with `update()` and leaves it in place, so a load trusts it only while `id` is the envelope's `lastHistoryEntryId` and `contentHash` matches the stored content (`readSavedEnvelope` in [src/models/document/content-save-envelope.ts](../../src/models/document/content-save-envelope.ts)). Otherwise the envelope is treated like an intermediate save.
- `notExact` on an intermediate save, holding evidence for debugging (open entries, running flows, uncommitted entry ids, why the session stopped being exact). Each save clears the other kind's field.

A session stops being exact when it can't vouch for its content, for example when a remote entry fails to apply or the content changed with no entry recording it. A failed apply marks the session not exact before the manager's `applying` flag clears, since the sender checks for a settled save as soon as it does. A group document then makes no more content saves from this client. The sender logs `CONTENT_SAVE_GROUP_STOPPED` once, and a failed apply also logs `HISTORY_REMOTE_APPLY_FAILED`.

**The notice over a group document that stopped saving.** The document shows a notice over its content and toolbar, chosen by the reason, with the reason as a code for reports ([src/models/document/save-stopped-notice.ts](../../src/models/document/save-stopped-notice.ts)):

- An entry that stayed open for 30 seconds: the document looks right, so the notice can be closed and suggests reloading, which starts an exact session.
- A change with no entry: later edits that build on it may not load, so the notice can't be closed, the document is read-only, and it asks for a reload. A second one in the same tab within 10 minutes means the reload didn't help, so it asks the user to tell their teacher instead.
- An entry that fails to apply at load: every load fails the same way, so the notice can't be closed and asks the user to tell their teacher.
- Another member's entry that fails to apply: the notice can't be closed and asks for a reload, which helps when this tab's own changes caused it.
- Saved content at an entry the history doesn't have: the document looks right but no load saves again, so the notice can be closed and asks the user to tell their teacher.

A notice that can't be closed makes the document under it inert. Closing and reopening the document doesn't start a new session, since the document model stays in the store, so only a reload does.

**The initial load from an exact envelope.** When the envelope's `exactThrough` is trusted, the initial load of a group document starts from the envelope's entry and applies only the entries after it, instead of reading the content and Firestore's last entry separately. That removes the initial-load race for these envelopes, and `since` carries forward.

**Individual documents.** The same sender saves individual documents (any document that isn't `concurrent`) using the same snapshot rule, plus intermediate saves when no exact save has been possible for 5 seconds, since an individual document has a single writer and would otherwise lose work. An intermediate save clears `exactThrough`, and records why in its `notExact` evidence.

An individual document whose envelope has `exactThrough` and is behind its history applies the missing entries, up to 200, when its owner opens it for editing. Until then it is read-only, and a document that is only listed never queries Firestore for its history. The catch-up starts from the document's current envelope, which the content listener replaces along with the content. When the load converted old tiles or shared models, or a missing entry is a load entry, the entries are applied to the content as stored, before the conversion, since they were recorded against that format, and the result is converted again. As soon as the sender starts, it saves the caught-up content, so the RTDB content isn't left behind its history. An envelope without `exactThrough` can hold entries after its `lastHistoryEntryId`, so applying the entries after that id could apply some of them twice. When such an envelope is behind its history, nothing is applied for it: the document opens as saved, and the session isn't exact, so its saves are intermediate ones. One at Firestore's last entry has nothing to catch up, so the session is exact. Publications are never caught up.

On page hide, the sender sends the newest committed snapshot save at once, without waiting for the minimum gap or the write in flight. The sender listens for page hide itself, so this also happens while it keeps saving after the document unmounts. When the document already relies on intermediate saves and no snapshot save covers the latest change, it sends an intermediate save of the current content instead. A document relies on them when one has been sent since the last exact save, when the session isn't exact, or when the envelope the RTDB holds has no `exactThrough`, or there is none. The next load can't catch up from such an envelope, so an intermediate save over it loses nothing. The client tracks that envelope in the document's `savedEnvelope`.

**Known gaps.**

- A change made while history monitoring is off isn't detected, so it can sit inside a settled save. That covers fixups made when a document mounts, before monitoring starts, fixups made while an individual document's load catch-up runs (the document is read-only then, so monitoring is off), and changes made while the sender keeps saving after the document unmounts.
- A patch made outside an action while a flow is suspended isn't detected either, since the suspended flow counts as a tracked call. MST protection should make such a patch impossible, so one would mean something bypassed it.
- A remote entry that always fails to apply stops a group document's content saves, and every member that loads the document fails on it. Watch for `HISTORY_REMOTE_APPLY_FAILED`. See [Remote Entries That Fail to Apply Stay in History](group-docs-implementation-todos.md#remote-entries-that-fail-to-apply-stay-in-history).
- Saved content at an entry the history doesn't have stops every later session's saves, since no load is exact. Nothing repairs it yet.
- The group upload race, and the initial-load race for a group envelope without a trusted `exactThrough`, are listed under [GD-22](group-docs-plan.md#gd-22-reliability-and-robustness).

## CLUE-483: UI Disruption Testing

Tested whether transient UI disruptions from concurrent editing are tolerable in practice. Reframed the [requires active interaction] cases catalogued in [test-scripts/](test-scripts/) to be exercised by one person across two browser sessions using GD-3's pause/resume (5-second resume delay), and split each Result row into Expected vs. Actual.

Initial findings:

- **Table**: dragged row disappears if the other user deletes it
- **Text**: cursor/selection jumps back by the character count of insertions before the cursor; uncommitted typing is lost on remote update
- **Expression**: uncommitted keystrokes lost on remote update; cursor jumps to a different location
- **Drawing**: object selection survives. Mid-drag survives most changes, but deleting the dragged object deletes underneath the cursor with console warnings
- **Geometry**: dialog closes out from under the user on remote change; point drag cancels and snaps back

Outcome: real disruption exists in several tiles, but not at a level that justifies the cost of tile locking (GD-8). The path forward is per-tile hardening (GD-11) as those tiles surface concrete user pain, with GD-8 held in reserve.
