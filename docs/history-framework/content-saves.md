# Content saves

**Status: built.** This doc describes how a document's content is saved to the realtime database,
and how each save records the history entry it holds. Keep it up to date as either changes.

A document's content is saved by a `ContentSaveSender`
([content-save-sender.ts](../../src/models/document/content-save-sender.ts)), which
`getContentSaveSender` makes for the document. An individual document gets an
`IndividualContentSaveSender`
([individual-content-save-sender.ts](../../src/models/document/individual-content-save-sender.ts)),
and a group or class-wide document a `ConcurrentContentSaveSender`
([concurrent-content-save-sender.ts](../../src/models/document/concurrent-content-save-sender.ts)).
Each save writes the content with an envelope that names the history entry the content holds, and
says whether the content is exactly the document's state at that entry. A load uses the envelope to
decide where its history starts, and whether it can catch the content up to the history.

This doc covers what every document does, and what individual documents add.
[group-doc-content-saves.md](../group-docs/group-doc-content-saves.md) covers what group documents
add.

## Exact and intermediate saves

An **exact save** holds the document's state at the entry it is stamped with, and that entry is
already in Firestore. It writes the envelope's `lastHistoryEntryId` and `exactThrough`.

An **intermediate save** holds content that may not match any entry in Firestore, for example
because an entry is still open or hasn't uploaded. It clears `exactThrough` and writes `notExact`,
which holds evidence for debugging: open entries, running flows, uncommitted entry ids, and why the
session stopped being exact. Its `lastHistoryEntryId` is the last entry this session had committed,
or else the last entry the load caught up to, or the loaded id. That says nothing reliable about the
rest of the content: the content can hold later entries, and after a catch-up that stopped short, it
lacks the entries the catch-up skipped. Only individual documents make intermediate saves.

A client that doesn't know `exactThrough` saves with `update()` and leaves it in place, so a load
trusts it only while its `id` is the envelope's `lastHistoryEntryId` and its `contentHash` matches
the stored content (`readSavedEnvelope` in
[content-save-envelope.ts](../../src/models/document/content-save-envelope.ts)). Otherwise the
envelope is treated like an intermediate save. The fields are described in
[metadata-fields.md](../document-metadata/metadata-fields.md): see `lastHistoryEntryId`,
`exactThrough` and `notExact`.

## Saving the snapshot taken when an entry completes

A content snapshot is kept when each local history entry completes. Once that entry commits (its
upload to Firestore succeeds), the sender saves the snapshot, stamped with the entry's id and its
Firestore index. The snapshot is usable only if, when the entry completed:

- no other entry that could hold changes was open;
- no tracked flow that had changed state was running; and
- no load entry was waiting to join history.

This lets a lone writer whose entries complete faster than they upload keep making exact saves, each
one upload behind. While entries wait to commit, the sender keeps the newest snapshot and, of the
older ones, only one per second (the minimum gap between saves), up to 10 in all. A commit saves the
newest snapshot kept among its entries, which is at most about a second behind it.

## Sending

The sender sends one write at a time, always of the newest state, except on page hide and at the end
of the drain (see below). A failed write is retried after a delay that doubles from 1 second up to
30 seconds, and after 3 failures in a row the save indicator shows `Retrying`.

When the document unmounts, the sender keeps saving until the latest change is saved, for up to 30
seconds. A document that mounts again in that time reuses the same sender.

## When a session stops being exact

A session is **exact** while history recreates its content: the content is the history from an
entry `since` on, and nothing has broken that since. The `since` entry is saved in `exactThrough`.
It carries forward while each load is exact, and restarts at the loaded id when it isn't.

A session stops being exact when it can't vouch for its content (`SessionExactness` in
[session-exactness.ts](../../src/models/history/session-exactness.ts)). For example:

- the content changed with no entry recording it;
- an entry stayed open for 30 seconds and was force-completed;
- the load couldn't catch the content up to its history;
- the envelope names an entry the history doesn't have; or
- a remote entry failed to apply.

An individual document then relies on intermediate saves (below). A group document stops saving
content from this client.

## Individual documents

**Intermediate saves.** An individual document has a single writer and would lose work if it saved
only exact snapshots, so it also makes an intermediate save of its current content when no exact
save has been possible for 5 seconds. Each stretch of intermediate saves is logged
(`CONTENT_SAVE_FALLBACK_START` and `CONTENT_SAVE_FALLBACK_END`).

**Catching up when the document is opened for editing.** An individual document whose envelope has
`exactThrough` and is behind its history applies the missing entries when its owner opens it for
editing. See "Catching up at load" in [load-entries.md](load-entries.md). Until the catch-up
finishes, the document shows a spinner in place of its toolbar and content. A document shown
read-only in the workspace's comparison pane catches up and shows the spinner too, since that pane
has the workspace's editing toolbar. A document that is only listed or viewed elsewhere never
queries Firestore for its history. Its toolbar's tools don't change it, so its Edit tool still opens
it for editing. The catch-up starts from the document's current envelope, which the content
listener replaces along with the content. If the listener replaces the content while the catch-up
reads Firestore, the catch-up applies nothing and the session isn't exact. If it replaces the content
of a document that has already caught up with different content, for example older content when
the caught-up content was never saved, the session starts over: the document is marked as not
caught up again, and the next open for editing catches it up from the new content's envelope. As soon as the sender
starts, it saves the caught-up content, so the stored content isn't left behind its history.

An envelope without `exactThrough` can hold entries after its `lastHistoryEntryId`, so applying the
entries after that id could apply some of them twice. When such an envelope is behind its history,
nothing is applied for it: the document opens as saved, and the session isn't exact, so its saves
are intermediate ones. One at Firestore's last entry has nothing to catch up, so the session is
exact. Publications are never caught up.

**Page hide.** On page hide, the sender sends the newest committed snapshot save at once, without
waiting for the minimum gap or the write in flight. The sender listens for page hide itself, so this
also happens while it keeps saving after the document unmounts. When the document already relies on
intermediate saves and no snapshot save covers the latest change, it sends an intermediate save of
the current content instead. A document relies on them when one has been sent since the last exact
save, when the session isn't exact, or when the envelope the realtime database holds has no
`exactThrough`, or there is none. The next load can't catch up from such an envelope, so an
intermediate save over it loses nothing. The client tracks that envelope in the document's
`savedEnvelope`.

## Known gaps

- A change made while history monitoring is off isn't detected, so it can sit inside an exact save.
  That covers fixups made when a document mounts, before monitoring starts, fixups made while an
  individual document's load catch-up runs (the document is read-only then, so monitoring is off),
  and changes made while the sender keeps saving after the document unmounts.
- A patch made outside an action while a flow is suspended isn't detected either, since the
  suspended flow counts as a tracked call. MST protection should make such a patch impossible, so
  one would mean something bypassed it.
- A record that arrives after its entry timed out becomes an entry of its own, added after any
  entries recorded in the meantime. If one of those deleted the tile the record changes, the new
  entry fails wherever it is applied later: in playback, in a catch-up, or on another group
  member's client. The session that recorded it is already not exact, so it makes no exact saves
  past that entry.

## Related docs

- [load-entries.md](load-entries.md) — Load entries, and how a document opened for editing catches
  up to its history.
- [group-doc-content-saves.md](../group-docs/group-doc-content-saves.md) — What group documents
  add: saving only from a settled history, the stale-check, and the notice shown when saving stops.
- [metadata-fields.md](../document-metadata/metadata-fields.md) — The envelope fields.
