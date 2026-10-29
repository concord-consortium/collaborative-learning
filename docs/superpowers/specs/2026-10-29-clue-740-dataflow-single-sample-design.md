# CLUE-740: Table It and Record Single Sample in Dataflow — Design

**Jira:** CLUE-740 (epic CLUE-714, "Microbits for Inquiry"), fixVersion 7.8.0
**Split out:** CLUE-771 carries the recording controls — lifting `isRecording` out of React state,
moving the record button to the toolbar, removing playback, reworking Clear.

## Goal

A student building a Dataflow program can capture one sample at a time into a table and compare
runs, instead of only being able to record a continuous stream. Table It stops creating a second
table when one is already linked, the table's columns are named after the program's nodes, and a
table stops following a program whose structure has changed under it.

## What already exists

Worth stating, because three of the ticket's seven bullets are closer to done than they read:

- **A Dataflow tile always has a `SharedDataSet`.** It is created in `afterAttach` if missing
  (`dataflow-content.ts`), defaulting to `x | y`. Nothing here has to create one.
- **`prepareRecording()` already builds the ticket's columns**: it clears attributes, adds
  `Time (sec)`, then one attribute per node named from `orderedDisplayName`. Today it is called
  only when a continuous recording starts.
- **`recordCase()` already writes one row** across those columns from each node's current
  `nodeValue`. A single sample is one call to it, not a new mechanism.

## What is actually in the way

Two things the ticket does not mention. The first is no longer this story's problem; the second
turned out not to be a problem at all.

### Recording state lives in React — and is now CLUE-771's problem

`ProgramMode` (Ready → Recording → Done) is derived in `DataflowProgram` from
`this.state.isRecording` plus `isDataSetEmptyCases`, and the record button sits in the program
topbar inside that component. A tile-toolbar button renders from a different tree and cannot reach
that state, so the record button cannot move until `isRecording` is lifted into the model.

That work, and the rest of the control rework around it, moved to CLUE-771. **Nothing in this
story depends on it:** the single-sample button writes a row directly and does not need
`ProgramMode`, beyond being disabled while a continuous recording is running — which it can read
from the same `isDataSetEmptyCases`/topbar state the existing UI already uses.

### Table It's behavior is per-tile, not shared

Worth recording, because the opposite assumption shaped an earlier draft of this design.
`toolbarButtonInfos` is a `Map<tileType, Map<buttonName, info>>`, so every tile type registers its
own button list. Dataflow already registers `data-set-view`; it simply points at the component in
`src/components/toolbar/data-set-view-button.tsx`, which Table, Graph and Data Card also use.

Pointing Dataflow's registration at a different component therefore affects **only Dataflow**.
There is no shared-behavior risk to weigh here, and no reason to keep "always create a new table"
for safety's sake. The find-linked-table helper is needed for bullet 5 regardless, so having
Table It use it too is about one line.

## Decisions taken

| Question | Decision |
|---|---|
| What "unlink" means | The table tile detaches from the program's shared dataset and keeps the recorded data as its own. The student's numbers survive; the stale link does not. |
| What triggers it | Structural change only: a node added, removed, or rewired. A rename or a parameter tweak does not unlink. |
| Undo | A detach is part of the same history entry as the change that caused it, so one undo restores the structure and the link together. |
| Timestamp | Not per row. The first column is an ordinal point number; the capture's start time goes in the dataset name, which is the table's header. |
| Samples + recording | A recording run appends to whatever single samples are already in the table. |

The timestamp decision replaced two earlier attempts — a numeric wall-clock that read as
`1792169527000`, and a numeric/readable column pair — both of which worked around the numeric-first-
column constraint rather than removing it.

## Time: in the header, not in every row

The first column is an **ordinal point number** — 1, 2, 3 — and the capture's start time goes into
the **dataset's name**, which is the table tile's header.

```
Program data 14:32:07
 Point | Sensor | Servo
   1   |  412   |  90
   2   |  418   |  90
   3   |  455   |  45
```

This is better than the two alternatives considered before it, and it is worth saying why, because
both looked necessary at the time.

**It removes the constraint instead of working around it.** The first attribute has to be numeric:
`attribute.type` infers `"numeric"` only when every value parses as a number, so a string there
gives the Graph tile a categorical x-axis, and `getTimeAtRecordedIndex` returns `0` for a
non-number, zeroing the playback scrubber. An ordinal is a number, so nothing breaks — and unlike
epoch milliseconds (`1792169527000`), it is already the number a student wants to read.

**It is the right x-axis for what this story is for.** The ticket exists so a student can "compare
different inputs/outputs". Samples captured minutes apart are not a time series; plotting them
against real elapsed time spreads three points across a mostly empty axis. Against point number
they sit evenly, which is what makes them comparable.

**The timestamp belongs to the capture, not the row.** It is one fact about a session, so it is
recorded once. `TableContentModel.contentTitle` returns `self.dataSet.name`, so setting the name
puts it in the table's header with no new UI.

### What this changes in the code

`recordCase` currently writes `recordIndex * programDataRate / 1000` into column 0, and
`getTimeAtRecordedIndex` reads that column back as seconds for the playback scrubber. With an
ordinal in the column, the scrubber derives its time instead:
`index * programDataRate / 1000` — the same arithmetic, moved from storage to a view.

That is **backward compatible for existing documents**: in a saved recording, column 0 already
holds exactly `index * rate / 1000`, so the derived value matches the stored one. The one case
where they differ is a document whose data rate was changed after recording, where the scrubber
would read slightly off — and CLUE-771 removes the scrubber.

### Open details

- **Column name.** "Point" follows the ticket's own wording. "Sample" would also do.
- **1-based.** `recordIndex` starts at 0 today; the column shows 1, 2, 3, since it is for reading.
- **Name format.** Something like `Program data 14:32:07`. Note `getUniqueSharedModelName` may
  append a suffix when a document is copied, and a student renaming the table overwrites the name —
  both acceptable, since their title should win.

## Design

### 1. Dataflow's own Table It

A Dataflow-specific toolbar button that:

- links to the existing table tile when the program's shared dataset already has one, rather than
  adding a second;
- creates a table and links it when none exists;
- calls `prepareRecording()`'s column setup when the table is empty, so the columns are the point
  number followed by the program's node names, per bullet 2;
- sets the dataset's name to the capture's start time, which is the table's header.

The shared `DataSetViewButton` is left alone.

### 2. Record Single Sample

A toolbar button that appends exactly one row: the next point number, then each node's current
`nodeValue`, through the existing `recordCase` path. If no table exists it does what Table It
does first, then writes the sample.

It is available in `Ready` and in `Done` — the point is to compare separate captures — and
disabled during a continuous `Recording`, where rows are already arriving.

**Appending requires the columns to still match.** If the program's nodes no longer line up with
the table's columns, the sample would land in the wrong columns; `recordCase` already tolerates
missing attributes but writes misaligned data. The unlink rule below is what prevents that, and a
sample taken against a structurally changed program must rebuild the columns rather than append.

### 3. Unlink on structural change — and relink on undo

Detaching has to be **undoable with the change that caused it**: a student who undoes back to the
program the data was captured against should get the live link back, not an orphaned table.

**This rules out a reaction.** `docs/undo-and-time-travel.md` says changes group into one history
entry only via a parent action or a `flow`. A MobX reaction runs *after* the triggering action has
committed, so a reaction-based detach would land in its own entry — and worse, undo applies
patches, which re-run reactions. Undoing the node that caused the detach would re-trigger the
reaction and detach again, which is precisely the behavior being asked for and its opposite.

**So the detach is a child action of the structural change.** The actions that alter structure all
live on `DataflowProgramModel`: `addNode`, `addNodeSnapshot`, `addConnection`, `removeConnection`,
`removeNode` and `removeNodeAndConnections`. Each calls the content model's `detachLinkedTables()`,
which makes the detach part of the same history entry as the change that justified it, by the
parent-action rule.

Two things follow, and both are why this is the right shape rather than a workaround:

- **Undo restores both at once.** One entry holds the structural change and the detach, so one
  undo puts the node back *and* re-links the table.
- **Undo cannot re-detach.** Patch application does not call actions, so `detachLinkedTables` is
  not re-entered while history is being replayed. The reaction had the opposite property.

Calling it from every structural action means it runs more than once for a compound change such as
`removeNodeAndConnections`. That is harmless — after the first call there are no linked tables
left — and it matches the convention already stated in `dataflow-program-model.ts`, where removal
is funnelled through one path "so that every removal path is consistent by construction".

**Dataflow's undo stack is not clean today, and that does not change this design.** Each tick
records actions of its own — `updateSharedProgramData` runs every tick, and the program model
keeps a tick history — so undoing a node change in the running app currently walks back through
tick entries rather than landing on the change. Scott is dissociating ticks from history
separately.

Two consequences, and neither is a reason to wait:

- **The unit tests still mean something.** Nothing ticks under Jest, so a model-level test of "one
  undo restores the node and the link" measures exactly the grouping this design is about.
- **The browser hand-check cannot show it yet.** Undo there will step through tick entries. That
  is the known issue, not a fault in this work, and whoever implements should not chase it.

Putting the detach inside the structural action is also what makes this forward-compatible: it
inherits whatever undo treatment that action ends up with, so when ticks leave the history the
behavior becomes correct with no change here. `withoutUndo()` is already used in this tile
(`resetRunningState`, `setOutputConfig`) if a narrower fix is ever wanted sooner.

**The one thing to verify before building this.** The detach manipulates shared models, which live
in the document tree rather than the tile's. CLUE's history is multi-tree, and whether a
shared-model change made inside a tile action is attributed to that action's history entry decides
whether undo restores the link atomically. `Tree.handleSharedModelChanges` is the path to read.
If it turns out shared-model changes land in a separate entry, the detach needs to move up to a
document-level action instead, and that is a larger change — so this is Task 5's first step, not a
detail to discover during it.

### 4. Toolbar order

Record Single Sample is registered as a Dataflow toolbar button and placed after Table It and
Graph It in `app-config.json`, whose dataflow `tools` list currently begins
`["data-set-view", "Table"], ["data-set-view", "Graph"], "delete", …`. The continuous record
button joins it there in CLUE-771.

## Out of scope

- Changing the shared `DataSetViewButton` for other tiles.
- Any change to how a continuous recording samples, or to the data rate selector.
- Everything in CLUE-771: lifting recording state, moving the record button, removing playback,
  reworking Clear.
- A date/time formatter for table columns. Putting the timestamp in the header avoids needing one;
  building it would be its own change, with every tile as its blast radius.

## Testing

| Test | Covers |
|---|---|
| `dataflow-content.test.ts` | The point column is numeric, so `attribute.type` infers `"numeric"` and the Graph tile gets a numeric x-axis. The dataset name carries the capture's start time. `getTimeAtRecordedIndex` derives from index and data rate, and matches what a pre-existing recording stored in its own column. |
| toolbar registration tests | Table It links an existing table rather than adding a second; creates one when none exists. |
| undo tests | Undoing a node addition restores the node and re-links the table in one step; undoing does not leave the table detached, and does not detach it a second time. |
| single-sample tests | One row appended with the current wall-clock and each node's value; creates the table first when none exists; disabled while recording. |
| unlink tests | A node added, removed or rewired detaches linked tables with their data intact; a rename or parameter change does not. |
| Cypress `dataflow_tool_spec.js` | The two buttons appear in order after Table It and Graph It, and a single sample reaches the table. |

Each behavioral test is to be checked by mutation — reverting the behavior it describes must make
it fail — rather than by passing once.

## Delivery

- **No Deploy timing callout** unless the implementation touches `functions-v2/`, `shared/`, the
  rules or the indexes; on this design it touches none of them.
- A new Cypress spec would need adding to `.github/workflows/manual-regression.yml`; extending the
  existing `dataflow_tool_spec.js` avoids that.
- **Held at 3 points** after the split, with the state lift moved to CLUE-771. The unlink reaction
  is the part with no prior art in this tile and the most likely place to overrun.
