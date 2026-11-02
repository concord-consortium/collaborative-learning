# CLUE-771: Rework the Dataflow recording controls — design

**Status:** approved design, not yet planned
**Ticket:** https://concord-consortium.atlassian.net/browse/CLUE-771
**Depends on:** CLUE-740 (PR #3069) — detach-on-structural-change, the point column, and capture naming

## Goal

Put the recording controls where students look for them — the tile toolbar — and stop locking
students out of their own program once a recording exists. Recording becomes model state rather
than React state, which is what makes a toolbar button possible at all.

## The blocker, and why this story exists

`ProgramMode` (Ready → Recording → Done) is derived inside `DataflowProgram` from
`this.state.isRecording`. The record button sits in that component's topbar. A tile-toolbar button
renders from a different component tree and cannot reach that state, so the button cannot move
until `isRecording` lives in `DataflowContentModel`.

## Decisions

| Question | Decision |
|---|---|
| Three-state machine | Collapses. `ProgramMode` is deleted; `isRecording` is the only state. |
| Record with data present | Appends, continuing the point numbering. Nothing collected is destroyed. |
| Clear | Detaches rather than wipes. No confirmation modal. |
| Config fallback | None. Toolbar only; the topbar buttons are deleted. |
| Header while recording | Rate selector stays, disabled; elapsed time joins it. |
| Program cover | On during a run, off once stopped. |
| Toolbar during a run | Everything disabled except Stop. |

## Architecture

### 1. Recording state moves into the model

`DataflowContentModel` gains volatile `isRecording` and two actions:

```ts
startRecording() {
  // Only when there is nothing to keep, so a run started after single samples appends to them.
  if (self.dataSet.cases.length === 0) self.prepareCapture();
  self.isRecording = true;
},
stopRecording() {
  self.isRecording = false;
}
```

Volatile, not persisted: a reload must not resume a run. `DataflowProgram` keeps its interval;
`tick()` asks the model whether to call `recordCase`.

**`recordedRun` is removed.** Its only jobs were distinguishing Done from Ready and guarding
`ensureLinkedTable`'s prepare window, and `isRecording` answers the second directly. This is free
only while CLUE-740 is unreleased, so no saved document has ever carried the property. **If #3069
ships before this lands, keep the property as a deprecated no-op** rather than breaking old
snapshots.

### 2. The state machine is deleted

`ProgramMode` appears in only three files, so the enum goes, and with it:

- `determineProgramMode`, `handleChangeOfProgramMode`, `stopRecording` (the React one),
  `handleChangeIsPlaying`, `incrementPlayBackIndex`, `incrementRecordIndex`
- `playbackReteManager`, `playbackToolDiv`, `playbackNodesWithCaseData`, and
  `DataflowProgramModel.playbackNodesWithCaseData`
- `DataflowProgram` state: `isRecording`, `isPlaying`, `playBackIndex`, `recordIndex`

`shouldShowProgramCover` and the node palette's visibility both become `tileContent.isRecording`.

The hard stop at capacity moves into `tick()`: after `recordCase`, if
`dataSet.cases.length >= maxRecordableCases`, call `stopRecording()`.

### 3. Three toolbar buttons

A new `src/plugins/dataflow/components/toolbar/dataflow-recording-buttons.tsx`, beside CLUE-740's
`dataflow-table-buttons.tsx`. Registered as `record`, `stop` and `clear`.

- **`record`** — calls `content.startRecording()`.
- **`stop`** — calls `content.stopRecording()`. `highlighted` while a run is in progress, since it
  is the only live control.
- **`clear`** — calls `content.detachLinkedTables()` **directly**, with no wrapper action.

That last point is not a style preference. `detachLinkedTables` calls `withoutUndo()`, which MST
ignores with a warning when it runs inside a child action. A `clearRecording()` wrapper would make
it exactly that, putting the detach back on the undo stack and reintroducing the `Not a child`
crash CLUE-740 documented. The button is the root action.

Clear needs no modal: the detach hands the linked table its data and gives the program a fresh
dataset, so nothing is destroyed. Where no table is following, `detachLinkedTables` already empties
the dataset and strips the capture time from the name.

### 4. Disabling the rest of the toolbar during a run

Two of the dataflow toolbar's buttons — `data-set-view` and `data-set-link` — are shared
components that other tile types also use, so they cannot be taught about recording. The zoom and
pan buttons don't consult `useReadOnlyContext`, so there is no existing path either.

Add a small, general context in `src/components/toolbar/`:

```ts
// A tile that is mid-operation can disable its whole toolbar, naming the controls that stay live.
export interface IToolbarBusyState { busy: boolean; exempt?: string[] }
export const ToolbarBusyContext = createContext<IToolbarBusyState>({ busy: false });
```

`TileToolbarButton` reads it and disables when `busy && !exempt?.includes(name)`. Context flows
through the `FloatingPortal` that `TileToolbar` renders into, because a portal preserves the React
tree, so `dataflow-tile.tsx` provides it around its `<TileToolbar>`:

```tsx
<ToolbarBusyContext.Provider value={{ busy: content.isRecording, exempt: ["stop"] }}>
  <TileToolbar tileType="dataflow" ... />
</ToolbarBusyContext.Provider>
```

One addition to a shared component, no forked buttons, and the rule lives in one place.

### Enablement

| | `record` | `stop` | `clear` | every other button |
|---|---|---|---|---|
| Read-only view | — | — | — | own rules |
| Idle, dataset empty | **on** | — | — | own rules |
| Idle, dataset has points | **on** (appends) | — | **on** | own rules |
| Recording | — | **on** | — | — (busy) |

### 5. Header restyle

`dataflow-rateselector-playback.tsx` becomes `dataflow-sampling-rate.tsx`: the rate selector,
disabled while recording, with the elapsed time beside it. The slider and both countdown branches
go. `rc-slider` stays a dependency — `src/components/playback/` still uses it.

`dataflow-program-topbar.tsx` loses `RecordStopOrClearButton`, `PlaybackButton`, the
`useCautionAlert` import, the `topbar-blank-or-play` slot, and five props. What remains is the
conditional connect button, the rate selector, and the dev-only `rate-ui` readout.

```
Idle:       │ Sampling Rate  [1000 ms ▾]          │
Recording:  │ Sampling Rate  [1000 ms  ]   00:03  │
```

### 6. Configuration

`src/clue/app-config.json` gains `"record", "stop", "clear"` after Table It, Graph It and Record
Sample, per the ticket. `src/public/demo/units/qa-dataflow-link/content.json` is the only demo unit
that overrides the dataflow tools list; no curriculum unit overrides it at all, so every real unit
inherits the default.

## Testing

**Model** — `startRecording` prepares a capture only when the dataset is empty and appends
otherwise; `stopRecording` ends the run; `tick` stops at `maxRecordableCases`; Clear's enablement
rule.

**Toolbar** — each of the three buttons' enabled state across the four rows of the matrix; that
Clear leaves the linked table's points intact; that a non-exempt button disables while busy and
`stop` does not.

**Topbar** — the rate selector disables and the elapsed time appears while recording.

**Cypress** — `recordData` and `clearRecordedData` in `DataflowToolTile.js` move to toolbar clicks.
The reload-while-recording test in `dataflow_table_graph_integration_test_spec.js` asserts playback
buttons and needs rewriting; `dataflow_program-topbar.test.tsx` loses its playback assertions.

Per CLUE-740, every new assertion gets mutation-tested: revert the behavior, confirm the test
fails. That story produced four vacuous tests before this became routine.

## Risks

- **The Cypress recording specs are the real coverage here.** CLUE-740 shipped three bugs that only
  the integration spec caught — a double `prepareCapture` that blanked the linked table, a sync
  that renamed a node to "y", and stale toolbar selectors. Expect the same.
- **`recordedRun` removal** is safe only while #3069 is unmerged. Check before deleting.
- **`ToolbarBusyContext` touches a shared component.** Every tile's toolbar buttons run the new
  check, so the default must be inert.

## Corrections to the ticket

1. The ticket says playback is the only consumer of `durationOfRecording` / `getTimeAtRecordedIndex`.
   The recording countdown uses `durationOfRecording`, so both views survive.
2. The ticket says those views are what forces the dataset's first column to be numeric. They
   aren't — CLUE-740's point column is numeric so the Graph tile infers a numeric x-axis, which is
   independent of playback.
3. The ticket describes "the pause control" becoming active. There is no pause once playback is
   gone; the control is Stop, and it ends the run.

## Changed during implementation

Two decisions recorded above did not survive contact with the running build. Recorded here rather
than edited away, so the reasoning stays legible.

**Clear detaches -> Clear empties in place.** The design had Clear hand the linked table its rows
and stop it following, on the grounds that nothing was destroyed. In testing that read as a broken
button: the table kept every row on screen, so pressing Clear appeared to do nothing. It now calls
`clearRecording()`, which empties the capture and re-prepares it, leaving the table linked and
showing the capture's columns -- the state Table It would leave. That is destructive, but unlike
the detach it stays on the undo stack. `detachLinkedTables` is unchanged and still runs from the
structural-change reaction.

**Record now creates a table.** The design left table creation to Table It and Record Single
Sample. A recording whose points land nowhere visible looks like a program doing nothing, so Record
ensures a linked table the same way Record Single Sample already did.

Also added, outside the design's scope: the Table tile follows its newest row as rows arrive
(`useFollowNewRows`), without which a recording's points land below the fold.
