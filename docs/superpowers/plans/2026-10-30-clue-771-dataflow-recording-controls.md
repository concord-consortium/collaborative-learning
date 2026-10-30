# CLUE-771 Dataflow Recording Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Dataflow's recording controls into the tile toolbar, delete playback, and stop locking students out of their program once a recording exists.

**Architecture:** Recording state moves from `DataflowProgram`'s React state into `DataflowContentModel` as a volatile `isRecording`, which is what lets a tile-toolbar button reach it. The three-state `ProgramMode` enum then has no behavior left and is deleted. Three new toolbar buttons (`record`, `stop`, `clear`) replace the topbar's single tri-state button, and a new `ToolbarBusyContext` lets the dataflow tile disable its whole toolbar except Stop while a run is in progress.

**Tech Stack:** TypeScript 5.8, React 18, MobX State Tree (Concord fork), Jest + @testing-library/react, Cypress.

**Design:** `docs/superpowers/specs/2026-10-30-clue-771-dataflow-recording-controls-design.md`

**Depends on:** CLUE-740 (PR #3069). That branch adds `prepareCapture`, `detachLinkedTables`, `recordedRun`, the point column, and capture naming. Start from it or from master once it has merged.

---

## Background an engineer new to this code needs

**MST volatile vs. props.** `types.model({...})` properties are persisted into the document
snapshot; `.volatile(...)` state is not. A recording must not survive a reload, so `isRecording` is
volatile.

**Never remove a persisted property casually.** `dataflow-content.ts` carries a long comment above
`programZoom` explaining why: CLUE's history replay applies patches by path, so an entry naming
`/recordedRun` stops resolving once the property is gone, MST throws, and `TreeManager` halts
playback with a failure banner. Task 2 checks the release state before deleting `recordedRun`.

**`withoutUndo()` is ignored inside a child action.** MST only honors it in the root action of a
call, and logs a warning otherwise. `detachLinkedTables` calls it, so anything that wraps that
method in another action silently puts the detach back on the undo stack. Task 4 calls it directly
from the button for exactly this reason.

**Toolbar buttons are registered per tile type.** `registerTileToolbarButtons('dataflow', [...])`
maps a name to a component for dataflow only, so dataflow can point `data-set-view` at the shared
component without affecting other tiles. A button only renders if the unit's
`settings.dataflow.tools` list names it.

**Toolbar buttons use `aria-disabled`, not the HTML attribute,** so they stay keyboard-focusable.
Tests must assert `button.getAttribute("aria-disabled") === "true"`, never `toBeDisabled()`.

**Mutation-test every new assertion.** Revert the behavior under test, confirm the test fails,
restore. CLUE-740 produced four tests that passed with and without the fix before this became
routine.

## File structure

| File | Responsibility | Change |
|---|---|---|
| `src/plugins/dataflow/model/dataflow-content.ts` | recording state and actions | Modify |
| `src/plugins/dataflow/model/dataflow-content.test.ts` | model tests | Modify |
| `src/components/toolbar/tile-toolbar-context.ts` | the new busy context | Modify |
| `src/components/toolbar/tile-toolbar-button.tsx` | honors the busy context | Modify |
| `src/components/toolbar/tile-toolbar.test.tsx` | busy-context tests | Modify |
| `src/plugins/dataflow/components/toolbar/dataflow-recording-buttons.tsx` | record / stop / clear | **Create** |
| `src/plugins/dataflow/components/toolbar/dataflow-recording-buttons.test.tsx` | their tests | **Create** |
| `src/plugins/dataflow/dataflow-toolbar-registration.tsx` | registers the three | Modify |
| `src/plugins/dataflow/components/dataflow-tile.tsx` | provides the busy context | Modify |
| `src/plugins/dataflow/components/dataflow-program.tsx` | loses the state machine and playback | Modify |
| `src/plugins/dataflow/components/types/dataflow-tile-types.ts` | loses `ProgramMode` | Modify |
| `src/plugins/dataflow/components/ui/dataflow-program-topbar.tsx` | loses both buttons | Modify |
| `src/plugins/dataflow/components/ui/dataflow-sampling-rate.tsx` | rate selector + elapsed time | **Create** (rename) |
| `src/plugins/dataflow/model/dataflow-program-model.ts` | loses `playbackNodesWithCaseData` | Modify |
| `src/clue/app-config.json` | default tools list | Modify |
| `src/public/demo/units/qa-dataflow-link/content.json` | QA tools list | Modify |
| `cypress/support/elements/tile/DataflowToolTile.js` | helpers click the toolbar | Modify |
| `cypress/e2e/functional/tile_tests/dataflow_table_graph_integration_test_spec.js` | reload test | Modify |
| `cypress/e2e/functional/tile_tests/dataflow_tool_spec.js` | busy-toolbar test | Modify |
| `src/plugins/dataflow/components/ui/dataflow-program-topbar.test.tsx` | topbar tests | Modify |

---

## Task 1: Add `isRecording` and its actions to the model

**Files:**
- Modify: `src/plugins/dataflow/model/dataflow-content.ts`
- Test: `src/plugins/dataflow/model/dataflow-content.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/plugins/dataflow/model/dataflow-content.test.ts`, after the `prepareCapture` describe
block. `setupContentWithTwoNamedNodes` already exists in that file.

```ts
describe("startRecording", () => {
  it("prepares the capture when the dataset is empty", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.startRecording();
    expect(content.isRecording).toBe(true);
    expect(content.dataSet.attributes.map(a => a.name)).toEqual(["Point", "Sensor", "Servo"]);
  });

  // Point numbering continues rather than restarting. (prepareCapture's own idempotency is what
  // protects the columns here; the guard in startRecording is pinned by the name test below.)
  it("leaves existing points alone and appends to them", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.prepareCapture();
    recordCase(content);
    const pointId = content.dataSet.attributes[0].id;

    content.startRecording();
    recordCase(content);

    expect(content.dataSet.cases).toHaveLength(2);
    expect(content.dataSet.getValueAtIndex(1, pointId)).toBe(2);
  });

  // Appending must not restamp the name: the capture's time is when collection began, and
  // prepareCapture would overwrite it with the time Record was pressed again.
  it("keeps the original capture time when it appends", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.setContentTitle("Program 1");
    content.prepareCapture(new Date(2026, 9, 30, 14, 32, 7));
    recordCase(content);

    content.startRecording();

    expect(content.dataSet.name).toBe("Program 1 14:32:07");
  });

  it("stops recording", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.startRecording();
    content.stopRecording();
    expect(content.isRecording).toBe(false);
  });
});
```

`recordCase` is already imported at the top of that test file by CLUE-740. If it is not, add
`import { recordCase } from "./utilities/recording-utilities";`.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx jest src/plugins/dataflow/model/dataflow-content.test.ts -t "startRecording"
```

Expected: FAIL — `content.startRecording is not a function`.

- [ ] **Step 3: Add the volatile flag**

In `src/plugins/dataflow/model/dataflow-content.ts`, in the `.volatile(self => ({...}))` block
(it begins with `metadata: undefined as any as ITileMetadataModel,`), add:

```ts
    // Volatile (not persisted): a reload must not resume a run. Lives on the model rather than in
    // DataflowProgram's React state so the tile toolbar's buttons can reach it -- a toolbar button
    // renders from a different component tree and cannot see that state. (CLUE-771)
    isRecording: false,
```

- [ ] **Step 4: Add the actions**

These go in **a new `.actions(self => ({...}))` block appended after the one holding
`resetRecording`**, not inside it. Within a single actions block, MST's `self` does not include the
actions that block is defining, so `self.prepareCapture()` would not type-check from the block that
defines `prepareCapture` — it works at runtime, which makes this a types-only failure that Jest
will not catch. Run `npx tsc --noEmit -p tsconfig.json`.

```ts
  // Its own block so `self` can see prepareCapture: within one .actions() block, `self` does not
  // include the actions that block is defining.
  .actions(self => ({
    startRecording() {
      // Only when there is nothing to keep, so a run started after single samples appends to them
      // rather than discarding them. prepareCapture is idempotent, so re-preparing an already
      // prepared capture keeps the attribute ids a linked table is holding.
      if (self.dataSet.cases.length === 0) self.prepareCapture();
      self.isRecording = true;
    },
    stopRecording() {
      self.isRecording = false;
    },
  }));
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx jest src/plugins/dataflow/model/dataflow-content.test.ts -t "startRecording"
```

Expected: PASS, 4 tests.

- [ ] **Step 6: Mutation-test**

Change `if (self.dataSet.cases.length === 0) self.prepareCapture();` to
`self.prepareCapture();` (unconditional) and run the tests again. Expected: **"keeps the original
capture time when it appends" FAILS** — the name picks up the current wall-clock time instead of
14:32:07.

The other two tests will still pass under that mutation, and that is expected: `prepareCapture` is
idempotent about columns and never touches cases, so the dataset's name is the only thing the
outer guard changes. Restore the guard and confirm all four pass.

- [ ] **Step 7: Commit**

```bash
git add src/plugins/dataflow/model/dataflow-content.ts src/plugins/dataflow/model/dataflow-content.test.ts
git commit -m "CLUE-771: lift recording state into the content model"
```

---

## Task 2: Point the Table It guard at `isRecording`

`recordedRun` has two readers: this guard, and `hasRecordedRun` -> `determineProgramMode`. Only the
first can move now — deleting the property while `determineProgramMode` still reads it would leave
the branch broken between here and Task 8, so the property itself is retired there, in the same
commit that deletes the state machine it serves.

**Files:**
- Modify: `src/plugins/dataflow/components/toolbar/dataflow-table-buttons.tsx:40-45`

- [ ] **Step 1: Repoint the guard**

Replace lines 40-45:

```tsx
  // `recordedRun` guards the window between a recording starting and its first tick: the columns
  // are already prepared but no rows exist yet, and re-preparing would clear the flag and leave
  // the program in Ready when the recording stops.
  if (content.dataSet.cases.length === 0 && !content.recordedRun) {
    content.prepareCapture();
  }
```

with:

```tsx
  // `isRecording` guards the window between a run starting and its first tick: the columns are
  // already prepared but no rows exist yet, and re-preparing would restamp the capture's name.
  if (content.dataSet.cases.length === 0 && !content.isRecording) {
    content.prepareCapture();
  }
```

- [ ] **Step 2: Run the toolbar tests**

```bash
npx jest src/plugins/dataflow/components/toolbar/
npx tsc --noEmit -p tsconfig.json
```

Expected: PASS, no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/dataflow/components/toolbar/dataflow-table-buttons.tsx
git commit -m "CLUE-771: guard Table It's prepare window with isRecording"
```

---

## Task 3: Add `ToolbarBusyContext`

Two of dataflow's toolbar buttons (`data-set-view`, `data-set-link`) are shared components other
tiles also use, and the zoom/pan buttons don't consult `useReadOnlyContext`, so there is no way to
disable them all from dataflow without a shared mechanism.

**Files:**
- Modify: `src/components/toolbar/tile-toolbar-context.ts`
- Modify: `src/components/toolbar/tile-toolbar-button.tsx`
- Test: `src/components/toolbar/tile-toolbar.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `src/components/toolbar/tile-toolbar.test.tsx`. Add
`import { ToolbarBusyContext } from "./tile-toolbar-context";` and
`import { TileToolbarButton } from "./tile-toolbar-button";` to its imports.

```tsx
describe("ToolbarBusyContext", () => {
  function renderButton(busy: boolean, exempt?: string[]) {
    render(
      <ToolbarBusyContext.Provider value={{ busy, exempt }}>
        <TileToolbarButton name="zoom-in" title="Zoom In" onClick={jest.fn()}>x</TileToolbarButton>
      </ToolbarBusyContext.Provider>
    );
    return screen.getByRole("button");
  }

  it("leaves buttons alone when nothing is busy", () => {
    expect(renderButton(false).getAttribute("aria-disabled")).toBeNull();
  });

  it("disables a button while the tile is busy", () => {
    expect(renderButton(true).getAttribute("aria-disabled")).toBe("true");
  });

  it("leaves an exempt button enabled", () => {
    expect(renderButton(true, ["zoom-in"]).getAttribute("aria-disabled")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx jest src/components/toolbar/tile-toolbar.test.tsx -t "ToolbarBusyContext"
```

Expected: FAIL — `ToolbarBusyContext` is not exported from `./tile-toolbar-context`.

- [ ] **Step 3: Add the context**

Append to `src/components/toolbar/tile-toolbar-context.ts`:

```ts
/**
 * Lets a tile that is mid-operation disable its whole toolbar while naming the controls that stay
 * live. Dataflow uses it so that Stop is the only thing clickable during a recording, which it
 * cannot do by editing the buttons: `data-set-view` and `data-set-link` are shared with other tile
 * types, and the zoom/pan buttons don't consult the read-only context.
 *
 * The default must stay inert -- every tile's toolbar buttons run this check.
 */
export interface IToolbarBusyState {
  busy: boolean;
  exempt?: string[];   // button names that stay enabled
}

export const ToolbarBusyContext = React.createContext<IToolbarBusyState>({ busy: false });
```

If that file does not already import React, add `import React from "react";` at the top.

- [ ] **Step 4: Honor it in the button**

In `src/components/toolbar/tile-toolbar-button.tsx`, add `useContext` to the React import and
`import { ToolbarBusyContext } from "./tile-toolbar-context";`. Inside the component, after
`const tooltip = formatTooltip(title, keyHint);`, add:

```tsx
  // A tile mid-operation (dataflow while recording) disables everything but the controls it exempts.
  const { busy, exempt } = useContext(ToolbarBusyContext);
  const isDisabled = disabled || (busy && !exempt?.includes(name));
```

Then replace every use of `disabled` in the returned JSX with `isDisabled` — the `classNames`
call, `aria-disabled`, and the five handler ternaries. Leave the `disabled` prop destructuring
alone.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx jest src/components/toolbar/tile-toolbar.test.tsx
```

Expected: PASS, including the file's pre-existing tests.

- [ ] **Step 6: Mutation-test**

Change `const isDisabled = disabled || (busy && !exempt?.includes(name));` to
`const isDisabled = disabled;` and rerun. Expected: "disables a button while the tile is busy"
FAILS. Then change it to `disabled || busy` and rerun. Expected: "leaves an exempt button enabled"
FAILS. Restore and confirm all three pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/toolbar/
git commit -m "CLUE-771: add ToolbarBusyContext so a tile can disable its toolbar"
```

---

## Task 4: Create the record and stop buttons

**Files:**
- Create: `src/plugins/dataflow/components/toolbar/dataflow-recording-buttons.tsx`
- Create: `src/plugins/dataflow/components/toolbar/dataflow-recording-buttons.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/plugins/dataflow/components/toolbar/dataflow-recording-buttons.test.tsx`:

```tsx
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "mobx-react";
import { ModalProvider } from "react-modal-hook";

import { TileModelContext } from "../../../../components/tiles/tile-api";
import { ReadOnlyContext } from "../../../../components/document/read-only-context";
import { createDocumentModel } from "../../../../models/document/document";
import { ProblemDocument } from "../../../../models/document/document-types";
import { specStores } from "../../../../models/stores/spec-stores";
import { registerTileTypes } from "../../../../register-tile-types";
import { DataflowContentModelType } from "../../model/dataflow-content";
import { ClearButton, RecordButton, StopButton } from "./dataflow-recording-buttons";

jest.mock("firebase/app", () => ({
  functions: () => ({ httpsCallable: () => jest.fn() })
}));

registerTileTypes(["Dataflow", "Table"]);

function setup(Component: typeof RecordButton, readOnly = false) {
  const docModel = createDocumentModel({
    uid: "1", type: ProblemDocument, key: "test",
    content: { tiles: [{ id: "df1", content: { type: "Dataflow" } }] } as any
  });
  const tile = docModel.content!.tileMap.get("df1")!;
  const content = tile.content as DataflowContentModelType;
  content.program.addNodeSnapshot({
    id: "node-0", name: "Number", x: 0, y: 0,
    data: { type: "Number", orderedDisplayName: "Sensor" }
  } as any);

  render(
    <ModalProvider>
      <Provider stores={specStores()}>
        <ReadOnlyContext.Provider value={readOnly}>
          <TileModelContext.Provider value={tile}>
            <Component name="test-button" />
          </TileModelContext.Provider>
        </ReadOnlyContext.Provider>
      </Provider>
    </ModalProvider>
  );
  return { content, button: screen.getByRole("button") };
}

describe("RecordButton", () => {
  it("starts a recording and prepares the capture", () => {
    const { button, content } = setup(RecordButton);
    fireEvent.click(button);
    expect(content.isRecording).toBe(true);
    expect(content.dataSet.attributes.map(a => a.name)).toEqual(["Point", "Sensor"]);
  });

  it("is disabled while a recording is running", () => {
    const { button, content } = setup(RecordButton);
    content.startRecording();
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

  it("is disabled in a read-only view", () => {
    const { button } = setup(RecordButton, true);
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });
});

describe("StopButton", () => {
  it("is disabled until a recording is running", () => {
    const { button } = setup(StopButton);
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

  it("ends the recording", () => {
    const { button, content } = setup(StopButton);
    content.startRecording();
    fireEvent.click(button);
    expect(content.isRecording).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx jest src/plugins/dataflow/components/toolbar/dataflow-recording-buttons.test.tsx
```

Expected: FAIL — cannot resolve `./dataflow-recording-buttons`.

- [ ] **Step 3: Write the component file**

Create `src/plugins/dataflow/components/toolbar/dataflow-recording-buttons.tsx`:

```tsx
import React, { useContext } from "react";
import { observer } from "mobx-react";

import { TileModelContext } from "../../../../components/tiles/tile-api";
import { useReadOnlyContext } from "../../../../components/document/read-only-context";
import { TileToolbarButton } from "../../../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../../components/toolbar/toolbar-button-manager";
import { DataflowContentModelType } from "../../model/dataflow-content";

import RecordIcon from "../../assets/topbar-buttons/record-icon.svg";
import StopIcon from "../../assets/topbar-buttons/stop-icon.svg";
import ClearIcon from "../../assets/topbar-buttons/clear-icon.svg";

function useRecordingContent() {
  const tile = useContext(TileModelContext);
  const readOnly = useReadOnlyContext();
  return { content: tile?.content as DataflowContentModelType | undefined, readOnly };
}

/** Starts a run, appending to whatever the table already holds. */
export const RecordButton = observer(function RecordButton({ name }: IToolbarButtonComponentProps) {
  const { content, readOnly } = useRecordingContent();
  return (
    <TileToolbarButton
      name={name}
      title="Record data"
      onClick={() => content?.startRecording()}
      disabled={!content || readOnly || content.isRecording}
    >
      <RecordIcon />
    </TileToolbarButton>
  );
});

/** The only live control during a run -- see ToolbarBusyContext in dataflow-tile.tsx. */
export const StopButton = observer(function StopButton({ name }: IToolbarButtonComponentProps) {
  const { content, readOnly } = useRecordingContent();
  const recording = !!content?.isRecording;
  return (
    <TileToolbarButton
      name={name}
      title="Stop recording"
      onClick={() => content?.stopRecording()}
      highlighted={recording}
      disabled={!content || readOnly || !recording}
      disabledMessage="Start a recording to enable this action"
    >
      <StopIcon />
    </TileToolbarButton>
  );
});

/**
 * Parts the program from its recording. Calls detachLinkedTables directly rather than through a
 * wrapper action: that method calls withoutUndo(), which MST ignores (with a warning) when it runs
 * inside a child action, and putting the detach back on the undo stack reintroduces the "Not a
 * child" crash CLUE-740 documented.
 *
 * Non-destructive, so no confirmation: the linked table keeps the student's points and the program
 * gets a fresh dataset. Where nothing is following, detachLinkedTables empties the dataset instead.
 */
export const ClearButton = observer(function ClearButton({ name }: IToolbarButtonComponentProps) {
  const { content, readOnly } = useRecordingContent();
  const hasData = !!content && content.dataSet.cases.length > 0;
  return (
    <TileToolbarButton
      name={name}
      title="Clear recording"
      onClick={() => content?.detachLinkedTables()}
      disabled={!content || readOnly || content.isRecording || !hasData}
      disabledMessage="Record some data to enable this action"
    >
      <ClearIcon />
    </TileToolbarButton>
  );
});
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx jest src/plugins/dataflow/components/toolbar/dataflow-recording-buttons.test.tsx
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Mutation-test**

In `StopButton`, change `disabled={!content || readOnly || !recording}` to
`disabled={!content || readOnly}` and rerun. Expected: "is disabled until a recording is running"
FAILS. In `RecordButton`, change `disabled={!content || readOnly || content.isRecording}` to
`disabled={!content || readOnly}` and rerun. Expected: "is disabled while a recording is running"
FAILS. Restore both.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/dataflow/components/toolbar/dataflow-recording-buttons.tsx \
        src/plugins/dataflow/components/toolbar/dataflow-recording-buttons.test.tsx
git commit -m "CLUE-771: add record, stop and clear toolbar buttons"
```

---

## Task 5: Test and verify the Clear button

Task 4 wrote `ClearButton` but tested only Record and Stop, because Clear needs a document with a
linked Table tile.

**Files:**
- Test: `src/plugins/dataflow/components/toolbar/dataflow-recording-buttons.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `dataflow-recording-buttons.test.tsx`. Add
`import { recordCase } from "../../model/utilities/recording-utilities";` and
`import { uniqueId } from "../../../../utilities/js-utils";` to its imports.

```tsx
/** A real document with a Table tile, because Clear's behavior is about the link between them. */
function setupWithTable() {
  const docModel = createDocumentModel({
    uid: "1", type: ProblemDocument, key: "test",
    content: { tiles: [
      { id: "df1", content: { type: "Dataflow" } },
      { id: "table1", content: { type: "Table" } }
    ] } as any
  });
  const docContent = docModel.content!;
  const tile = docContent.tileMap.get("df1")!;
  const content = tile.content as DataflowContentModelType;
  content.program.addNodeSnapshot({
    id: "node-0", name: "Number", x: 0, y: 0,
    data: { type: "Number", orderedDisplayName: "Sensor" }
  } as any);
  content.program.addNewTick(uniqueId());
  content.program.nodes.get("node-0")?.data.setNodeValue(400);
  content.addLinkedTile("table1");
  content.prepareCapture();
  recordCase(content);

  const tableContent = docContent.tileMap.get("table1")!.content as any;
  render(
    <ModalProvider>
      <Provider stores={specStores()}>
        <ReadOnlyContext.Provider value={false}>
          <TileModelContext.Provider value={tile}>
            <ClearButton name="test-button" />
          </TileModelContext.Provider>
        </ReadOnlyContext.Provider>
      </Provider>
    </ModalProvider>
  );
  return { content, tableContent, button: screen.getByRole("button") };
}

describe("ClearButton", () => {
  it("is disabled when nothing has been recorded", () => {
    const { button } = setup(ClearButton);
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

  it("is disabled while a recording is running", () => {
    const { content, button } = setupWithTable();
    content.startRecording();
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

  // Non-destructive: the table keeps the student's points, the program walks away from them.
  it("leaves the linked table's data intact and unlinks the program", () => {
    const { content, tableContent, button } = setupWithTable();
    expect(content.linkedTableTileId).toBe("table1");

    fireEvent.click(button);

    expect(tableContent.dataSet.cases).toHaveLength(1);
    expect(content.linkedTableTileId).toBeUndefined();
    expect(content.dataSet.cases).toHaveLength(0);
  });

  it("disables itself once the recording is cleared", () => {
    const { button } = setupWithTable();
    fireEvent.click(button);
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
npx jest src/plugins/dataflow/components/toolbar/dataflow-recording-buttons.test.tsx -t "ClearButton"
```

Expected: PASS, 4 tests — `ClearButton` was written in Task 4. If "leaves the linked table's data
intact" fails with the table holding 0 cases, the detach ran the no-followers branch; check that
`content.addLinkedTile("table1")` ran before `prepareCapture()`.

- [ ] **Step 3: Mutation-test**

Change `disabled={!content || readOnly || content.isRecording || !hasData}` to
`disabled={!content || readOnly}` and rerun. Expected: "is disabled when nothing has been
recorded", "is disabled while a recording is running", and "disables itself once the recording is
cleared" all FAIL. Restore and confirm all four pass.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/dataflow/components/toolbar/dataflow-recording-buttons.test.tsx
git commit -m "CLUE-771: cover the clear button's non-destructive detach"
```

---

## Task 6: Register the buttons and configure the units

**Files:**
- Modify: `src/plugins/dataflow/dataflow-toolbar-registration.tsx`
- Modify: `src/clue/app-config.json`
- Modify: `src/public/demo/units/qa-dataflow-link/content.json`

- [ ] **Step 1: Register the three buttons**

In `src/plugins/dataflow/dataflow-toolbar-registration.tsx`, add to the imports:

```tsx
import { ClearButton, RecordButton, StopButton }
  from "./components/toolbar/dataflow-recording-buttons";
```

and add these entries to the `registerTileToolbarButtons('dataflow', [...])` array, immediately
after the `record-sample` entry:

```tsx
  {
    name: "record",
    component: RecordButton
  },
  {
    name: "stop",
    component: StopButton
  },
  {
    name: "clear",
    component: ClearButton
  },
```

- [ ] **Step 2: Add them to the default tools list**

In `src/clue/app-config.json`, find the `"dataflow"` settings block's `"tools"` array, which begins
`"table-it",`. Insert after `"record-sample",`:

```json
          "record",
          "stop",
          "clear",
```

- [ ] **Step 3: Add them to the QA unit**

In `src/public/demo/units/qa-dataflow-link/content.json`, replace the dataflow `"tools"` line:

```json
        "tools": ["table-it", ["data-set-view", "Graph"], ["data-set-link", "Graph"],
                  "record", "stop", "clear",
                  "delete", "group", "ungroup", "|", "zoom-in", "zoom-out", "fit-all", "pan"]
```

No curriculum unit overrides the dataflow tools list and no other demo unit does, so the default
covers everything else.

- [ ] **Step 4: Verify the config parses and types check**

```bash
node -e "JSON.parse(require('fs').readFileSync('src/clue/app-config.json','utf8')); \
         JSON.parse(require('fs').readFileSync('src/public/demo/units/qa-dataflow-link/content.json','utf8')); \
         console.log('both parse')"
npx tsc --noEmit -p tsconfig.json
```

Expected: `both parse`, and no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/dataflow/dataflow-toolbar-registration.tsx src/clue/app-config.json \
        src/public/demo/units/qa-dataflow-link/content.json
git commit -m "CLUE-771: register record, stop and clear in the dataflow toolbar"
```

---

## Task 7: Provide the busy context from the tile

**Files:**
- Modify: `src/plugins/dataflow/components/dataflow-tile.tsx:166`

- [ ] **Step 1: Wrap the toolbar**

Add to the imports in `src/plugins/dataflow/components/dataflow-tile.tsx`:

```tsx
import { ToolbarBusyContext } from "../../../components/toolbar/tile-toolbar-context";
```

Replace line 166:

```tsx
          <TileToolbar tileType="dataflow" readOnly={!!readOnly} tileElement={this.props.tileElt} />
```

with:

```tsx
          {/* During a run Stop is the only live control. Context reaches the toolbar through the
              FloatingPortal it renders into, because a portal preserves the React tree. */}
          <ToolbarBusyContext.Provider value={{ busy: tileContent.isRecording, exempt: ["stop"] }}>
            <TileToolbar tileType="dataflow" readOnly={!!readOnly} tileElement={this.props.tileElt} />
          </ToolbarBusyContext.Provider>
```

`tileContent` is already in scope in that render method — it is passed to `DataflowProgram` on the
line above.

- [ ] **Step 2: Check the value is re-read when it changes**

`DataflowTileComponent` must be a MobX `observer` for `tileContent.isRecording` to re-render the
provider. Confirm with:

```bash
grep -n "@observer\|observer(" src/plugins/dataflow/components/dataflow-tile.tsx | head -3
```

Expected: an `@observer` decorator on the class. If it is absent, add `@observer` above the class
declaration and `import { observer } from "mobx-react";`.

- [ ] **Step 3: Verify types**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/dataflow/components/dataflow-tile.tsx
git commit -m "CLUE-771: disable the dataflow toolbar except Stop while recording"
```

---

## Task 8: Delete playback and the state machine

The largest task. Nothing new is added; `DataflowProgram` stops owning recording state.

**Files:**
- Modify: `src/plugins/dataflow/components/dataflow-program.tsx`
- Modify: `src/plugins/dataflow/components/types/dataflow-tile-types.ts`
- Modify: `src/plugins/dataflow/model/dataflow-program-model.ts:265`

- [ ] **Step 1: Shrink the component's state**

In `src/plugins/dataflow/components/dataflow-program.tsx`, change `interface IState` to:

```tsx
interface IState {
  editorContainerWidth: number;
  lastIntervalDuration: number;
}
```

and the constructor's `this.state` to:

```tsx
    this.state = {
      editorContainerWidth: 0,
      lastIntervalDuration: 0,
    };
```

- [ ] **Step 2: Delete the playback members**

Remove these declarations and every use of them:
- `private playbackToolDiv: HTMLDivElement | null;`
- `private playbackReteManager: ReteManager | undefined;`

In `componentWillUnmount`, delete the two lines `this.playbackReteManager?.dispose();` and
`this.playbackReteManager = undefined;`.

In `initReteManagersIfNeeded`, delete the whole `if (!this.playbackReteManager && this.playbackToolDiv) { ... }`
block, leaving only the `if (!this.reteManager && this.toolDiv) { this.initProgram(); }` guard.

Change `activeReteManager` from `return this.playbackReteManager ?? this.reteManager;` to
`return this.reteManager;`.

Delete the methods `playbackNodesWithCaseData`, `incrementPlayBackIndex`, `incrementRecordIndex`,
`handleChangeIsPlaying`, `stopRecording`, `handleChangeOfProgramMode` and `determineProgramMode`.

- [ ] **Step 3: Rewrite the tick**

Replace the `switch (programMode) { ... }` block in `tick()` with:

```tsx
    reteManager.tickAndProcessNodes();
    if (tileContent.isRecording && !readOnly) {
      recordCase(tileContent);
      // The cap is 10000/(nodes + 1) cases, so a long run ends itself rather than growing forever.
      if (tileContent.dataSet.cases.length >= tileContent.maxRecordableCases) {
        tileContent.stopRecording();
      }
    }
    reteManager.updateSharedProgramData();
```

The names `tileContent` and `readOnly` come from `this.props`; destructure them at the top of
`tick()` if they are not already. Delete the now-unused `const dataSet = tileContent.dataSet;` and
`const programMode = this.determineProgramMode();` lines from that method.

- [ ] **Step 4: Rewrite the render**

In `render()`, delete `const { playBackIndex, isPlaying } = this.state;` and
`const programMode = this.determineProgramMode();`, and add:

```tsx
    const isRecording = tileContent.isRecording;
```

Change `showProgramToolbar` to `const showProgramToolbar = !isRecording;`.

In the `<DataflowProgramTopbar ... />` element, delete the props `programMode`, `playBackIndex`,
`isPlaying`, `handleChangeIsPlaying` and `handleChangeOfProgramMode`.

In the editor markup, change the flow-tool div to `className="flow-tool"` with no conditional, and
delete the `{ programMode === ProgramMode.Done && <div className="flow-tool" ref={...playbackToolDiv} /> }`
block. Change the groups overlay guard from
`{ this.reteManager && programMode !== ProgramMode.Done && <DataflowGroupsOverlay .../> }` to
`{ this.reteManager && <DataflowGroupsOverlay reteManager={this.reteManager} /> }`.

- [ ] **Step 5: Rewrite the cover**

```tsx
  private shouldShowProgramCover() {
    // Only while a run is in progress. A finished recording leaves the program editable, and
    // editing it detaches the capture rather than being blocked (CLUE-740).
    return this.props.readOnly || this.props.tileContent.isRecording;
  }
```

Delete the `inDisabledRecordingState` getter.

- [ ] **Step 6: Retire `recordedRun`**

Now that `determineProgramMode` is gone, nothing reads it. First confirm it never shipped, because
removing a persisted property breaks history replay for any document that saved one — the
`programZoom` comment in `dataflow-content.ts` explains the failure mode:

```bash
git log origin/master --oneline | grep -ci "CLUE-740"
gh pr view 3069 --json mergedAt
```

- **`0` and `"mergedAt": null`** — it never shipped. Delete from
  `src/plugins/dataflow/model/dataflow-content.ts`: the property
  `recordedRun: types.maybe(types.boolean),`, the `hasRecordedRun` view with its
  `/** Falls back to the row count ... */` comment, the `setRecordedRun` action, and the
  `self.recordedRun = false;` line in each of `prepareCapture` and `resetRecording`.
- **Anything else** — it shipped. Keep the property, with this comment replacing its current one,
  and delete only the view, the action and the two assignments:

```ts
    // Deprecated (CLUE-771): nothing reads this any more. The property stays because CLUE's
    // history replay resolves patches by path, so a saved entry naming /recordedRun would stop
    // resolving and halt playback -- see the programZoom comment above.
    recordedRun: types.maybe(types.boolean),
```

Delete any test referring to `recordedRun`, `setRecordedRun` or `hasRecordedRun`.

- [ ] **Step 7: Delete the enum and the model method**

In `src/plugins/dataflow/components/types/dataflow-tile-types.ts`, delete the `ProgramMode` enum,
leaving `UpdateMode`.

In `src/plugins/dataflow/model/dataflow-program-model.ts`, delete the `playbackNodesWithCaseData`
action at line 265.

- [ ] **Step 8: Verify nothing still references the deletions**

```bash
grep -rn "ProgramMode\|playbackReteManager\|playBackIndex\|playbackNodesWithCaseData\|isPlaying" \
  src/plugins/dataflow/ | grep -v node_modules
```

Expected: only hits inside `dataflow-program-topbar.tsx` and `dataflow-rateselector-playback.tsx`,
which Task 9 rewrites. Anything else must be cleaned up now.

- [ ] **Step 9: Commit**

```bash
git add src/plugins/dataflow/
git commit -m "CLUE-771: delete playback and the ProgramMode state machine"
```

---

## Task 9: Restyle the header

**Files:**
- Create: `src/plugins/dataflow/components/ui/dataflow-sampling-rate.tsx`
- Delete: `src/plugins/dataflow/components/ui/dataflow-rateselector-playback.tsx`
- Modify: `src/plugins/dataflow/components/ui/dataflow-rateselector-playback.scss` (rename)
- Modify: `src/plugins/dataflow/components/ui/dataflow-program-topbar.tsx`

- [ ] **Step 1: Write the failing test**

`src/plugins/dataflow/components/ui/dataflow-program-topbar.test.tsx` has a `renderTopbar(readOnly,
tools?)` helper that creates its content inline as `tileContent={DataflowContentModel.create()}`.
The new test needs a handle on that model, so hoist it and return it. Change the helper's signature
and its return:

```tsx
function renderTopbar(readOnly: boolean, tools?: string[]) {
  const stores = specStores(
    tools ? { appConfig: specAppConfig({ config: { settings: { dataflow: { tools } } } }) } : undefined
  );
  const tileContent = DataflowContentModel.create();
  const result = render(
    // ...unchanged JSX, except: tileContent={tileContent}
  );
  return { ...result, tileContent };
}
```

Delete the `programMode`, `playBackIndex`, `isPlaying`, `handleChangeIsPlaying` and
`handleChangeOfProgramMode` props from that JSX and the `ProgramMode` import, since Task 8 deleted
the enum. Then add `act` to the `@testing-library/react` import and add:

```tsx
describe("DataflowProgramTopbar while recording", () => {
  it("disables the rate selector and shows the elapsed time", () => {
    const { tileContent } = renderTopbar(false);
    expect(screen.getByTestId("rate-select")).toBeEnabled();
    expect(screen.queryByTestId("recording-elapsed")).toBeNull();

    act(() => { tileContent.startRecording(); });

    expect(screen.getByTestId("rate-select")).toBeDisabled();
    expect(screen.getByTestId("recording-elapsed")).toBeInTheDocument();
  });
});
```

Also delete the two `expect(screen.getByTestId("record-data-button"))` lines from the existing
read-only tests — that button no longer exists.

`rate-select` is a native `<select>`, so `toBeDisabled()` is correct here — unlike toolbar buttons,
which use `aria-disabled`.

- [ ] **Step 2: Run it to verify it fails**

```bash
npx jest src/plugins/dataflow/components/ui/dataflow-program-topbar.test.tsx -t "elapsed"
```

Expected: FAIL — no element with testid `recording-elapsed`.

- [ ] **Step 3: Create the new component**

Create `src/plugins/dataflow/components/ui/dataflow-sampling-rate.tsx`:

```tsx
import React from "react";
import { observer } from "mobx-react";
import { ProgramDataRate } from "../../model/utilities/node";
import { DataflowContentModelType } from "../../model/dataflow-content";
import { useReadOnlyContext } from "../../../../components/document/read-only-context";

import "./dataflow-sampling-rate.scss";

interface ISamplingRateProps {
  rateOptions: ProgramDataRate[];
  dataRate: number;
  onRateSelectClick: (rate: number) => void;
  tileContent: DataflowContentModelType;
}

/**
 * The header's whole content: the sampling rate, and while a run is in progress the time elapsed
 * so far. The rate stays visible but disabled during a run so a student can still see what they
 * are recording at. (CLUE-771 replaced the slider and playback readout this file used to hold.)
 */
export const DataflowSamplingRate = observer(function DataflowSamplingRate(props: ISamplingRateProps) {
  const { onRateSelectClick, dataRate, rateOptions, tileContent } = props;
  const readOnly = useReadOnlyContext();
  const recording = tileContent.isRecording;

  return (
    <>
      <div className="topbar-sampleratetext">
        <label className="samplerate-label" htmlFor="rate-select">Sampling Rate</label>
      </div>
      <div className="topbar-datarate">
        <select
          onChange={e => onRateSelectClick(Number(e.target.value))}
          disabled={readOnly || recording}
          value={dataRate.toString()}
          id="rate-select" // TODO: The id needs to be unique to the particular DF tile
          data-testid="rate-select"
        >
          {rateOptions.map((rate: ProgramDataRate) => (
            <option key={rate.text} value={rate.val} disabled={rate.disabled}>{rate.text}</option>
          ))}
        </select>
      </div>
      {recording &&
        <div className="recording-elapsed" data-testid="recording-elapsed">
          {tileContent.durationOfRecordingFormatted}
        </div>}
    </>
  );
});
```

- [ ] **Step 4: Rename the stylesheet and update its selectors**

```bash
git mv src/plugins/dataflow/components/ui/dataflow-rateselector-playback.scss \
       src/plugins/dataflow/components/ui/dataflow-sampling-rate.scss
git rm src/plugins/dataflow/components/ui/dataflow-rateselector-playback.tsx
```

In the renamed stylesheet, delete the `.slider-container`, `.countdown-timer` and any `rc-slider`
rules, rename `.topbar-sampleratetext-or-timeslider` to `.topbar-sampleratetext` and
`.topbar-datarate-or-timer` to `.topbar-datarate`, and add:

```scss
.recording-elapsed {
  font-variant-numeric: tabular-nums;   // the readout updates every tick; keep it from jittering
  margin-left: 8px;
}
```

`rc-slider` stays in `package.json` — `src/components/playback/` still uses it.

- [ ] **Step 5: Rewrite the topbar**

In `src/plugins/dataflow/components/ui/dataflow-program-topbar.tsx`:

- Change the import to `import { DataflowSamplingRate } from "./dataflow-sampling-rate";`
- Delete the imports of `RecordIcon`, `StopIcon`, `PlayIcon`, `PauseIcon`, `ClearIcon`,
  `useCautionAlert` and `ProgramMode`
- Delete `RecordStopOrClearButton`, `PlaybackButton`, the `Mode` enum, `iconArr`,
  `IRecordStopOrClearProps` and `IPlaybackProps`
- Delete from `TopbarProps`: `handleChangeOfProgramMode`, `programMode`, `playBackIndex`,
  `isPlaying`, `handleChangeIsPlaying`
- Replace the `topbar-center-container` contents with:

```tsx
        <div className="topbar-center-container">
          <DataflowSamplingRate
            rateOptions={programDataRates}
            dataRate={dataRate}
            onRateSelectClick={onRateSelectClick}
            tileContent={tileContent}
          />
        </div>
```

- Delete the `.topbar-blank-or-play` rules from `dataflow-program-topbar.scss`, along with the
  `.record-btn-container` and `.playback-btn-container` rules.

- [ ] **Step 6: Run the tests**

```bash
npx jest src/plugins/dataflow/
npx tsc --noEmit -p tsconfig.json
```

Expected: PASS and no type errors. Delete any topbar test that asserts on the record or playback
buttons — those components no longer exist.

- [ ] **Step 7: Mutation-test**

Change `disabled={readOnly || recording}` to `disabled={readOnly}` and rerun the topbar test.
Expected: the elapsed-time test FAILS on the `toBeDisabled()` assertion. Restore.

- [ ] **Step 8: Commit**

```bash
git add -A src/plugins/dataflow/components/ui/
git commit -m "CLUE-771: restyle the header to the sampling rate and elapsed time"
```

---

## Task 10: Update the Cypress helpers and specs

**Files:**
- Modify: `cypress/support/elements/tile/DataflowToolTile.js`
- Modify: `cypress/e2e/functional/tile_tests/dataflow_table_graph_integration_test_spec.js`
- Modify: `cypress/e2e/functional/tile_tests/dataflow_tool_spec.js`

- [ ] **Step 1: Point the helpers at the toolbar**

In `cypress/support/elements/tile/DataflowToolTile.js`, add:

```js
  getRecordButton() {
    return cy.get('.primary-workspace .tile-toolbar.dataflow-toolbar .toolbar-button.record');
  }
  getStopButton() {
    return cy.get('.primary-workspace .tile-toolbar.dataflow-toolbar .toolbar-button.stop');
  }
  getClearButton() {
    return cy.get('.primary-workspace .tile-toolbar.dataflow-toolbar .toolbar-button.clear');
  }
```

Replace the existing `getRecordButton` and `getStopButton` (which find topbar buttons by their
text) with the three above. The elapsed readout keeps the same `000:0N` format that
`durationOfRecordingFormatted` produces, so only its selector changes:

```js
  getCountdownTimer(options={}) {
    return cy.get(".primary-workspace .program-editor-topbar .recording-elapsed", options);
  }
```

Rewrite the three recording helpers. The tile toolbar renders only for the **selected** tile, so
each must select the dataflow tile first:

```js
  recordData(samplingRate, timer) {
    this.recordDataWithoutStop(samplingRate, timer);
    this.getStopButton().click();
  }
  recordDataWithoutStop(samplingRate, timer) {
    this.selectSamplingRate(samplingRate);
    this.getDataflowTile().click();     // the toolbar renders only for the selected tile
    this.getRecordButton().click();
    this.getCountdownTimer({timeout: (timer + 2) * 1000}).should("contain", "000:0" + timer.toString());
  }
  // No modal any more: Clear hands the linked table its points rather than destroying them.
  clearRecordedData() {
    this.getDataflowTile().click();
    this.getClearButton().click();
  }
```

Replace `checkInitialStateButtons`, which asserts on buttons that no longer exist, with:

```js
  checkInitialStateButtons() {
    this.getSamplingRateLabel().should("have.text", "Sampling Rate");
    this.getRecordButton().should("not.have.attr", "aria-disabled");
    this.getStopButton().should("have.attr", "aria-disabled", "true");
  }
```

Delete these methods and every call to them, since the controls they name are gone:
`verifyRecordButtonText`, `verifyRecordButtonIcon`, `verifyRecordButton`, `verifyPlayButtonText`,
`verifyPlayButtonIcon`, `getPlayButton`, `clickPlayButton`, `verifyPlayButtonDoesNotExist`,
`verifyPauseButtonText`, `verifyPauseButtonIcon`, `getPauseButton`, `clickPauseButton`,
`verifyPauseButtonDoesNotExist`, `getTimeSlider`, `verifyStopButtonText`, `verifyStopButtonIcon`,
`verifyStopButtonDoesNotExist`, `verifyRecordingClearButtonText`, `verifyRecordingClearButtonIcon`,
`getRecordingClearButton`, `verifyClearButtonDoesNotExist`, `verifyRecordingClearButton`,
`getClearDataWarningTitle`, `getClearDataWarningContent`, `getClearDataWarningCancel`,
`getClearDataWarningClear`, `checkRecordedStateButtons`.

- [ ] **Step 2: Rewrite the reload test**

In `dataflow_table_graph_integration_test_spec.js`, the test "verify the effect of page reload
cause on various button states and linked table state" asserts playback buttons at four points.
Replace each `dataflowToolTile.checkRecordedStateButtons();` with:

```js
    // After a reload the run is over -- isRecording is volatile, so nothing resumes.
    dataflowToolTile.getRecordButton().should("not.have.attr", "aria-disabled");
    dataflowToolTile.getStopButton().should("have.attr", "aria-disabled", "true");
    dataflowToolTile.getClearButton().should("not.have.attr", "aria-disabled");
```

Delete the two `dataflowToolTile.clickPlayButton();` / `clickPauseButton()` sequences and the
`cy.reload()` that follows each — they exercised playback, which no longer exists.

- [ ] **Step 3: Add a test for the busy toolbar**

Add to `dataflow_tool_spec.js`:

```js
  it("disables everything but Stop while recording", () => {
    beforeTest();
    clueCanvas.addTile("dataflow");
    dataflowToolTile.getDataflowTile().click();
    dataflowToolTile.getCreateNodeButton("number").click();

    dataflowToolTile.getRecordButton().click();
    dataflowToolTile.getStopButton().should("not.have.attr", "aria-disabled");
    dataflowToolTile.getRecordButton().should("have.attr", "aria-disabled", "true");
    dataflowToolTile.getClearButton().should("have.attr", "aria-disabled", "true");
    dataflowToolTile.getTableItButton().should("have.attr", "aria-disabled", "true");

    dataflowToolTile.getStopButton().click();
    dataflowToolTile.getRecordButton().should("not.have.attr", "aria-disabled");
    dataflowToolTile.getTableItButton().should("not.have.attr", "aria-disabled");
  });
```

`beforeTest`, `clueCanvas` and `dataflowToolTile` are already defined at the top of that spec.

- [ ] **Step 4: Check the specs compile, and leave the run to CI**

The Cypress suite runs on GitHub CI for this project, not locally. Verify only that the spec files
parse and that nothing still references a deleted helper:

```bash
npm run lint:build:cypress
grep -rn "clickPlayButton\|clickPauseButton\|checkRecordedStateButtons\|getRecordingClearButton\|getClearDataWarning\|verifyRecordButton\|getTimeSlider" cypress/
```

Expected: lint passes with no errors, and the grep returns nothing.

The keyboard spec's `focusOrder` should need no change: the toolbar is a single tab stop via roving
tabindex, so adding buttons doesn't add entries. CI will say otherwise if that's wrong.

- [ ] **Step 5: Commit**

```bash
git add cypress/
git commit -m "CLUE-771: move the Cypress recording helpers to the toolbar"
```

---

## Task 11: Finish the branch

- [ ] **Step 1: Run the full Jest suite**

```bash
npx jest
```

Expected: PASS. The one known skip is `dataflow-detach-undo.test.ts`'s "restores the node but
leaves the table detached", which CLUE-740 documented.

- [ ] **Step 2: Lint and typecheck**

```bash
npm run lint:build
npx tsc --noEmit -p tsconfig.json
```

Expected: 0 errors. Pre-existing warnings in files this branch doesn't touch are fine.

- [ ] **Step 3: Run the four lenses**

Use the `code-self-review` skill over `git diff master...HEAD`. This branch deletes a lot, so pay
particular attention to Lens 1 (comments left behind describing deleted behavior) and Lens 4
(whether `dataflow-recording-buttons.tsx` earned its existence — three registered buttons sharing a
hook, so yes).

- [ ] **Step 4: Check it by hand on localhost**

```bash
npm start > /tmp/clue-771-dev.log 2>&1 &
until grep -q "compiled successfully" /tmp/clue-771-dev.log; do sleep 3; done
```

Then walk the whole loop at http://localhost:8080/: record a run and confirm the toolbar greys out
except Stop; stop it and confirm the program is editable again and Clear is enabled; press Clear
and confirm the linked table keeps its points while the program's name loses its timestamp; record
again and confirm the new points append rather than restarting at 1.

This hand-check is the gate on pushing, because CI's Cypress run happens after the push, not
before.

- [ ] **Step 5: Open the PR**

Do not push until the hand-check passes and the user has okayed it.

Take the branch name from the **Create branch** field on
https://concord-consortium.atlassian.net/browse/CLUE-771 verbatim — a paraphrased name breaks the
Jira/Git integration, so the issue never links to the branch.

```bash
git push -u origin <the name Jira's Create branch field gives>
gh pr create --fill
```

Tick **run regression** on the PR so the full Cypress suite runs, and add the label Codecov needs
for a reliable project/patch report. Request a Copilot review on this first push — it does not
re-run on its own.

- [ ] **Step 6: Read the CI regression results**

This is where this branch's real coverage lives. CLUE-740 shipped three bugs that only the Cypress
specs caught — a double `prepareCapture` that blanked the linked table, a name sync that renamed a
node to "y", and stale toolbar selectors. Read every failure before assuming it is a flake, and
fix on the branch rather than retrying the job.

---

## Risks

- **The Cypress recording specs are the real coverage, and they run on CI after the push.** CLUE-740
  shipped three bugs that only the integration spec caught. The localhost hand-check in Task 11 is
  the only pre-push gate, so do it properly.
- **`ToolbarBusyContext` touches a shared component.** Every tile's toolbar buttons run the new
  check, so the inert default matters. Task 3's first test pins it.
- **`recordedRun`'s removal** is safe only while CLUE-740 is unreleased. Task 2 Step 1 checks.
