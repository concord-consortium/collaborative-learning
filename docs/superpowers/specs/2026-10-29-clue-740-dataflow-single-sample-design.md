# CLUE-740: Table It and Record Single Sample in Dataflow — Design

**Jira:** CLUE-740 (epic CLUE-714, "Microbits for Inquiry"), fixVersion 7.8.0

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

Two obstacles the ticket does not mention, which together are most of the work.

### Recording state lives in React, not the model

`ProgramMode` (Ready → Recording → Done) is derived in `DataflowProgram` from `this.state.isRecording`
plus `isDataSetEmptyCases`. The record button sits in the program topbar, inside that component.

A tile-toolbar button is rendered from a different tree and cannot reach that state. So moving the
record button into the toolbar (bullet 6) requires **lifting `isRecording` into the MST content
model** first, with `ProgramMode` derived there. Everything else in this story is small by
comparison; this is the part that makes the 3-point estimate wrong.

### `DataSetViewButton` is shared

The "Table It!" button is `src/components/toolbar/data-set-view-button.tsx`, used by Dataflow,
Table, Graph and Data Card alike. It always calls `addTileAfter`, so it always creates a new tile.

Bullet 1 wants it to reuse an already-linked table. Changing the shared component changes every
tile that uses it. **This design gives Dataflow its own button** rather than altering behavior for
tiles this story has not considered.

## Decisions taken

| Question | Decision |
|---|---|
| What "unlink" means | The table tile detaches from the program's shared dataset and keeps the recorded data as its own. The student's numbers survive; the stale link does not. |
| What triggers it | Structural change only: a node added, removed, or rewired. A rename or a parameter tweak does not unlink. |
| Timestamp | Wall-clock, for both single samples and continuous recording. |
| Samples + recording | A recording run appends to whatever single samples are already in the table. |

The last two were chosen over the alternatives proposed here, with the costs below understood.

## The time column

This is the sharpest constraint in the story and the one thing worth confirming before building.

**Wall-clock for both kinds of row** means one column can hold rows from a single sample and from
a recorded run and still mean one thing — which is what makes appending coherent. The cost is that
the column's *value* must stay a **number**, because the first attribute is read numerically:

- `getTimeAtRecordedIndex` returns `0` for any non-number, and feeds `durationOfRecording`, which
  drives the playback scrubber's "0:03 / 0:12" readout
  (`dataflow-rateselector-playback.tsx`).
- The Graph tile uses `attributes[0]` as its x-axis.

A formatted string such as `"14:32:07"` would silently make playback report zero duration and turn
the graph's x-axis categorical. The data-set's attributes support only numeric precision
(`.2~f`-style) formatting — there is no time formatter for a column — so a readable clock time
cannot be had "for free" while keeping the value numeric.

**Therefore:** store the wall-clock as **epoch milliseconds, numeric**, and change
`durationOfRecording` from *the last row's absolute value* to *last − first*. That is a five-line
change and it makes playback correct again, including across a table that mixes samples and a run.

**The cost, stated plainly:** the column displays as a large raw number (`1792169527000`) rather
than a time of day, in both the table and the graph axis. If that is unacceptable, the options are
a second human-readable column alongside the numeric one, or elapsed-seconds instead of
wall-clock — both previously discussed. This design proceeds with the numeric wall-clock as
chosen; say so and it changes.

## Design

### 1. Lift recording state into the model

`isRecording` moves from `DataflowProgram`'s React state to `DataflowContentModel`, with
`programMode` as a view derived from it and `isDataSetEmptyCases` exactly as
`determineProgramMode` does today. `DataflowProgram` reads the model instead of its own state; the
topbar keeps working unchanged because it already receives `programMode` as a prop.

Doing this first means the toolbar buttons are a thin layer over an existing state machine rather
than a second copy of it.

### 2. Dataflow's own Table It

A Dataflow-specific toolbar button that:

- links to the existing table tile when the program's shared dataset already has one, rather than
  adding a second;
- creates a table and links it when none exists;
- calls `prepareRecording()`'s column setup when the table is empty, so the columns are the
  program's node names plus the time column, per bullet 2.

The shared `DataSetViewButton` is left alone.

### 3. Record Single Sample

A toolbar button that appends exactly one row: the current wall-clock, then each node's current
`nodeValue`, through the existing `recordCase` path. If no table exists it does what Table It
does first, then writes the sample.

It is available in `Ready` and in `Done` — the point is to compare separate captures — and
disabled during a continuous `Recording`, where rows are already arriving.

**Appending requires the columns to still match.** If the program's nodes no longer line up with
the table's columns, the sample would land in the wrong columns; `recordCase` already tolerates
missing attributes but writes misaligned data. The unlink rule below is what prevents that, and a
sample taken against a structurally changed program must rebuild the columns rather than append.

### 4. Unlink on structural change

A reaction on the program's node and connection structure — not on node values or names. When it
fires and the dataset holds recorded cases, each linked table tile is given its own copy of the
dataset and removed from the program's shared model, leaving the program free to start a fresh
table on the next Table It or sample.

This is the one piece with no existing analog in the tile, and it is where a bug would be quietest:
unlinking too eagerly loses the live link a student expects, and too late lets a sample land in
columns that describe a different program.

### 5. Toolbar order

Record and Record Single Sample are registered as Dataflow toolbar buttons and placed after Table
It and Graph It in the default toolbar configuration.

## Out of scope

- Changing the shared `DataSetViewButton` for other tiles.
- Any change to how a continuous recording samples, or to the data rate selector.
- Removing the topbar record button. It keeps working off the same model state; retiring it is a
  separate change once the toolbar button has been seen in use.
- A readable time formatter for table columns. See "The time column".

## Testing

| Test | Covers |
|---|---|
| `dataflow-content.test.ts` | `programMode` derives from model state exactly as `determineProgramMode` did; `durationOfRecording` is last − first and survives a table mixing samples and a run. |
| toolbar registration tests | Table It links an existing table rather than adding a second; creates one when none exists. |
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
- **The estimate is wrong at 3 points.** Lifting recording state into the model, a Dataflow-specific
  Table It, a new sample path, a structural-change reaction and a toolbar reorder is 5–8. Worth
  re-pointing before the work starts.
