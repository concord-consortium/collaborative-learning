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

### 1. Dataflow's own Table It

A Dataflow-specific toolbar button that:

- links to the existing table tile when the program's shared dataset already has one, rather than
  adding a second;
- creates a table and links it when none exists;
- calls `prepareRecording()`'s column setup when the table is empty, so the columns are the
  program's node names plus the time column, per bullet 2.

The shared `DataSetViewButton` is left alone.

### 2. Record Single Sample

A toolbar button that appends exactly one row: the current wall-clock, then each node's current
`nodeValue`, through the existing `recordCase` path. If no table exists it does what Table It
does first, then writes the sample.

It is available in `Ready` and in `Done` — the point is to compare separate captures — and
disabled during a continuous `Recording`, where rows are already arriving.

**Appending requires the columns to still match.** If the program's nodes no longer line up with
the table's columns, the sample would land in the wrong columns; `recordCase` already tolerates
missing attributes but writes misaligned data. The unlink rule below is what prevents that, and a
sample taken against a structurally changed program must rebuild the columns rather than append.

### 3. Unlink on structural change

A reaction on the program's node and connection structure — not on node values or names. When it
fires and the dataset holds recorded cases, each linked table tile is given its own copy of the
dataset and removed from the program's shared model, leaving the program free to start a fresh
table on the next Table It or sample.

This is the one piece with no existing analog in the tile, and it is where a bug would be quietest:
unlinking too eagerly loses the live link a student expects, and too late lets a sample land in
columns that describe a different program.

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
- A readable time formatter for table columns. See "The time column".

## Testing

| Test | Covers |
|---|---|
| `dataflow-content.test.ts` | `durationOfRecording` is last − first, and is correct for a table mixing single samples and a recorded run. |
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
- **Held at 3 points** after the split, with the state lift moved to CLUE-771. The unlink reaction
  is the part with no prior art in this tile and the most likely place to overrun.
