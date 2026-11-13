# Load entries

**Status: built.** This doc describes load entries and how a document opened for editing catches up
to its history. Keep it up to date as either changes.

A tile or shared model type can register a schema version and a converter (`ISchemaVersionInfo`).
When a document is loaded, `createDocumentModel` converts its old tiles and shared models before MST
sees them (`convertContentJson` in `schema-conversion.ts`), and records the conversion as a **load
entry**: a history entry with `isLoadEntry: true`. Its patches turn each converted model's stored
JSON into its converted JSON, and its inverse patches turn it back. It is not undoable. For how to
change a tile's schema, see [tile-schema-changes.md](../tile-schema-changes.md).

## When it is added to the history

The load entry is not added to the history when the document loads. The TreeManager holds it as
`pendingLoadEntry` and adds it just before the first entry that changes the content
(`completeHistoryEntry`), so it is saved along with the converted content it describes. A document
that is only viewed never adds one. If the content is replaced before then
(`DocumentModel.setContent`), the pending entry is rebuilt from the new content.

Concurrent documents (group and class-wide) are not converted this way. Their snapshot preprocessors
convert them as MST loads them, and nothing is recorded.

## A load entry is never applied to an MST tree

Its patches are separate diffs in each direction rather than paired changes, and the live tree has
already loaded the converted models. Undo and redo never reach one because it isn't undoable.
Playback gives it no patches and crosses it with model replacements instead (see "Playback across
conversions" in [history-framework.md](../history-framework.md)).

## Catching up at load

An individual document whose envelope has `exactThrough` and is behind its history applies the
missing entries, up to 200, when its owner opens it for editing (`TreeManager.applyEntriesAtLoad`).
A document this session created has no history in Firestore yet, so it opens caught up instead
(`DocumentsModel.startNewDocumentHistory`).

The missing entries were recorded against the models as they were stored, not as this load converted
them, and one of them can be a load entry, which is never applied to an MST tree. So they are
applied to JSON rather than to the tree:

1. The JSON is a snapshot of the document's MST tree, the whole document and not only its content,
   since entry patch paths start at `/content`.
2. If the load converted old models, the pending load entry's inverse patches are applied to the
   snapshot, which turns the converted models back into the stored ones. If nothing was converted,
   the snapshot already holds the models the entries were recorded against.
3. The entries are applied to it with `applyJsonPatches`, one at a time, each all or nothing,
   stopping at the first that fails.
4. Its content is set as the document's content (`DocumentModel.setContent`), which converts any old
   models again and rebuilds the pending load entry from the result.

The document isn't monitored yet when this runs, since its editor stays read-only until the catch-up
finishes, so setting the content records no entry. If setting it fails, the content stays as loaded
and no entries count as applied.

### Why it runs when the document is opened for editing

The catch-up runs on the document when it is opened for editing, not on the JSON read from the
realtime database before the document is created, even though that would apply the entries before
any conversion and skip undoing the load entry. A document is created well before it is opened for
editing: every document that can be browsed in the resources pane is loaded. Catching up each one
would read the Firestore history of documents that are only looked at. The catch-up only has to
bring a document up to date before it is edited, so it waits until then. As a result, a document can
look slightly different once it is opened for editing than it did in the resources pane.

The content listener can also replace a document's content after it is created, when the document
isn't open, and that content can be behind its history too. So a catch-up before creation wouldn't
remove the need for this one.

The document could instead keep the JSON it was created from, or that the content listener last set,
and the catch-up could apply the entries to that, so the load entry wouldn't have to be undone. That
isn't done because it would keep a second copy of the content in memory for every document that can
be edited until it is opened, which adds up when a user has many documents.

## Related docs

- [start-editing-entry.md](start-editing-entry.md) — The planned entry recorded when a document is
  opened for editing, and how it differs from a load entry.
- [tile-schema-changes.md](../tile-schema-changes.md) — How to change a tile's or shared model's
  saved format, which is what makes a load convert old models.
