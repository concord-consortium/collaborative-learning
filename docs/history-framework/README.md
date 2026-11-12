# History framework documentation

How CLUE records the changes to a document, and uses them for undo, redo and history playback.

[history-framework.md](../history-framework.md) is the overview of the framework: its models, how
an entry is recorded, how undo and playback apply entries, conversion entries, playback across
schema conversions, and how history is stored in Firestore. It is one large document. New topics go
in this folder, and sections of the overview can move here as they grow.

Each doc in this folder describes one part of the history system. It says at the top whether that
part is built, and it is kept up to date as the work lands, rather than replaced by a separate
"as built" doc. A part that isn't built yet is described in a "Planned design" section next to
what CLUE does today, so the doc stays accurate at every stage.

## Docs

- [start-editing-entry.md](start-editing-entry.md) — The entry recorded when a document is opened
  for editing: a session marker that also holds the changes CLUE makes on open and the content's
  drift from history. Status: not built. Also covers what CLUE does today instead, and the script
  that repairs histories with entries stored ahead of their tile's creation.

## Related docs

- [undo-and-time-travel.md](../undo-and-time-travel.md) — What tile developers need to know about
  history: how actions become entries, `withoutUndo`, and keeping tiles working in playback.
- [tile-schema-changes.md](../tile-schema-changes.md) — How to change a tile's or shared model's
  saved format without breaking history.
- [group-docs/](../group-docs/README.md) — Group documents, whose history is shared by several
  editors. Several of its designs change how entries are ordered and stored.
