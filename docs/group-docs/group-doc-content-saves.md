# Group document content saves

**Status: built.** What group documents add to how a document's content is saved. Read [content-saves.md](../history-framework/content-saves.md) first: it covers exact saves, the snapshot taken when an entry completes, sending, and when a session stops being exact, which apply to group documents too. This doc covers the rest. Keep it up to date as either changes.

A group document has several writers, and its history holds every canonical entry, so it doesn't need intermediate saves to keep anyone's work. It saves only canonical state at a known position, from a settled history, and other members save in place of one that can't. The commit and settled signals come from `FirestoreHistoryManagerConcurrent` in [firestore-history-manager-concurrent.ts](../../src/models/history/firestore-history-manager-concurrent.ts).

## Only committed, canonical state is saved

A group document never saves content from a local entry that hasn't committed, and never makes an intermediate save. A snapshot taken when a local entry completes is voided if another member's entry is applied, or a fork rollback or merge happens, before its entry commits.

A group document doesn't listen for page hide. Its saves go through the usual checks, since other members can save in its place.

## Idle members save the current state when settled

An idle member has no local entries of its own, so it saves its current content when its history is settled:

- nothing is queued or uploading;
- no apply is in progress, and nothing is in the download buffer;
- no entry is open, and no running call has changes no entry holds yet; and
- the session is still exact.

The save is stamped with the last canonical entry (`expectedRemoteHead` and its index), not the last entry in local history, because after a fork rollback that is a local-only revert entry.

## Stale-check and jitter

Before a group save, the sender compares the save's chain index with the index in the envelope's `exactThrough`. If the envelope is already at or past it, the save is skipped. Otherwise it waits a random 0 to 200 ms, checks again, and saves. Local history can't order two entry ids from before the load point, which is why the index is stored. A committing writer learns of its commit before the other members receive the entry, so it usually saves first and the idle members skip. An envelope whose `exactThrough` doesn't name its `lastHistoryEntryId` can't be ordered against a save, so it counts as behind.

## The envelope listener

A group document listens to the envelope's `lastHistoryEntryId` and `exactThrough` children, not its content, so it checks that `exactThrough` names the id but can't check the content hash. The listener drives the stale-check. When the envelope reaches this client's newest committed entry, the save indicator shows Saved even though another member made the save. The activity recorder is told the saved id the same way, so it doesn't wait out its timeout for every change an active editor makes.

## The initial load from an exact envelope

When the envelope's `exactThrough` is trusted, the initial load of a group document starts from the envelope's entry and applies only the entries after it, instead of reading the content and Firestore's last entry separately. That removes the initial-load race for these envelopes, and `since` carries forward.

## When a session stops being exact

A group document whose session stops being exact makes no more content saves from this client. A failed apply marks the session not exact before the manager's `applying` flag clears, since the sender checks for a settled save as soon as it does. The sender logs `CONTENT_SAVE_GROUP_STOPPED` once, and a failed apply also logs `HISTORY_REMOTE_APPLY_FAILED`.

The document then shows a notice over its content and toolbar, chosen by the reason, with the reason as a code for reports ([save-stopped-notice.ts](../../src/models/document/save-stopped-notice.ts)):

- An entry that stayed open for 30 seconds: the document looks right, so the notice can be closed and suggests reloading, which starts an exact session.
- A change with no entry: later edits that build on it may not load, so the notice can't be closed, the document is read-only, and it asks for a reload. A second one in the same tab within 10 minutes means the reload didn't help, so it asks the user to tell their teacher instead.
- An entry that fails to apply at load: every load fails the same way, so the notice can't be closed and asks the user to tell their teacher.
- Another member's entry that fails to apply: the notice can't be closed and asks for a reload, which helps when this tab's own changes caused it.
- Saved content at an entry the history doesn't have: the document looks right but no load saves again, so the notice can be closed and asks the user to tell their teacher.

A notice that can't be closed makes the document under it inert. Closing and reopening the document doesn't start a new session, since the document model stays in the store, so only a reload does.

## Known gaps

- A remote entry that always fails to apply stops a group document's content saves, and every member that loads the document fails on it. Watch for `HISTORY_REMOTE_APPLY_FAILED`. See [Remote Entries That Fail to Apply Stay in History](group-docs-implementation-todos.md#remote-entries-that-fail-to-apply-stay-in-history).
- Saved content at an entry the history doesn't have stops every later session's saves, since no load is exact. Nothing repairs it yet.
- The group upload race, and the initial-load race for a group envelope without a trusted `exactThrough`, are listed under [GD-22](group-docs-plan.md#gd-22-reliability-and-robustness).
- The known gaps in [content-saves.md](../history-framework/content-saves.md#known-gaps) apply to group documents too.
