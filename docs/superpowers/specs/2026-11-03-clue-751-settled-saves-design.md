# CLUE-751: Save documents only when their history is settled

Status: built in PR #3086. Designed 2026-11-03, and updated 2026-11-10 to describe what was built,
including the changes made in review.

This is GD-18 from the group documents plan. The group-document reasoning (why saves must reflect
canonical state, the stale-check and jitter protocol, and the worked scenarios) was in the GD-18
design, `docs/group-docs/settled-state-doc-saves-design.md`, which this PR retires; it is in the
repository history before this PR. This spec covers what CLUE-751 builds, which goes further than
that design: it covers individual documents
too, saves the snapshot taken when each entry completes, and replaces the content-save sender.

"Individual document" means any document that isn't `concurrent`: problem, personal, learning-log
and other single-owner documents. "Group document" means a `concurrent` document.

## Why

Each content save to RTDB is stamped with `lastHistoryEntryId`. Today that id is only an estimate:

- The save hook ([use-document-sync-to-firebase.ts](../../../src/hooks/use-document-sync-to-firebase.ts))
  saves on every `onSnapshot`, including snapshots taken partway through an entry (flows such as the
  Drawing tile's `rotateMaybeCopy`, and shared-model exchanges). It stamps the latest entry that existed
  when the snapshot was taken, so the content can be ahead of its id.
- On a group document, a client can save a state that isn't canonical, for example while a local
  entry is waiting to be rolled back.
- The content can name an entry that hasn't reached Firestore yet, or never will if the tab closes.
- The content can be behind its history: entries upload, and the tab closes before the save that
  covers them.

Other work needs the id to be exact:

- **CLUE-760** (background entries) saves DataFlow ticks less often, which widens the gap between the
  content and its history. Playback assumes the content includes every entry in Firestore, and
  scrubbing back from content that is behind its history fails.
- **CLUE-773** (history migrations) leaves two things to this story: making the id exact so a later
  story can start playback from it, and the window where converted content is saved before its
  conversion entry is written.
- **GD-19** (transaction-free history) assumes the saved content is canonical state at a known
  position.
- **The activity recorder** (CLUE-693) waits up to 30 seconds for a save that covers each change, and
  #3050 added per-snapshot bookkeeping to the save hook to keep the estimate from getting ahead of the
  content.

Doug's [save-ordering write-up](https://gist.github.com/dougmartin/87adb69f3ed49b02bd53b0a1f11eaf5f)
found more problems in how saves are sent:

- a retried save overtaking a newer one, so RTDB ends with older content
- `onSuccess` arriving out of order, because each save also waits on a Firestore `tools` update
- the retries never giving up, so `onError` and `SaveState.Retrying` never fire
- the `onSnapshot` effect re-subscribing on every render, because `mutation` is in its dependencies
- an unstamped save after a reload leaving RTDB's old id in place

## Goals

- **An exact save's content is the document's state at its `lastHistoryEntryId`, and that entry is
  already in Firestore.** Individual and group documents both.
- **Every save says whether it is exact, and from where history recreates it.**
- **Exact saves keep coming while entries complete faster than they upload**, such as a DataFlow
  program at 20 Hz, on individual and group documents.
- **An individual document's content keeps being saved even when its history can't settle.**
- **An individual document loaded behind its history catches up when it is opened for editing.**
- **Playback opens at the newest entry, with content that holds it**, for a teacher's or other
  viewer's copy of an individual document too.
- **A tree-manager exchange can't hold an entry open forever.**
- **Saves are sent one at a time, always newest-wins, with visible failure.**
- **Group documents make fewer redundant saves**, per the GD-18 design.

## Non-goals

- **Repairing drift.** CLUE-751 detects content that history can't recreate, marks it, and logs it.
  Recording drift entries that repair history is section 2 of
  [CLUE-788](https://concord-consortium.atlassian.net/browse/CLUE-788).
- **The order of entries that complete out of order.** CLUE-788 section 1.
- **One save and load mechanism for every document.** CLUE-788 section 3. CLUE-751 writes its rules
  so they carry over (section 2 below).
- **The race in the group-document upload path.** See "Known gaps". It is left to GD-19.
- **Timing out running MST flows, and a keep-alive API.** Only tree-manager exchanges time out
  (section 4).
- **Ordered retries of failed individual-document uploads.** See "Known gaps".
- **Background-only save rates and the indicator rule for them.** CLUE-760 adds those on top of the
  new sender.
- **The metadata hooks.** `useSyncMstPropToFirebase` (visibility, title) and `useSyncMstNodeToFirebase`
  (properties) keep using react-query. They don't involve history.
- **Read-only viewers replaying history.** The GD-18 design listed this as follow-up work, but a
  teacher's view of a group document already follows history: `documents.add` gives every `concurrent`
  document a history manager with `syncRemoteHistory: true`, read-only or not
  ([documents.ts](../../../src/models/stores/documents.ts)), and the RTDB content listener doesn't watch
  group documents ([db-docs-content-listener.ts](../../../src/lib/db-listeners/db-docs-content-listener.ts)).

## Anti-goals

- **A save marked exact must never hold content its id doesn't describe.** When in doubt, a save is
  not marked.
- **A group document never saves content from a local entry that isn't canonical yet.** Not even as
  a fallback. Other members save in its place, and history holds every canonical entry, so the
  document can be rebuilt by replaying from the last save.
- **A timed-out entry must not surprise the user.** Nothing they see changes.
- **No regression in lost work on individual documents.** Content keeps reaching RTDB even when
  history can't settle or Firestore is unavailable.

## Design

### 1. The envelope and what "exact" means

**Exact.** A document's state is exact at entry X when replaying its history recreates it: the
starting content plus the recorded entries through X, and nothing else. A change no entry records
(for example one made before monitoring is enabled, or a fixup that isn't an action) stays in every
later state, so once it happens the rest of the session is not exact.

**Where the guarantee starts.** Exactness only reaches back as far as the content it started from.
A session that loads content which wasn't exact can still save states that are exact relative to
what it loaded, but replaying older history won't recreate them. So each exact save also records the
point the guarantee starts from.

The RTDB content envelope (`DBDocument` in [db-types.ts](../../../src/lib/db-types.ts)) gets these
optional fields next to `lastHistoryEntryId`:

- **`exactThrough: { id, index, contentHash, since }`** on an exact save, written in the same
  `update()` as the content.
  - `id` is the stamped entry, and `index` its `index` in Firestore. Group documents use the index for
    the stale-check (section 2), and individual documents use it to fetch only the entries a load is
    missing (section 3).
  - `since` is the entry from which history recreates the content. Replaying from the state at `since`
    through `id` gives exactly the saved content. It is carried forward from session to session while
    each load is exact (section 3), and restarts at the loaded id when it isn't. For a document with
    no history before the session, it is `"first"`, the start of history.
  - `contentHash` is `hashString` of the content string.

  A client that hasn't reloaded since the deploy saves with `update()` of only `content`,
  `changeCount` and `lastHistoryEntryId`, so it leaves an `exactThrough` in place next to its own id
  and content. A reader therefore trusts `exactThrough` only while `id` is the envelope's
  `lastHistoryEntryId` and `contentHash` matches the stored content (`readSavedEnvelope`). Binding to
  the id alone isn't enough: such a client can stamp the same id with content that is ahead of it.
  Envelopes saved before this change, and envelopes whose `exactThrough` doesn't match, are treated the
  same as intermediate saves. One object also means the evidence can't be half stale.
- **`notExact`** on an intermediate save (section 6), holding evidence for debugging:
  - the open entries: each one's id, model, action, the names of its open exchanges (the tree manager
    already stores names like `"recordAction.sharedModelChanges"`), and when it opened
  - running tracked flows that have changed state, with their action names
  - the ids of completed entries that haven't committed
  - why the session stopped being exact, if it did
  - when the stretch with unsaved changes and no exact save began

The save uses `update()`, which merges fields, so each save clears the other kind's field: an exact
save writes `notExact: null`, and an intermediate save writes `exactThrough: null`.

**Every save is stamped.** An intermediate save stamps the last entry from this session that has
committed, or, when none has, the last entry the load caught up to, or else the loaded envelope's id. So every id ever written is in Firestore, and
is a lower bound on what the content holds.

**What readers can rely on:**

| Reader asks | Uses |
|---|---|
| "Is entry X saved?" (activity recorder, drift check, CLUE-773's conversion entry order) | `lastHistoryEntryId` from any save. It is always a lower bound. |
| "Is the content exactly the state at X?" (playback start, group-document load, GD-19's `tips`) | `lastHistoryEntryId` only when `exactThrough` is trusted, and only back to its `since`. Otherwise fall back as for an old envelope. |

### 2. Snapshot saving

Saving follows one rule for every document, implemented once in the sender (section 5):

> The content snapshot taken when entry X completes is exact once X is committed, provided no other
> writer's entry was applied between X completing and X committing, and the session was still exact
> when X completed.

**Snapshots.** A content snapshot is captured when each history entry completes
(`completeHistoryEntry` in [tree-manager.ts](../../../src/models/history/tree-manager.ts)). MST
snapshots share structure, so this is cheap. The snapshot taken at X can't be used if, when X
completed:

- another tree-manager entry that could hold changes was open (its patches may be in the snapshot).
  An entry that has recorded nothing and waits only for the empty records of calls that changed
  nothing doesn't count: it is dropped when it closes. The tree monitor knows a call's patches when
  the call finishes, before its record reaches the manager. Many calls open such an entry briefly,
  such as the setup calls of a tile that was just added; counting them left an added tile on an
  intermediate save. Or
- a tracked MST flow was running and had changed state. The tree monitor records a flow as one action
  and creates its entry only at `flow_return`, so a running flow has no entry in
  `activeHistoryEntries`; the check has to look at the tree monitor's running calls. A flow that hasn't
  changed state doesn't count. Or
- a pending CLUE-773 load entry hadn't been added to history yet.

A snapshot skipped for one of these reasons is covered by the next usable one.

**Committed.** Each history manager reports commits in order to the sender:

- **Individual documents** upload each entry with its own `docRef.set` in `onHistoryEntryCompleted`
  ([firestore-history-manager.ts](../../../src/models/history/firestore-history-manager.ts)). X is
  committed when X and every earlier entry from this session have uploaded. The manager exposes that
  prefix as something the sender can react to.
- **Group documents** commit when the upload transaction succeeds
  ([firestore-history-manager-concurrent.ts](../../../src/models/history/firestore-history-manager-concurrent.ts)).
  A transaction commits up to 20 entries at once; the newest usable snapshot among them is the one
  saved. The concurrent manager also reports when another writer's entry is applied, or a fork
  rollback or merge happens; that voids the snapshots of every local entry not yet committed. With the
  transaction, a remote entry arriving after X completed changes the head and aborts X's upload, and
  a remote entry that arrived before X completed is already in X's snapshot.

The snapshot reflects X even when later entries have completed since, so a DataFlow program ticking
faster than its uploads still gets exact saves, each one upload behind. This holds on group documents
too, where a lone runner otherwise never settles and has no idle member to save in its place.

Snapshots are kept only until a newer one is saved, or are voided. While entries wait to commit, the
newest snapshot is kept, and of the older ones only those taken at least the minimum save gap (1
second) after the one kept before them, up to 10 in all. Saves are written no closer together than
that gap, so most of the dropped snapshots would never have been written. A commit saves the newest
snapshot kept among its entries, which is still exact and at most about a second older. When commits
fall further behind than the cap reaches, an individual document falls back to intermediate saves and
a group document waits for the commits to catch up or for its settled save.

**Group documents also save the current state when settled.** An idle member has no local entries,
so it saves the current content when settled, per the GD-18 definition: nothing in
`completedHistoryEntryQueue`, no upload in flight, no apply in progress, nothing in
`pendingDownloadBuffer`, no entry open, no running flow that has changed state, and a session that is
still exact. That save is
stamped with `expectedRemoteHead`, the last canonical entry. It is not stamped with the last entry in
local history, because after a fork rollback that is a revert entry, which is local-only and would
trip the drift check on the next load. These fields aren't MobX-observable today; making them
observable is part of this work.

**Group stale-check and jitter.** Before any group save, compare the save's chain index with the
index in the envelope's `exactThrough`. If the envelope is at or past it, skip. Otherwise wait a random
0–200 ms, re-check, and save. Local history can't order two ids (entries before the load point aren't
in it), which is why the index is stored. An envelope whose `exactThrough` doesn't name its
`lastHistoryEntryId` is treated as behind. GD-19
replaces the single id and index with `tips`. A committing writer learns of its commit before the
others receive the entry, so it usually saves first and the idle members skip.

**A new envelope listener for group documents.** The GD-18 design assumed an existing RTDB listener
covered the envelope's id. None does for group documents. Add one that listens only to the envelope's
`lastHistoryEntryId` and `exactThrough` children, not the content. Without the content it can't check
the hash, so it checks only that `exactThrough` names the id. A mismatch it can't see makes a member
skip a save it would have made, and the next load still checks the hash.

### 3. Loading

**Individual documents catch up when opened for editing.** If the envelope has a trusted `exactThrough`
and its id isn't Firestore's last entry for the document, the entries after it are applied, as group
documents already do at load. This restores edits that reached history but not the content, so the
user sees their last few seconds of work come back, and it keeps the next entry's `previousEntryId`
and the content in agreement.

Only an envelope with a trusted `exactThrough` is caught up. An unmarked envelope's id is only a lower bound: an
intermediate save's content can already hold entries that hadn't committed when it was stamped, and
older envelopes under-claim the same way. Applying the entries after that id could apply some of them
twice. So an unmarked envelope whose id isn't the last entry opens with the content as saved, the
session is not exact, and the gap is logged.

The catch-up runs only for documents the current user owns, and not for publications. Only the owner
edits and saves an individual document, so other viewers (teachers, other students, exemplars) open
without waiting.

It runs when the owner opens the document for editing, not when the document is loaded. The
other-documents listener loads every personal document and learning log when the app starts, so a
catch-up at load would query Firestore for each one. An owned document is loaded marked as not
caught up, and its catch-up starts when it is opened for editing, or before tiles are copied into it.
While it isn't caught up, its toolbar keeps the tools that don't change it (Edit among them), so it can
still be viewed and opened for editing.

A document this session created skips the catch-up. Its history in Firestore is still empty, so it
opens caught up and exact from the beginning of its history (`since: "first"`). Without this, every
new document showed the spinner for the Firestore query that finds its last entry, and the tools that
copy tiles into it ignored clicks meanwhile.

While a document isn't open for editing, the RTDB content listener can replace its content with what
the RTDB holds. It records the envelope that content came from in the document's `savedEnvelope`, and
the catch-up starts from that envelope rather than the one first loaded.

As soon as the sender starts after a catch-up that applied entries, it saves the caught-up content,
stamped with the last entry applied, unless an entry has committed since or a snapshot couldn't be
used then. Otherwise the RTDB content would stay behind its history until the next edit committed,
and the content listener would bring that older content back once the document closed.

The catch-up never loads the whole history. DataFlow and Simulator documents can have very large
histories, and today an individual load reads only the last entry (`getLastHistoryEntry`, a
`limit(1)` query on `index` descending, via `getFirestoreHistoryInfo`). The catch-up keeps it that
way:

1. **Nothing to catch up.** When the envelope's `lastHistoryEntryId` is the last entry, there are no
   extra reads. This is the common case.
2. **The saved entry's index.** It comes from the envelope's `exactThrough`. Envelopes saved before
   this change have no `exactThrough`, so they are never caught up and need no index.
3. **The cap.** The gap's size, the last entry's index minus the saved index, is known before anything
   is fetched. A gap of more than 200 entries isn't fetched: the document opens with the content as
   saved, the session is not exact, and the gap size is logged. A usual gap is the last few seconds of
   edits before a tab closed; with CLUE-760's 3-second background saves and a DataFlow program at
   20 Hz that is about 60 entries. Gaps beyond the cap come from content saves failing for a long time
   while uploads succeed.
4. **The fetch.** Only the gap is fetched:
   `where("index", ">", savedIndex).where("index", "<=", lastIndex).orderBy("index")`. Both range
   filters are on the same field, so this uses the single-field index that the existing
   `orderBy("index")` queries use, and no new Firestore index is needed.
5. **A complete gap.** The fetched indexes must run without holes, and each entry's `previousEntryId`
   must be the entry before it. A hole means an upload failed for good. Entries up to the hole are
   applied, and the session is not exact.
6. **A saved id that isn't in Firestore** gets no catch-up, and the session is not exact. With
   nothing to fetch, a saved id other than the last entry can't be in Firestore. Otherwise the first
   fetched entry's `previousEntryId` doesn't name it, which is a hole.

Opening the document for editing waits for the catch-up: one more query.
Applying entries after the user has started editing would collide with their new entries, so a
document opened for editing shows a spinner in place of its toolbar and content until the catch-up
finishes, and its 4-up corner stays read-only. Showing the document read-only meanwhile would leave a
toolbar that ignores clicks. A gap over the cap doesn't wait.

If an entry fails to apply, the document opens with what applied, and the session is not exact. The
failure is logged.

**Playback of content behind its history.** Playback builds its copy from the live document and
used to assume that content held every entry in Firestore. A viewer's copy is never caught up, and
neither is the owner's before it is opened for editing, so scrubbing back undid entries the content
never had. Now the playback copy starts where the live document's content actually is, and is moved
forward to the newest entry before the history viewer shows its controls, so a teacher opening it
sees the student's latest state. The content's position is:

- after the last entry the catch-up applied, while the content is still the one the catch-up started
  from;
- otherwise after the envelope's entry, when the envelope has a trusted `exactThrough`;
- otherwise unknown, and playback assumes the newest entry, as before. That covers an unmarked
  envelope, group documents, which follow their history live, and a document this session has
  recorded entries in.

If an entry fails to apply on the way forward, playback opens at the last position it reached, with
the failure marked as for any other move. While the copy moves forward, the history viewer says it is
loading the latest changes.

**Whether a load is exact.** A load is exact when the envelope had a trusted `exactThrough` and any
missing entries applied cleanly. Then its `since` carries forward. An unmarked envelope at Firestore's last
entry starts the session's exact saves at the loaded id. An unmarked envelope with a gap leaves the
session not exact.

**The group-document initial load.** The FIXME at `getInitialLastHistoryEntry` in
`firestore-history-manager-concurrent.ts` describes a race: the content and
`metadata.lastHistoryEntry` are fetched separately, so an entry committed between the two fetches is
mishandled. When the loaded envelope has a trusted `exactThrough`, the initial load takes its starting
point from the envelope's `lastHistoryEntryId` and applies only the entries after it. Unmarked envelopes keep
today's behavior. Remove the FIXME comment.

**The CLUE-773 overlap.** CLUE-773 converts old tiles at load and holds the load entry that records
the conversion in the tree manager's `pendingLoadEntry` until the first entry that changes the
content completes. Until then the content is converted but history doesn't have the entry, so no
snapshot is usable (section 2) and an unmount flush or intermediate save stamps the loaded id
without `exactThrough`. CLUE-773 landed first, so CLUE-751 adds this condition as a snapshot blocker.
Waiting for commits also closes the window CLUE-773 left: content stamped
at or after the conversion entry isn't saved until that entry is in Firestore. CLUE-773 converts only
individual documents; snapshot pre-processor changes on group documents, and other pre-processor
changes on any document, are not detected (see "Known gaps").

**Catching up converted content.** The entries a load is missing were recorded against the stored
format, so they can't be applied to converted content. When the load converted old models, or a
missing entry is a load entry, the catch-up applies them to the stored JSON instead: it undoes the
pending load entry, applies the entries as JSON patches, each all or nothing, and sets the result as
the content, which converts it again and rebuilds the pending load entry. A load entry among the
missing entries is applied like any other: it is one a session made at load and uploaded with the
edit after it, before its content save failed. Entries after it are in the current format, and the
result needs no conversion.

### 4. Open-entry timeout

A tree-manager entry whose exchanges stay open for **30 seconds** is force-completed:

- its open exchanges are closed, and it joins history with the records it has
- it is marked `timedOut: true`
- an event is logged, and a console error is printed
- the user sees nothing change
- if a stuck exchange reports in later, its records become a new entry instead of throwing "There
  isn't an active entry"

Its exchanges may already have changed the content without recording it, so the rest of the session
is not exact (section 1). The timeout's value is that the entry's recorded changes reach history and
Firestore, later entries are no longer blocked behind it, and the log shows the stuck exchange.

Running MST flows don't time out: force-completing one would mean splitting its recorded changes
partway through. A flow that never returns leaves the session on intermediate saves, and the
`notExact` evidence names it. No keep-alive is needed, since no known exchange legitimately stays
open for 30 seconds.

Force-completing was chosen over reverting the entry's patches. Reverting could break later entries
built on its changes, couldn't undo changes that were applied but never recorded, and would change
what the user sees.

### 5. The sender

The react-query mutation and lodash throttle are replaced by a plain class per document, outside
React. The hook only creates it and hands it the document. It holds the snapshot and exactness logic
from sections 1–2 for both kinds of document; the history managers supply the signals.

- **Triggered by commits and the settled state,** through MobX reactions, not by `onSnapshot`.
- **One write in flight at a time,** except on page hide and at the end of the drain, which don't
  wait. When it finishes, the sender sends whatever is newest by then.
- **A retry re-reads the newest state.** It never resends an older one.
- **The RTDB write alone decides success.** The Firestore `tools` update goes out separately,
  only when the list of tile types changes.
- **Failures back off and eventually show `SaveState.Retrying`.**
- **Minimum gap between saves: 1 second,** as today's throttle. A save is sent as soon as allowed,
  and anything newer during the gap goes out at its end. The gap is set per save by the caller, so
  CLUE-760 can choose 3 seconds for background-only changes without reworking the sender.
- **`setLastEditedOnDisconnect` and the presence handling stay as they are.**
- **#3050's per-snapshot id bookkeeping goes away** (`snapshotIdsRef`, `stampedIdsRef`,
  `latestSnapshotRef`).

**Lifetime.** When the hook unmounts, the sender keeps going until an exact save covers the latest
change, or **30 seconds** pass. Then, on an individual document, it makes an intermediate save if the
latest change isn't saved, and stops. This gives CLUE-760's flush on the way out, and gives a group
document its last save after the upload queue drains in the background.

**Page hide.** On `pagehide`, an individual document sends its newest usable committed snapshot right
away, skipping the minimum gap. It doesn't make an intermediate save while its saves are exact:
entries still uploading are likely lost with the tab, and if they do land, the next load catches up
from that exact envelope (section 3). When the document already relies on intermediate saves (a
fallback episode is open, the session isn't exact, or the envelope the RTDB holds has no
`exactThrough`, or there is none) and the latest change isn't covered, it sends an intermediate save
right away instead, so a tab closed during a Firestore outage loses nothing the 5-second cadence
hadn't sent yet. The next load can't catch up from an envelope without `exactThrough`, so an
intermediate save over it loses nothing. The sender listens for `pagehide` itself, so a tab closed
while the sender drains after unmount still gets this save.

When the hook unmounts, the last-edited time (and the session-end evaluation request it triggers)
is set when the sender finishes, not at unmount, so the evaluation reads the final content.

**The save indicator.**

- `Saving` while the latest local change isn't in a completed save.
- `Saved` when a completed save (exact or intermediate) contains it. On a group document that
  includes a save by another member, seen through the envelope listener.
- `Retrying` after the backoff above.

### 6. Intermediate saves

Intermediate saves are for a document known to have a single writer: nobody else can save in its
place, so without them work is lost. A group document can't know it has one active writer today
(there is no presence tracking), so only individual documents qualify. A group document never makes
one (see Anti-goals).

When a qualifying document has had unsaved changes and no exact save for **5 seconds**, the sender
saves the current content, stamped as section 1 describes, with the `notExact` evidence. It
repeats at most every 5 seconds while that lasts. This covers a running flow or a stuck exchange, an
upload that has stalled, Firestore being unavailable, and a session that is no longer exact.

**Logging.** Each fallback episode is logged: once when it starts (`CONTENT_SAVE_FALLBACK_START`),
with the `notExact` evidence, and once when the next exact save ends it (`CONTENT_SAVE_FALLBACK_END`),
with its duration and number of intermediate saves. An episode in a session that is no longer exact
ends when the session does. The evidence in the envelope only lasts until the next exact save, so the
log is the lasting record for metrics and debugging.

### 7. The activity recorder

- It keeps receiving `onContentSaved` with the stamped id, from exact and intermediate saves. The id
  is a lower bound, which is all it needs.
- On group documents it also learns about saves from the envelope listener. The stale-check means an
  active editor often skips its save because another member made it, and without this the editor's
  recorder would fall back to the 30-second timeout for every change.
- The 30-second timeout and the `pagehide` recording stay as a backstop.

### 8. A group document that stops saving

A group document makes no intermediate saves, so once its session isn't exact this client saves no
more content. Other members who are still exact keep saving, but a member working alone sees `Saving`
for the rest of the session. Logs aren't watched routinely, so the user is told, and a report is how
these bugs come to light. The sender logs `CONTENT_SAVE_GROUP_STOPPED` with the reason once per
session, and the document shows a notice over its content and toolbar, with the reason as a code for
reports. Every reason is a bug, so the notice shouldn't come up often.

Reloading starts a new session, which is exact when its load applies cleanly, and its first settled
check saves the head. Closing and reopening the document doesn't, since the document model stays in
the store. The notice depends on what the user would see and whether reloading helps:

| Reason | What breaks | Notice |
|---|---|---|
| An entry stayed open for 30 seconds (`timed-out-entry`) | Nothing visible: the entry's records reach history, and a late record becomes a new entry. | Can be closed; suggests reloading. |
| A change with no entry (`unrecorded-change`) | The change is only on this screen. Later entries that build on it can fail to apply at load, for every member. | Can't be closed, and the document is read-only; asks for a reload. A second one for the same document in the same tab within 10 minutes (`sessionStorage`) means the reload didn't help, so it asks the user to tell their teacher instead. |
| An entry fails to apply at load (`initial-apply-failed`) | Every load fails the same way, and edits made now chain after the failing entry. | Can't be closed; asks the user to tell their teacher. |
| Another member's entry fails to apply (`remote-apply-failed`) | This screen is missing the entry. A reload helps when this tab's own changes caused the failure; otherwise the reload ends in `initial-apply-failed`. | Can't be closed; asks for a reload. |
| The saved content is at an entry the history doesn't have (`saved-id-missing`) | The document looks right, but no load is exact, so no member saves again. It takes another writer. | Can be closed; asks the user to tell their teacher. |

A notice that can't be closed makes the document under it inert. A failed apply marks the session not
exact before the history manager's `applying` flag clears, since the sender checks for a settled save
as soon as it does.

Closing the document and reopening it automatically, in place of a reload, would need changes beyond
the document's own components (the documents store, the workspace and the listeners), so it isn't
attempted.

### Known gaps

- **The group upload race.** After an upload transaction commits, another client's entry chained
  after ours can reach the listener before the transaction promise resolves. `detectAndResolveFork`
  then sees our committed entries still in `completedHistoryEntryQueue` and can roll them back, and the
  success path's `splice(0, entriesToUpload.length)` can remove entries queued after the upload began,
  which are never uploaded. A client can then look settled while holding a non-canonical state. The
  window is narrow and group documents have no real users yet. GD-19 removes it: a local entry leaves
  `pendingLocal` only when its own echo arrives, and there is no transaction promise or splice.
  CLUE-751 adds the race to GD-22's list in the plan instead of fixing it.
- **Undetected drift.** Snapshot pre-processor changes at load that aren't CLUE-773 conversions, and
  all pre-processor changes on group documents, aren't detected, so `exactThrough.since` can carry
  forward across them. Changes after monitoring starts that produce no entry are detected only where
  the tree monitor's check catches them (see "Choices made in building"). CLUE-788 section 2 covers recording all of
  these as drift entries.
- **Changes made while monitoring is off.** Changes made after the load but before the hook enables
  history monitoring (mount-time fixups, such as a tile syncing to a shared model), fixups made while
  the load catch-up runs (the document is read-only then, so monitoring is off), and changes made
  while the sender drains after unmount are not detected. Such a change can sit inside an exact
  save. A detector would also flag load-time fixups and leave those documents never exact, so
  CLUE-788's drift entries are the fix. Blocking code-driven changes during the catch-up isn't
  attempted: CLUE has no model-level lock, and blocking tile fixups needs an understanding of all of
  them first. What to do with changes during the drain is an open question in CLUE-788.
- **Patches made outside an action while a flow is suspended.** The tree monitor doesn't flag them,
  since the suspended flow counts as tracked. MST protection should make them impossible, so one
  would be an error, not drift. CLUE-788 records the investigation.
- **A remote entry that always fails to apply.** A group client whose remote apply failed stops
  saving content, logs `HISTORY_REMOTE_APPLY_FAILED` and shows its notice (section 8). If the failing
  entry is in the chain, every member that loads fails on it, no member saves content again, and each
  later load shows content missing everything after it. Group documents aren't widely used yet, so
  this stays strict: no content that isn't exact is saved to get past it. The notices and the log show
  whether it happens. Applying entries one at a time and skipping a failing one, or saving the settled
  state stamped with the remote head after a failure, are the options if it does.
- **Saved content at an entry the history doesn't have.** Every later session's load is not exact, so
  no member saves content again. A repair, such as a member whose load applied cleanly saving its
  content stamped with the remote head, is recorded in the group-docs implementation todos.
- **The group initial load from an unmarked envelope.** The content and Firestore's last entry are
  read separately, so an entry committed between the two reads is skipped, and that session's saves
  are still marked exact. A load from an envelope with a trusted `exactThrough` doesn't have this. Marking unmarked
  group loads not exact instead would stop every existing group document from saving, since group
  documents make no intermediate saves. GD-22's list in the group-docs plan records it.
- **Individual uploads that fail for good.** The Firestore SDK retries transient write failures
  itself, so a `set` that hasn't resolved is usually just waiting. A write that fails for good, or a
  session where `waitForMetadataDocument` times out and nothing uploads, stops the committed prefix for
  the rest of the session. That session saves only through intermediate saves, and the fallback log
  shows it.

### Docs in the same PR

- Add a GD-18 section to [group-docs-completed-work.md](../../group-docs/group-docs-completed-work.md),
  in the style of its GD-6 section: the PR and CLUE-751 in the heading, what landed described on its
  own terms, and links to the code. It doesn't link to this spec. What CLUE-751 left out goes in
  group-docs-plan.md (GD-22's upload race) and in the docs CLUE-788 writes, not in a link to here.
- Mark GD-18 done in [group-docs-plan.md](../../group-docs/group-docs-plan.md) and the folder
  [README](../../group-docs/README.md). Add the upload race to GD-22.
- Update [group-docs-current-state.md](../../group-docs/group-docs-current-state.md) where it describes
  saves.
- Retire `settled-state-doc-saves-design.md`, and fix the links to it from
  [transaction-free-history-design.md](../../group-docs/transaction-free-history-design.md) and
  [background-entries-design.md](../../group-docs/background-entries-design.md).
- Update [group-docs-classroom-readiness.md](../../group-docs/group-docs-classroom-readiness.md),
  [group-docs-jira-mapping.md](../../group-docs/group-docs-jira-mapping.md), and
  [group-docs-implementation-todos.md](../../group-docs/group-docs-implementation-todos.md) (remote
  entries that fail to apply, and saved content at an entry the history doesn't have).
- Describe the catch-up and the envelope's id in [history-framework.md](../../history-framework.md),
  and the envelope fields in [metadata-fields.md](../../document-metadata/metadata-fields.md).

The work CLUE-751 leaves for later (out-of-order entries, drift entries, one mechanism for every
document) is written up by CLUE-788.

## Related work

- **CLUE-760** (background entries): lands after CLUE-751 and adds its 3-second rate and indicator
  rule to the new sender. A tick-only save is a save of a settled state, because ticks are synchronous.
- **CLUE-773** (history migrations): landed first. Overlaps at the pending load entry and the load
  catch-up of converted content (section 3).
- **CLUE-788**: out-of-order entries, drift entries, and one mechanism for every document.
- **GD-19 / GD-22**: retire the upload race. GD-19 also reimplements the concurrent manager's commit
  and void signals (commit becomes the entry's echo).
- **CLUE-693 / #3050**: the activity recorder and the per-snapshot bookkeeping this replaces.

## Decided

- Every document saves when settled and gets an exact id.
- One snapshot rule for all documents: the snapshot taken when an entry completes is saved once that
  entry commits, if no other writer's entry was applied in between. Implemented once in the sender;
  each history manager supplies commit and void signals. CLUE-751 implements it for group documents
  too.
- Group documents also save the current state when an idle member settles, with the GD-18 stale-check
  and jitter.
- Exact saves write `exactThrough`, bound to the envelope's id and a hash of its content, so a save by
  a client that doesn't know the field can't leave a stale mark behind. Intermediate saves carry
  `notExact` evidence instead.
- Content saves wait for commits (rather than readers waiting for the entry to appear).
- Intermediate saves are for documents known to have a single writer, which today means individual
  documents only.
- Individual documents apply missing entries when the owner opens them for editing, only from an
  envelope with a trusted `exactThrough`; a failure leaves the session not exact. The caught-up
  content is saved as soon as the sender starts.
- Playback starts its copy where the live document's content is and moves it forward to the newest
  entry before showing the slider, so a viewer of content behind its history sees the latest state.
- The catch-up fetches only the missing entries, using `exactThrough`'s index. A gap of more than 200
  entries isn't fetched, and the session is not exact.
- A group document whose session stops being exact shows a notice over the document, chosen by the
  reason (section 8).
- Running flows that have changed state count as open. Only tree-manager exchanges time out, and
  are force-completed. No keep-alive.
- Every fallback episode is logged.
- The sender is replaced, without react-query, as a class outside React that outlives the hook until
  the document is saved.
- CLUE-751 lands before CLUE-760.
- The upload race is a known gap left to GD-19. Drift repair is left to CLUE-788.
- The group-docs folder is updated in this PR, and the GD-18 design is retired.
- The document keeps two envelopes. `loadedEnvelope` is the one its content was loaded with, set once
  and never changed, which the drift check and the group-document load read. This keeps CLUE-693's
  decision that the loaded id isn't changed by this client's saves, and lets the history manager read
  it whenever it is built. `savedEnvelope` is the RTDB envelope as this client knows it, updated by its
  saves and by the content listener; the catch-up, the sender and playback read it, and a sender made
  later for the same document starts from it. `savedLastHistoryEntryId` is removed.

## My calls (check these)

- Timings: 1-second minimum gap, 30-second open-entry timeout, 5-second intermediate save interval,
  0–200 ms jitter, 30-second limit after unmount.
- A timed-out entry is marked `timedOut: true`, and makes the rest of the session not exact.
- The `tools` update goes out only when the list of tile types changes.
- On `pagehide`, an individual document sends its newest usable committed snapshot, and makes an
  intermediate save only when it already relies on them.
- The save indicator rules in section 5.
- The activity recorder keeps its 30-second timeout and `pagehide` recording as a backstop.
- Group saves are stamped with `expectedRemoteHead` (settled saves) or the committed entry (snapshot
  saves), and write the index in `exactThrough` for the stale-check.
- An intermediate save with nothing committed this session stamps the last entry the load caught up
  to, or else the loaded envelope's id.
- A failed apply at load opens the document with what applied.
- The group-document initial load starts from an exact envelope's id.
- The notices' wording, and the 10-minute window for a repeated unrecorded change.
- Upload failures that never recover leave the session on intermediate saves; no ordered retry.

## Choices made in building

These were left to the builder in the design.

- The tree monitor detects a change made after monitoring starts that produced no entry with an
  `onPatch` listener that fires while no tracked call is running. It reports a running flow that has
  changed state through its running calls, and a call that has finished but whose record hasn't
  reached the manager yet through `hasCallWithUnrecordedChanges` and `isFinishedCallExchange`.
- The history managers expose commits and voids through `ICommitSource` and `ICommitListener`
  ([history-commits.ts](../../../src/models/history/history-commits.ts)).
- "From the beginning of history" is `since: "first"` (`kHistoryStart`).
- The log events are `HISTORY_ENTRY_TIMED_OUT`, `HISTORY_LOAD_CATCH_UP_INCOMPLETE`,
  `HISTORY_REMOTE_APPLY_FAILED`, `CONTENT_SAVE_FALLBACK_START`, `CONTENT_SAVE_FALLBACK_END` and
  `CONTENT_SAVE_GROUP_STOPPED`.
- Retries wait 1 second, doubling to at most 30 seconds, and the indicator shows `Retrying` from the
  third consecutive failure. A successful write starts the count again.

## Testing

- **Snapshot saving (individual):** a save holds the snapshot taken at its stamped entry, writes
  `exactThrough` with its index, `since` and content hash, and is sent only after that entry and every
  earlier one have uploaded. Entries completing faster than uploads still produce exact saves. A
  snapshot taken while another entry was open, while an open entry had recorded changes, or while a
  flow that changed state was running, is skipped. A flow or call that changed nothing doesn't block.
  A pending conversion entry blocks exact saves.
- **Snapshot saving (group):** a committed transaction saves the newest usable snapshot among its
  entries, and a transaction Firestore reruns reports each entry once, with the index of the attempt
  that commits. A remote entry applied, a rollback or a merge voids uncommitted snapshots. A lone
  runner ticking faster than its uploads still produces exact saves.
- **Settled saves (group):** an idle member saves the current state when settled, stamped with
  `expectedRemoteHead`. No save while the queue is non-empty, an upload is in flight, or an apply is
  running, and a settled save doesn't replace a commit's save at the same index. A rolled-back local
  entry is never saved. The stale-check skips a save when the envelope's index is at or past it, and
  counts an envelope whose `exactThrough` names another id as behind.
- **Exactness:** a change with no entry after monitoring starts makes later saves not exact. A
  finished call counts as unrecorded changes until its record reaches the manager, or its record
  returns early. `since` carries forward across an exact load and restarts after an unmarked one. A
  failed group apply is not exact before `applying` clears.
- **Envelope fields:** an exact save clears `notExact`, an intermediate save clears `exactThrough`, and
  every save is stamped with an id that is in Firestore. A reader drops `exactThrough` after a save
  that stamped another id, or another content string, over it.
- **Load (individual):** the catch-up starts only when it is asked for, once, and from the envelope
  it is given. An exact envelope behind Firestore applies the missing entries and keeps `since`; an
  unmarked envelope behind Firestore applies nothing and is not exact; a failed apply opens with what
  applied and is not exact, and an error thrown while applying counts as an apply failure. Only the gap
  is fetched, bounded by the last entry, and nothing is fetched when the envelope is at the last entry.
  A document this session created opens caught up and exact from the start, without a catch-up.
  A gap over 200 entries isn't fetched, is logged, and leaves the session not exact. A hole in the
  indexes or a broken `previousEntryId` chain stops the apply at the hole. A user who turns out not to
  be the owner gets no catch-up. The sender saves the caught-up content when it starts.
- **Load of converted content:** the missing entries are applied to the stored JSON when the load
  converted old models, or when the gap holds a load entry even though the load converted nothing.
- **Initial load (group):** an exact envelope's id sets where remote entries start applying.
- **Playback start:** a copy whose content is behind the newest entry starts at the content's
  position and is moved to the newest entry before the history counts as loaded; an entry that fails
  leaves it at the last position reached. The content's position comes from the catch-up while the
  content is the one it started from, then from a trusted `exactThrough`, and is unknown for an
  unmarked envelope, a group document, or a document with entries from this session.
- **Timeout:** an entry whose exchanges stay open past the timeout is force-completed and marked, a
  late record becomes a new entry, and later saves are not exact. An entry that completes in time
  isn't timed out.
- **Sender:** one write in flight; a failed write retries with the newest state and never resends an
  older one; a slow `tools` update doesn't delay or reorder content saves; failures show `Retrying`
  from the third, a success starts the count again, and retries wait at most 30 seconds; the minimum
  gap holds and is settable per save.
- **Intermediate saves:** made after 5 seconds without an exact save, stamped as section 1
  describes, carrying the evidence; never made on a group document; an episode is logged at its start
  and end.
- **Lifetime and page hide:** after unmount, the sender finishes the pending exact save, or makes an
  intermediate save after 30 seconds and stops. The window's `pagehide` reaches the sender while it
  drains, stops reaching it once it is disposed, and isn't listened to on a group document.
- **A group document that stops saving:** each reason gets its notice; one that can't be closed makes
  the document under it inert; a repeated unrecorded change in the same tab asks the user to tell their
  teacher; the stop is logged once per session.
- **Activity recorder:** on a group document, a save by another member counts the editor's change.
- **Content listener:** it records the envelope its content came from.
- **Cypress:** after a burst of edits, an individual document's envelope is exact; with an older
  envelope put back, a reload brings the last edit's text back and the next save is exact past it. A
  DataFlow program running at its default rate keeps producing exact saves, at least three entries
  past the first.
