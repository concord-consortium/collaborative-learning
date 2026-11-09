# CLUE-771: Rework the Dataflow recording controls — design

**Status:** implemented in PR #3075, in review
**Ticket:** https://concord-consortium.atlassian.net/browse/CLUE-771
**Builds on:** CLUE-740 (PR #3069, merged): detaching on structural change, the point column, and
capture naming

## Goal

Put the recording controls where students look for them, in the tile toolbar, and stop locking
students out of their own program once a recording exists. Recording becomes model state rather
than React state, which is what makes a toolbar button possible at all.

## The blocker, and why this story exists

`ProgramMode` (Ready → Recording → Done) was derived inside `DataflowProgram` from
`this.state.isRecording`, and the record button sat in that component's topbar. A tile toolbar
button renders from a different component tree and cannot reach that state, so the button could not
move until `isRecording` lived in `DataflowContentModel`.

## Decisions

| Question | Decision |
|---|---|
| Three-state machine | Collapses. `ProgramMode` and playback are deleted; `isRecording` is the only state. |
| Record with data present | Appends, continuing the point numbering. |
| Record with no table | Creates a linked table, as Record Single Sample does. |
| Clear | Empties the linked table in place and leaves it linked. No confirmation; undo restores it. |
| Config fallback | None. Toolbar only; the topbar buttons are deleted. |
| Header while recording | Rate selector stays, disabled; elapsed time and the recordable window join it. |
| Program cover | On during a run, off once stopped. |
| Toolbar during a run | Everything disabled except Stop. |

## Architecture

### 1. Recording state moves into the model

`DataflowContentModel` gains a volatile `isRecording` and three actions:

```ts
startRecording(addTable: () => void) {
  // Adds a table if there is none, and prepares the capture only when the table is empty, so a
  // run started after single samples appends to them.
  self.showCaptureInTable(addTable);
  self.isRecording = true;
},
stopRecording() {
  self.isRecording = false;
},
clearRecording() {
  self.clearCases();
  self.prepareCapture();
},
```

`isRecording` is volatile, not persisted, so a reload does not resume a run. `DataflowProgram` keeps
its interval, and `tick()` asks the model whether to call `recordCase`.

Because the flag outlives the component, `DataflowProgram` calls `stopRecording()` when it
unmounts. Without that, navigating away mid-run would leave the tile with its cover up and its
toolbar disabled. A read-only view of the same document mounts the component too, so its unmount
does not stop the run.

`showCaptureInTable`, CLUE-740's Table It action, checks `isRecording` where it used to check
`recordedRun`. Both guard the moment between a run starting and its first row, when the columns are
prepared but the table is empty; preparing again then would restamp the capture's time.

**`recordedRun` is removed.** Its jobs were telling Done from Ready and guarding that moment, and
`isRecording` now does the second. #3069 merged to master before this did, so documents saved from
master or branch deploys may hold the property. That was accepted rather than keeping it as a
deprecated property: no release carries it, and the cost is limited to replaying history on those
few documents.

### 2. The state machine and playback are deleted

The `ProgramMode` enum goes, and with it:

- `determineProgramMode`, `handleChangeOfProgramMode`, the React `stopRecording`,
  `handleChangeIsPlaying`, `incrementPlayBackIndex`, `incrementRecordIndex`
- `playbackReteManager`, `playbackToolDiv`, the component's `playbackNodesWithCaseData`, and
  `DataflowProgramModel.playbackNodesWithCaseData`
- `DataflowProgram` state: `isRecording`, `isPlaying`, `playBackIndex`, `recordIndex`
- the `playback` flag on `ReteManager` and `INodeServices`, and the Control block's playback-only
  display branch

`shouldShowProgramCover` and the node palette's visibility both key on `tileContent.isRecording`.

The hard stop at capacity moves into `tick()`. It checks before appending: if
`dataSet.cases.length >= maxRecordableCases` it calls `stopRecording()` instead of `recordCase`.
Checking after appending would let each further Record press push the dataset one row past the cap,
since Record stays available once a run is full.

### 3. Three toolbar buttons

`src/plugins/dataflow/components/toolbar/dataflow-recording-buttons.tsx`, beside
`dataflow-table-buttons.tsx`, registered as `record`, `stop` (`kStopButtonName`) and `clear`.

- **`record`** calls `content.startRecording(addTable)`, which goes through Table It's
  `showCaptureInTable`. `addTable` comes from the table buttons' `useLinkedTable` hook, which is now
  exported. A recording whose points land nowhere visible looks like a program doing nothing, so
  Record makes a table when the program has none. It does not select that table: a tile toolbar
  renders only for the selected tile, so selecting the table would take Stop off screen mid-run. It
  is one action, so the new table, its columns and the start of the run are one history entry.
- **`stop`** calls `content.stopRecording()`. It is `highlighted` while a run is in progress, since
  it is the only live control.
- **`clear`** calls `content.clearRecording()`: it empties the capture and prepares it again, so the
  table stays linked, keeps the capture's columns and gets a fresh start time in its name. That is
  what Table It leaves on an empty table.

Clear destroys recorded data, but it is an ordinary undoable action, so an accidental Clear can be
undone. That is why there is no confirmation. Clear is not a detach: a detach hands the table its
rows and stops it following, so the table looks unchanged and the button looks broken.
`detachLinkedTables` still runs, unchanged, from inside each structural action.

### 4. Disabling the rest of the toolbar during a run

Two of the dataflow toolbar's buttons, `data-set-view` and `data-set-link`, are shared components
that other tile types also use, so they cannot be taught about recording. The zoom and pan buttons
don't consult `useReadOnlyContext`, so there is no existing path either.

A small, general context in `src/components/toolbar/tile-toolbar-context.ts`:

```ts
// A tile that is mid-operation can disable its whole toolbar, naming the controls that stay live.
export interface IToolbarBusyState { busy: boolean; exempt?: string[] }
export const ToolbarBusyContext = createContext<IToolbarBusyState>({ busy: false });
```

`TileToolbarButton` reads it and disables when `busy && !exempt?.includes(name)`. Context flows
through the `FloatingPortal` that `TileToolbar` renders into, because a portal preserves the React
tree, so `dataflow-tile.tsx` provides it around its `<TileToolbar>`:

```tsx
<ToolbarBusyContext.Provider value={{ busy: tileContent.isRecording, exempt: [kStopButtonName] }}>
  <TileToolbar tileType="dataflow" ... />
</ToolbarBusyContext.Provider>
```

`TileToolbarButton` also handles a click on a disabled button in the capture phase now. The pan
button's corner triangle stops propagation, so with a bubbling handler it still acted while the
button was disabled.

### Enablement

| | `record` | `stop` | `clear` | every other button |
|---|---|---|---|---|
| Read-only view | — | — | — | own rules |
| Idle, dataset empty | **on** | — | — | own rules |
| Idle, dataset has points | **on** (appends) | — | **on** | own rules |
| Recording | — | **on** | — | — (busy) |

"Every other button" includes Table It and Record Single Sample, which the busy context disables
during a run.

### 5. Header restyle

`dataflow-rateselector-playback.tsx` is replaced by `dataflow-sampling-rate.tsx`: a "Sampling Rate"
label and the rate selector, disabled while recording. During a run it also shows the elapsed time
over the recordable window, `maxRecordableCases` points at the current rate. Adding a block
shortens that window, since `maxRecordableCases` divides a fixed budget by the node count. The
slider and the countdown go. `rc-slider` stays a dependency because `src/components/playback/`
still uses it.

`dataflow-program-topbar.tsx` loses `RecordStopOrClearButton`, `PlaybackButton`, the
`useCautionAlert` import, the `topbar-blank-or-play` slot and five props. What remains is the
conditional connect button, the sampling rate, and the dev-only `rate-ui` readout.

```
Idle:       │ Sampling Rate  [1000 ms ▾]                │
Recording:  │ Sampling Rate  [1000 ms  ]   00:03/16:40  │
```

Smaller changes in the header: the rate labels gain a space ("50 ms"), `formatTime` pads minutes to
two digits instead of three, and the picker is restyled to the story's design (square corners, a
label that doesn't wrap).

### 6. Configuration

`src/clue/app-config.json` gains `"record", "stop", "clear"` after Table It, Graph It and Record
Sample, as the ticket asks. `src/public/demo/units/qa-dataflow-link/content.json` is the only demo
unit that overrides the dataflow tools list, and no curriculum unit overrides it, so every real unit
inherits the default. `docs/unit-configuration.md` documents the three buttons.

### 7. The table follows new rows

Outside the original scope: the Table tile scrolls to its newest row as rows arrive
(`src/components/tiles/table/use-follow-new-rows.ts`). Without it a recording's points land below
the fold. It scrolls smoothly when rows arrive slowly enough to see and jumps when they arrive
faster than the animation. It stops following when the student scrolls away from the bottom, and
starts again when they scroll back. It applies to any table, not only ones linked to a program.

Only appends scroll: the row count grew and a different row is now last. A row inserted mid-table,
by a Data Card insert or by undoing a delete, leaves the view alone, as does a sort or reorder.

## Testing

**Model** (`dataflow-content.test.ts`): `startRecording` prepares a capture only when the dataset
is empty, appends otherwise, and keeps the original capture time; `stopRecording` ends the run; the
default x | y columns don't rename a block. `dataflow-detach-undo.test.ts`: Record's new table and
columns are one history entry.

**Component** (`dataflow-program.test.tsx`): unmounting stops a run; unmounting a read-only view
does not. `tick`'s stop at `maxRecordableCases` has no unit test.

**Toolbar** (`dataflow-recording-buttons.test.tsx`, `tile-toolbar.test.tsx`): each button's enabled
state across the matrix; Record prepares the capture and makes a table when there is none; Clear
empties the linked table, keeps it linked with the capture's columns, restamps the name and then
disables itself. For the busy context: a non-exempt button disables while busy and an exempt one
does not, and a nested handler that stops propagation is blocked only while busy.

**Topbar** (`dataflow-program-topbar.test.tsx`): the rate selector disables and the elapsed time
appears over the recordable window while recording.

**Table** (`use-follow-new-rows.test.ts`): scrolling to new rows, smooth versus jump, stopping and
resuming the follow, and not scrolling for a mid-table insert or a sort.

**Cypress**: `recordData`, `recordDataWithoutStop` and `clearRecordedData` in `DataflowToolTile.js`
click the toolbar buttons, selecting the tile first. The QA-only program clear button's getter is
renamed `getClearProgramButton` so it isn't confused with the recording Clear. The
reload-while-recording test in `dataflow_table_graph_integration_test_spec.js` now checks that a
reload ends the run and leaves Record and Clear enabled, and that after Clear and a reload the table
is empty with the capture's columns. `copy_doc_test_spec.js` picks its own table with `first()`,
and `arrow_annotation_spec.js` no longer asserts a total of annotation buttons, since the table
Record creates adds its own.

## Risks

- **The Cypress recording specs are the real coverage.** CLUE-740 shipped three bugs that only the
  integration spec caught: a double `prepareCapture` that blanked the linked table, a sync that
  renamed a block to "y", and stale toolbar selectors.
- **`ToolbarBusyContext` touches a shared component.** Every tile's toolbar buttons run the new
  check, so the default must stay inert.

## Corrections to the ticket

1. The ticket says playback is the only consumer of `durationOfRecording` and
   `getTimeAtRecordedIndex`. The elapsed time shown during a run uses `durationOfRecording`, so both
   stay.
2. The ticket says those views are what forces the dataset's first column to be numeric. They
   aren't: CLUE-740's point column is numeric so the Graph tile infers a numeric x-axis, which is
   independent of playback.
3. The ticket describes "the pause control" becoming active. There is no pause once playback is
   gone; the control is Stop, and it ends the run.

## Changed from the approved design

The approved design differed in these ways. The sections above describe what was built.

- **Clear detached rather than emptying in place.** The design had Clear call
  `detachLinkedTables` directly, handing the table its rows. In testing that read as a broken
  button: the table kept every row on screen, so Clear appeared to do nothing.
- **Record didn't create a table.** The design left that to Table It and Record Single Sample.
- **`recordedRun` was to be kept** as a deprecated property if #3069 shipped first. It merged first
  and was removed anyway, for the reasons in section 1.
- **The cap was checked after appending.** See section 2.
- **Not in the design:** stopping a run on unmount, the recordable window in the header, the
  capture-phase disabled click, and the table following new rows.
