# Open entries

**Status: not built.** This doc describes the open entry as it is planned, and what CLUE does
today in its place. Update it as the work lands: move each part from "Planned design" to "How it
works" when it is built, and remove the parts of "What CLUE does today" it replaces.

An **open entry** is the history entry recorded when a document is opened for editing. It marks
the start of each editing session, so a teacher or student reviewing the history can see where
one session ends and the next begins. It also holds the changes CLUE makes to the content when it
opens a document, so those changes have a place in history instead of slipping into whatever
entry happens to be open.

## Why it is needed

Some state in a tile depends on where the document is opened, not on what the user did. The
DataFlow tile's Live Output config (`outputConfig`) is the example: it comes from the unit's
`settings.dataflow` options, and the tile stores a copy so the AI summarizer, which only sees the
document's snapshot, knows which outputs the unit allows. A document can outlive the unit
configuration it was made with, so the copy has to be refreshed when the document is edited
again. Refreshing it is a change to the content, and every change to the content needs a history
entry, or replaying history no longer recreates the content.

There is no good place for that change today. Opening a document isn't recorded, so a change made
on open is recorded as an entry of its own at whatever moment the code runs. When that is during
another entry, the change can land in the wrong place in history:

- A history entry gets its place in history when it completes, not when it starts.
- An entry can stay open while it waits on something slower than a microtask, such as a
  shared-model update.
- A change made meanwhile completes first, so it is stored before the open entry.

If the open entry is the one that adds a tile, the stored history has a change to the tile before
the tile exists. Playback can't move back past the tile's creation, and a plain JSON-patch replay
of the history fails. This is what the DataFlow tile did when it set its Live Output config on
mount.

## What CLUE does today

- **New tiles** get their Live Output config when they are created: `defaultDataflowContent`
  reads it from the unit, inside the action that adds the tile, so it is recorded with the tile's
  creation.
- **Copied tiles** get the config of the unit they are copied into, in the copy's action.
  `updateContentForCopy` (on the tile's registration) receives the unit's `appConfig` for this.
- **Existing tiles** pick up a changed unit config when they mount in an editable view:
  `mirrorUnitOutputConfig` in `dataflow-tile.tsx` calls `setOutputConfig`, which records a
  non-undoable entry when the config differs. For new and copied tiles the config already matches,
  so nothing is recorded. This is the pattern the open entry replaces. Don't copy it.
- **Histories stored before this change** can still have the Live Output entry ahead of the
  tile's creation. `scripts/fix-out-of-order-history.ts` repairs them by moving each such entry to
  just after the entry that creates its tile. See its header for how it decides what is safe to
  move.
- **Load entries** (see "Load entries" in [history-framework.md](../history-framework.md)) record
  the schema conversions CLUE makes when it loads old content. They aren't open entries; see below.

## Planned design

### What the open entry records

- **A session marker.** The entry is recorded every time a document is opened for editing, even
  when nothing changes. It is not undoable.
- **Changes tiles make on open.** The document calls a hook on each tile's content, inside one
  action, and records what the hooks change as the open entry. A tile reaches the unit
  configuration through `getAppConfig(self)`, as `defaultContent` and `getMaxTilesOfType` already
  do. The hook runs from the model, not from a React mount, so it doesn't depend on when the tile
  renders. The name and signature are not settled; `onOpenForEditing` is a working name.
- **Drift.** When the content doesn't match where the history ends, the patches that take the
  history's end state to the content. See "Drift" below.

A tile created during the session sets the same state when it is created, inside the action that
adds it (as `defaultContent` and `updateContentForCopy` do for DataFlow today). The open entry only
covers the tiles that were in the document when it was opened.

Nothing records the end of a session. The user can close the window before CLUE has a chance to
write anything, so a closing entry would be missing too often to rely on.

### How it differs from a load entry

| | Load entry | Open entry |
|---|---|---|
| Records | Schema conversions of stored content | Changes CLUE makes on open, in the current schema, and drift |
| Recorded when | Loading converted something, and the user then changes the content | Every time the document is opened for editing |
| Playback | Skips its patches; converts the models itself | Applies it like any other entry |
| Undoable | No | No |

The two stay separate entries because playback treats them differently. When both are recorded,
the load entry comes first: it turns the stored content into the current schema, and the open
entry's patches are in that schema. The load entry is only uploaded with the next change, and the
open entry is that change, so they always reach Firestore together.

### Drift

The saved content **drifts** from history when it holds a change that no history entry records.
There are two kinds, and they belong in different entries:

- **The content doesn't match the end of the history**, for example after a change made with no
  entry open, or entries a previous session couldn't upload. The patch from the history's end
  state to the content is a real change that playback has to apply, so it belongs in the open
  entry. Measuring it needs the history's end state, which an individual document only has by
  replaying its history at load. Today a document's saved content records the id of the last entry
  it includes, and group documents check that the id is in the history, but nothing measures the
  difference.
- **Snapshot pre-processors change the content as it loads.** These behave like schema
  conversions. If playback runs the same pre-processors when it builds tiles from patches, these
  changes belong with the load entry, and playback skips them. Whether it does needs checking
  before this part is designed: applying such a change twice is harmless for a `replace` but not
  for an `add` into an array.

### Open questions

- **What counts as an open?** Once per document per page load, or each time the user switches back
  to the document? Switching remounts the tiles today.
- **Volume.** An entry for every open, changed or not, is one more Firestore write per open.
- **Playback stops.** Should an open entry with no changes be a stop on the playback slider? It is
  useful as a marker, but nothing on screen changes there.
- **Group documents.** Each editor records their own open entry; how they interleave with the other
  editors' entries needs working out with the group-document history design.
- **Out-of-order entries in general.** The open entry removes one source of them. Any entry that
  waits on a slow exchange can still complete after an entry that depends on it. Tracking when an
  entry starts as well as when it ends, and holding back an entry that depends on an open one, is
  the likely direction, but it isn't designed yet.
