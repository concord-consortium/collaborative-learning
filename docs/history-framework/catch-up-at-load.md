# Catching up at load

**Status: built.** This doc describes how an individual document opened for editing catches up to
its history. Keep it up to date as that changes.

An individual document whose envelope has `exactThrough` and is behind its history applies the
missing entries when its owner opens it for editing (`TreeManager.applyEntriesAtLoad`). When more
than 200 are missing, it applies none of them, and the session isn't exact
(`catch-up-gap-too-large`), so its saves are intermediate ones. A document this session created has
no history in Firestore yet, so it opens caught up instead
(`DocumentsModel.markNewDocumentCaughtUp`).

An envelope without `exactThrough` can hold entries after its `lastHistoryEntryId`, so applying the
entries after that id could apply some of them twice. When such an envelope is behind its history,
nothing is applied for it: the document opens as saved, and the session isn't exact, so its saves
are intermediate ones. The same goes for an envelope with no `lastHistoryEntryId` when the document
has history, since it says nothing about which entries its content holds. One at Firestore's last
entry has nothing to catch up, so the session is exact. An exact envelope at an entry other than the
newest one the session knows of, with an index at or past it, was most likely saved by another
session; the session isn't exact (`history-written-elsewhere`). Publications are never caught up.

## While the document catches up

Until the catch-up finishes, the document shows a spinner in place of its toolbar and content, and
its content isn't saved. Its title bar still works, and a change there, such as sharing it, is
saved. A document shown read-only in the workspace's comparison pane catches up and shows the
spinner too, since that pane has the workspace's editing toolbar. A document that is only listed or
viewed elsewhere never queries Firestore for its history. Its toolbar's tools don't change it, so
its Edit tool still opens it for editing. The catch-up starts from the document's current envelope,
which the content listener replaces along with the content. If the listener replaces the content
while the catch-up reads Firestore, the catch-up applies nothing and the session isn't exact. If it
replaces the content of a document that has already caught up with different content, for example
older content when the caught-up content was never saved, the session starts over: the document is
marked as not caught up again, and the next open for editing catches it up from the new content's
envelope. The catch-up plans against the newest entry the session knows of: its own newest commit,
or else Firestore's last entry as read when the document first caught up. As soon as the sender
starts, it saves the caught-up content, so the stored content isn't left behind its history, unless
a conversion entry is pending. In that case the caught-up content is first saved with the next
content change, and if there isn't one, the next open for editing catches up again.

## How the entries are applied

The missing entries were recorded against the models as they were stored, not as this load converted
them, and one of them can be a conversion entry (see
[conversion-entries.md](conversion-entries.md)), which is never applied to an MST tree. So they are
applied to JSON rather than to the tree:

1. The JSON is a snapshot of the document's MST tree, the whole document and not only its content,
   since entry patch paths start at `/content`.
2. If the load converted old models, the pending conversion entry's inverse patches are applied to
   the snapshot, which turns the converted models back into the stored ones. If nothing was
   converted, the snapshot already holds the models the entries were recorded against.
3. The entries are applied to it with `applyJsonPatches`, one at a time, each all or nothing,
   stopping at the first that fails.
4. Its content is set as the document's content (`DocumentModel.setContent`), which converts any old
   models again and rebuilds the pending conversion entry from the result.

The document isn't monitored yet when this runs, since its editor stays read-only until the catch-up
finishes, so setting the content records no entry. If setting it fails, the content stays as loaded
and no entries count as applied.

## Why it runs when the document is opened for editing

The catch-up runs on the document when it is opened for editing, not on the JSON read from the
realtime database before the document is created, even though that would apply the entries before
any conversion and skip undoing the conversion entry. A document is created well before it is opened
for editing: every document that can be browsed in the resources pane is loaded. Catching up each
one would read the Firestore history of documents that are only looked at. The catch-up only has to
bring a document up to date before it is edited, so it waits until then. As a result, a document can
look slightly different once it is opened for editing than it did in the resources pane.

The content listener can also replace a document's content after it is created, when the document
isn't open, and that content can be behind its history too. So a catch-up before creation wouldn't
remove the need for this one.

The document could instead keep the JSON it was created from, or that the content listener last set,
and the catch-up could apply the entries to that, so the conversion entry wouldn't have to be
undone. That isn't done because it would keep a second copy of the content in memory for every
document that can be edited until it is opened, which adds up when a user has many documents.

## Related docs

- [content-saves.md](content-saves.md) — How content saves record the entry they hold, including
  `exactThrough`, which the catch-up starts from.
- [conversion-entries.md](conversion-entries.md) — The entry that records the schema conversions
  CLUE makes when it loads old content, which the catch-up undoes before applying the entries.
