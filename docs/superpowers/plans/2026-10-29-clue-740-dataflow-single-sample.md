# CLUE-740: Table It and Record Single Sample in Dataflow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A student can capture one sample at a time from a Dataflow program into a table and compare captures, with Table It reusing an already-linked table rather than making a second one, and a table detaching from a program whose structure has changed under it.

**Architecture:** The first column becomes an ordinal point number and the capture's start time becomes the dataset's name, which `TableContentModel.contentTitle` already surfaces as the table's header — so no column has to hold an unreadable number and no date formatter is needed. A `linkedTableTileId` view on the content model is the one primitive both new buttons share. Dataflow gets its own `data-set-view` registration, which is per tile type and so reaches no other tile.

**Tech Stack:** TypeScript, React 18, MobX State Tree, Rete (Dataflow's node editor), Jest + @testing-library/react, Cypress.

**Spec:** `docs/superpowers/specs/2026-10-29-clue-740-dataflow-single-sample-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `src/plugins/dataflow/model/dataflow-content.ts` *(modify)* | `linkedTableTileId`, `captureName`, point-numbered column setup, `detachLinkedTables`, derived `getTimeAtRecordedIndex` |
| `src/plugins/dataflow/model/dataflow-content.test.ts` *(modify)* | Model-level tests for all of the above |
| `src/plugins/dataflow/model/utilities/recording-utilities.ts` *(modify)* | `recordCase` writes the point ordinal rather than quantized time |
| `src/plugins/dataflow/model/utilities/recording-utilities.test.ts` *(modify or create)* | Point ordinal, and node values landing in the right columns |
| `src/plugins/dataflow/components/toolbar/dataflow-table-buttons.tsx` *(create)* | Both new buttons: Dataflow's Table It and Record Single Sample |
| `src/plugins/dataflow/components/toolbar/dataflow-table-buttons.test.tsx` *(create)* | Button behavior: reuse vs create, sample append, disabled states |
| `src/plugins/dataflow/dataflow-toolbar-registration.tsx` *(modify)* | Point `data-set-view` at the Dataflow button; register `record-sample` |
| `src/clue/app-config.json` *(modify)* | Add `record-sample` after the two `data-set-view` entries |
| `src/plugins/dataflow/components/dataflow-program.tsx` *(modify)* | Stop clearing the dataset when a recording starts, so a run appends |
| `cypress/e2e/functional/tile_tests/dataflow_tool_spec.js` *(modify)* | The button appears in order and a sample reaches the table |

Both new buttons live in one file: they share the linked-table lookup and the column-setup call, and splitting them would mean exporting that shared helper purely so a second file could reach it.

---

## Task 1: `linkedTableTileId` — the lookup both buttons need

**Files:**
- Modify: `src/plugins/dataflow/model/dataflow-content.ts`
- Test: `src/plugins/dataflow/model/dataflow-content.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `dataflow-content.test.ts`. Write the three `setup*` helpers at the top of the describe
block — do not leave them as prose. Each builds a content model with a ready shared model manager
following the construction `dataflow-content.test.ts` already uses, and the linked variants then
call `sharedModelManager.addTileSharedModel(otherTileContent, content.sharedModel)` to attach a
Table (or Graph) tile to the program's dataset, returning that tile's id alongside the content.

```ts
describe("linkedTableTileId", () => {
  it("is undefined when no tile shares the program's dataset", () => {
    const content = setupContentWithSharedModel();
    expect(content.linkedTableTileId).toBeUndefined();
  });

  it("returns the id of a Table tile sharing the program's dataset", () => {
    const { content, tableTileId } = setupContentWithLinkedTable();
    expect(content.linkedTableTileId).toBe(tableTileId);
  });

  it("ignores a non-Table tile sharing the dataset", () => {
    const { content } = setupContentWithLinkedGraph();
    expect(content.linkedTableTileId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx jest src/plugins/dataflow/model/dataflow-content.test.ts -t "linkedTableTileId"
```

Expected: FAIL — `linkedTableTileId` is not a property of the content model.

- [ ] **Step 3: Implement**

In `dataflow-content.ts`, in the `.views` block that already holds `isLinkedToTile` (around line 220). `getTileModelById` is already imported from `../../../utilities/mst-utils`.

```ts
    /** The Table tile currently sharing this program's dataset, if any. Both Table It and
     * Record Single Sample key off this: one to avoid making a second table, the other to
     * know whether it has to make the first one. */
    get linkedTableTileId(): string | undefined {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const sharedModel = self.sharedModel;
      if (!sharedModelManager?.isReady || !sharedModel) return undefined;
      const tileIds = sharedModelManager.getSharedModelTileIds(sharedModel);
      return tileIds.find(id => getTileModelById(self, id)?.content.type === kTableTileType);
    },
```

Import the table type constant at the top of the file:

```ts
import { kTableTileType } from "../../../models/tiles/table/table-content";
```

If that export name differs, use whatever `table-content.ts` exports for the type literal — do not hard-code the string `"Table"` in the view.

- [ ] **Step 4: Run and watch it pass**

```bash
npx jest src/plugins/dataflow/model/dataflow-content.test.ts -t "linkedTableTileId"
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/dataflow/model/dataflow-content.ts src/plugins/dataflow/model/dataflow-content.test.ts
git commit -m "CLUE-740: add linkedTableTileId to the Dataflow content model"
```

---

## Task 2: Point-numbered columns and the capture name

**Files:**
- Modify: `src/plugins/dataflow/model/dataflow-content.ts`
- Test: `src/plugins/dataflow/model/dataflow-content.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe("prepareCapture", () => {
  it("builds a numeric point column followed by one column per named node", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.prepareCapture();
    expect(content.dataSet.attributes.map(a => a.name)).toEqual(["Point", "Sensor", "Servo"]);
  });

  it("names the dataset with the capture's start time", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.prepareCapture(new Date(2026, 9, 29, 14, 32, 7));
    expect(content.dataSet.name).toBe("Program data 14:32:07");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx jest src/plugins/dataflow/model/dataflow-content.test.ts -t "prepareCapture"
```

Expected: FAIL — `prepareCapture` is not a function.

- [ ] **Step 3: Implement**

Rename `prepareRecording` to `prepareCapture` (it is now used by capture paths other than recording) and give it the point column and the name. Replace the existing action in the final `.actions` block:

```ts
    /** Sets the table up for a fresh capture: a numeric point column, then one column per named
     * node. The capture's start time goes in the dataset's name rather than into a column --
     * TableContentModel.contentTitle surfaces that as the table's header, and the first column
     * has to stay numeric for the Graph tile's x-axis. */
    prepareCapture(startedAt: Date = new Date()) {
      self.clearAttributes();
      addAttributeToDataSet(self.dataSet, { name: kPointAttributeName });
      self.program.nodes.forEach((n) => {
        n.data.orderedDisplayName && self.addNewAttrFromNode(n.id, n.data.orderedDisplayName);
      });
      self.dataSet.setName(captureName(startedAt));
    },
```

Add near `defaultDataSet` at the top of the file:

```ts
export const kPointAttributeName = "Point";

/** `Program data 14:32:07`. The table's header, via TableContentModel.contentTitle. */
export function captureName(startedAt: Date) {
  const time = startedAt.toLocaleTimeString([], { hour12: false });
  return `Program data ${time}`;
}
```

Update the one existing caller in `dataflow-program.tsx` (`tileContent.prepareRecording()` in `handleChangeOfProgramMode`) to `tileContent.prepareCapture()`.

- [ ] **Step 4: Run and watch it pass**

```bash
npx jest src/plugins/dataflow/model/dataflow-content.test.ts -t "prepareCapture"
npx jest src/plugins/dataflow
```

Expected: both PASS. The second catches any other caller of the old name.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/dataflow
git commit -m "CLUE-740: point-numbered columns, with the capture time in the dataset name"
```

---

## Task 3: `recordCase` writes the point ordinal

**Files:**
- Modify: `src/plugins/dataflow/model/utilities/recording-utilities.ts`
- Test: `src/plugins/dataflow/model/utilities/recording-utilities.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("writes a 1-based point number in the first column", () => {
  const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
  content.prepareCapture();
  recordCase(content);
  recordCase(content);
  const pointId = content.dataSet.attributes[0].id;
  expect(content.dataSet.getValueAtIndex(0, pointId)).toBe(1);
  expect(content.dataSet.getValueAtIndex(1, pointId)).toBe(2);
});

// The point column must stay numeric, or the Graph tile infers a categorical x-axis and
// getTimeAtRecordedIndex returns 0. A string ordinal is the failure this pins.
it("leaves the point column numeric", () => {
  const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
  content.prepareCapture();
  recordCase(content);
  recordCase(content);
  expect(content.dataSet.attributes[0].type).toBe("numeric");
});

// The number comes from the row's position, not from a counter a caller passes, so a run that
// starts after single samples continues from them rather than writing a second point 1.
it("numbers from the rows already present", () => {
  const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
  content.prepareCapture();
  recordCase(content);
  recordCase(content);
  recordCase(content);
  const pointId = content.dataSet.attributes[0].id;
  expect(content.dataSet.getValueAtIndex(2, pointId)).toBe(3);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx jest src/plugins/dataflow/model/utilities/recording-utilities.test.ts
```

Expected: FAIL — the first column holds quantized seconds (`0`, `0.1`), not `1`, `2`.

- [ ] **Step 3: Implement**

In `recording-utilities.ts`, replace the time block at the top of `recordCase`. Drop the now-unused `programDataRate` from the destructure.

```ts
export function recordCase(content: DataflowContentModelType) {
  const { dataSet, program } = content;

  // Attributes are the point number followed by one per node.
  const aCase: ICaseCreation = {};

  // The point number is the row's position, so a run appended after single samples continues
  // the numbering instead of restarting at 1.
  aCase[dataSet.attributes[0].id] = dataSet.cases.length + 1;
  ...
```

`recordIndex` is no longer a parameter. Update the one caller in `dataflow-program.tsx`:

```ts
            recordCase(this.props.tileContent);
```

- [ ] **Step 4: Run and watch it pass**

```bash
npx jest src/plugins/dataflow
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/dataflow
git commit -m "CLUE-740: record a point ordinal rather than quantized time"
```

---

## Task 4: Derive the playback time instead of reading the column

**Files:**
- Modify: `src/plugins/dataflow/model/dataflow-content.ts`
- Test: `src/plugins/dataflow/model/dataflow-content.test.ts`

The scrubber in `dataflow-rateselector-playback.tsx` is the only consumer of
`getTimeAtRecordedIndex` and `durationOfRecording`. With a point ordinal in column 0, it computes
the same arithmetic `recordCase` used to store.

- [ ] **Step 1: Write the failing test**

```ts
describe("getTimeAtRecordedIndex", () => {
  it("derives elapsed seconds from the index and the data rate", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.setProgramDataRate(100);
    content.prepareCapture();
    recordCase(content);
    recordCase(content);
    recordCase(content);
    expect(content.getTimeAtRecordedIndex(0)).toBe(0);
    expect(content.getTimeAtRecordedIndex(2)).toBe(0.2);
    expect(content.durationOfRecording).toBe(0.2);
  });

  it("returns 0 for an out-of-range index", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.prepareCapture();
    expect(content.getTimeAtRecordedIndex(5)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx jest src/plugins/dataflow/model/dataflow-content.test.ts -t "getTimeAtRecordedIndex"
```

Expected: FAIL — it reads the point ordinal out of column 0, so index 2 gives `3`, not `0.2`.

- [ ] **Step 3: Implement**

Replace the existing `getTimeAtRecordedIndex` (around line 227):

```ts
    /** Elapsed seconds at a recorded row, derived from its position and the data rate rather
     * than read from the table -- the first column is a point ordinal now. For a recording saved
     * before that change this returns the same number that column already holds, since it was
     * written as index * rate / 1000. */
    getTimeAtRecordedIndex(index: number) {
      const { dataSet } = self;
      if (!dataSet || index < 0 || index >= dataSet.cases.length) return 0;
      return (index * self.programDataRate) / 1000;
    },
```

- [ ] **Step 4: Run and watch it pass**

```bash
npx jest src/plugins/dataflow
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/dataflow
git commit -m "CLUE-740: derive playback time from the row index"
```

---

## Task 5: Detach linked tables when the program's structure changes

**Files:**
- Modify: `src/plugins/dataflow/model/dataflow-content.ts`
- Test: `src/plugins/dataflow/model/dataflow-content.test.ts`

This is the piece with no prior art in the tile and the likeliest place to overrun. Detaching
too eagerly loses a live link the student expects; too late lets a sample land in columns that
describe a different program. And it has to be undoable *with* the change that caused it.

- [ ] **Step 0: Verify shared-model changes join the tile action's history entry**

The detach manipulates shared models, which live in the document tree rather than the tile's.
CLUE's history is multi-tree, so whether a shared-model change made inside a tile action is
attributed to that action's entry decides whether one undo restores the link atomically. Read
`Tree.handleSharedModelChanges` and the exchange handling in `src/models/history/`.

Then prove it, rather than reasoning about it: write a test that performs a structural change on a
document with a linked table, undoes once, and asserts the table is linked again **and** the node
is back. If it takes two undos, the detach is landing in its own entry and must move up to a
document-level action — stop and raise that before continuing, because it changes this task's
shape.

**Keep this a model test, and do not run the program.** Each tick records actions of its own, so a
test that lets the program run would interleave tick entries between the change and the undo and
tell you nothing about grouping. Nothing ticks under Jest unless you start it — just do not.

- [ ] **Step 1: Write the failing test**

```ts
describe("detachLinkedTables", () => {
  it("gives each linked table its own copy of the data and unshares it", () => {
    const { content, tableContent } = setupContentWithLinkedTable();
    content.prepareCapture();
    recordCase(content);

    content.detachLinkedTables();

    expect(content.linkedTableTileId).toBeUndefined();
    expect(tableContent.dataSet.cases).toHaveLength(1);   // the student's numbers survive
    expect(tableContent.dataSet).not.toBe(content.dataSet); // but it is its own now
  });

  it("does nothing when the capture holds no rows", () => {
    const { content, tableTileId } = setupContentWithLinkedTable();
    content.detachLinkedTables();
    expect(content.linkedTableTileId).toBe(tableTileId);
  });
});

describe("structural change", () => {
  it("detaches when a node is added", () => {
    const { content } = setupContentWithLinkedTableAndRows();
    content.program.addNode(makeNode("Sensor2"));
    expect(content.linkedTableTileId).toBeUndefined();
  });

  it("detaches when a connection changes", () => {
    const { content } = setupContentWithLinkedTableAndRows();
    content.program.removeConnection(firstConnectionId(content));
    expect(content.linkedTableTileId).toBeUndefined();
  });

  it("does NOT detach when a node is renamed", () => {
    const { content, tableTileId } = setupContentWithLinkedTableAndRows();
    renameFirstNode(content, "Renamed");
    expect(content.linkedTableTileId).toBe(tableTileId);
  });

  it("does NOT detach when a node's parameter value changes", () => {
    const { content, tableTileId } = setupContentWithLinkedTableAndRows();
    setFirstNodeValue(content, 42);
    expect(content.linkedTableTileId).toBe(tableTileId);
  });
});

describe("undo", () => {
  // The whole point of detaching from an action rather than a reaction: one entry, one undo.
  it("restores the node and the link in a single undo", () => {
    const { content, undoStore, tableTileId } = setupDocumentWithLinkedTableAndRows();
    const nodeCountBefore = content.program.nodes.size;

    content.program.addNode(makeNode("Sensor2"));
    expect(content.linkedTableTileId).toBeUndefined();

    undoStore.undo();

    expect(content.program.nodes.size).toBe(nodeCountBefore);
    expect(content.linkedTableTileId).toBe(tableTileId);
  });

  // A reaction would re-fire on the patches undo applies and detach the table again.
  it("does not detach again while undoing", () => {
    const { content, undoStore, tableTileId } = setupDocumentWithLinkedTableAndRows();
    content.program.addNode(makeNode("Sensor2"));
    undoStore.undo();
    expect(content.linkedTableTileId).toBe(tableTileId);
  });
});
```

Write the four `setup*`/helper functions at the top of the describe block using the same model
construction the file already uses. Do not leave them as prose.

- [ ] **Step 2: Run it and watch it fail**

```bash
npx jest src/plugins/dataflow/model/dataflow-content.test.ts -t "detachLinkedTables"
npx jest src/plugins/dataflow/model/dataflow-content.test.ts -t "structural change"
```

Expected: FAIL — `detachLinkedTables` is not a function.

- [ ] **Step 3: Implement the action**

In the final `.actions` block:

```ts
    /** Hands every linked table its own copy of the recorded data and stops it following this
     * program. Called when the program's structure changes under a capture: the student's
     * numbers describe the old program, so they stay with the table while the program is freed
     * to start a new one. */
    detachLinkedTables() {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const sharedModel = self.sharedModel;
      if (!sharedModelManager?.isReady || !sharedModel) return;
      if (self.dataSet.cases.length === 0) return;

      const snapshot = getSnapshot(self.dataSet);
      sharedModelManager.getSharedModelTileIds(sharedModel).forEach(tileId => {
        const tileContent = getTileContentById(self, tileId);
        if (!tileContent || tileContent === self) return;
        const ownDataSet = SharedDataSet.create({ providerId: tileId, dataSet: snapshot });
        sharedModelManager.removeTileSharedModel(tileContent, sharedModel);
        sharedModelManager.addTileSharedModel(tileContent, ownDataSet);
      });
    },
```

`getSnapshot` comes from `mobx-state-tree` and `getTileContentById` is already imported.

- [ ] **Step 4: Call it from the structural actions — NOT from a reaction**

A reaction is wrong here and the reason matters. Changes group into one undo entry only via a
parent action or a `flow` (`docs/undo-and-time-travel.md`), and a reaction runs after the
triggering action commits — so its detach would be a separate entry. Worse, undo applies patches
and patch application re-runs reactions, so undoing the node that caused a detach would detach
again. Actions are **not** re-entered during patch application, which is exactly the property
needed.

In `dataflow-program-model.ts`, have each structural action call the content model's
`detachLinkedTables()`. Reach the content model from the program model with MST's `getParent`, or
add a small `detachLinkedTables` passthrough if the program model already has a parent accessor —
check what that file does today rather than inventing a second route.

```ts
    addNode(node: IDataflowNodeModel) {
      // The captured data describes the program as it was, so it stops following this one. Called
      // here rather than from a reaction so it lands in the same undo entry as this change: one
      // undo then restores the node AND the link. Patch application does not call actions, so
      // this cannot re-fire while history is replaying.
      detachLinkedTablesFor(self);
      ...
    },
```

Apply the same call in `addNodeSnapshot`, `addConnection`, `removeConnection`, `removeNode` and
`removeNodeAndConnections`. It runs more than once for a compound change like
`removeNodeAndConnections`; that is harmless, since after the first call there are no linked
tables left, and it matches that file's stated convention of funnelling removal through one path
"so that every removal path is consistent by construction".

Do **not** call it from any action that only renames a node or sets a value.

- [ ] **Step 5: Run and watch it pass**

```bash
npx jest src/plugins/dataflow
```

Expected: PASS.

- [ ] **Step 6: Mutation-check the two negative tests**

The rename and parameter tests pass trivially if the detach is never wired up at all. Prove they
bite: temporarily add the `detachLinkedTablesFor(self)` call to the rename action too, re-run, and
confirm *"does NOT detach when a node is renamed"* fails. Remove it again.

Do the same for the undo tests: temporarily move the detach into a reaction and confirm
*"restores the node and the link in a single undo"* fails. That is the assumption this whole task
rests on, so it should be seen failing once.

```bash
npx jest src/plugins/dataflow/model/dataflow-content.test.ts -t "structural change"
```

- [ ] **Step 7: Commit**

```bash
git add src/plugins/dataflow
git commit -m "CLUE-740: detach linked tables when the program's structure changes"
```

---

## Task 6: The two toolbar buttons

**Files:**
- Create: `src/plugins/dataflow/components/toolbar/dataflow-table-buttons.tsx`
- Test: `src/plugins/dataflow/components/toolbar/dataflow-table-buttons.test.tsx`

- [ ] **Step 1: Write the failing tests**

Follow the mocking already used in `src/plugins/dataflow/components/toolbar/dataflow-toolbar.test.tsx`
for `TileModelContext` and `AddTilesContext`.

```tsx
describe("DataflowTableButton", () => {
  it("creates a table and prepares the columns when none is linked", () => {
    const { addTileAfter, content } = renderButtonWithNoLinkedTable();
    fireEvent.click(screen.getByRole("button", { name: /table/i }));
    expect(addTileAfter).toHaveBeenCalledTimes(1);
    expect(content.dataSet.attributes.map(a => a.name)).toEqual(["Point", "Sensor", "Servo"]);
  });

  it("selects the existing table instead of adding a second", () => {
    const { addTileAfter, setSelectedTileId, tableTileId } = renderButtonWithLinkedTable();
    fireEvent.click(screen.getByRole("button", { name: /table/i }));
    expect(addTileAfter).not.toHaveBeenCalled();
    expect(setSelectedTileId).toHaveBeenCalledWith(tableTileId);
  });

  // Re-preparing would wipe rows the student already captured.
  it("does not rebuild the columns when the linked table already holds rows", () => {
    const { content } = renderButtonWithLinkedTableAndRows();
    const before = content.dataSet.cases.length;
    fireEvent.click(screen.getByRole("button", { name: /table/i }));
    expect(content.dataSet.cases).toHaveLength(before);
  });
});

describe("RecordSingleSampleButton", () => {
  it("appends one row of the nodes' current values", () => {
    const { content } = renderSampleButtonWithLinkedTable();
    fireEvent.click(screen.getByRole("button", { name: /sample/i }));
    expect(content.dataSet.cases).toHaveLength(1);
    const [point, sensor] = content.dataSet.attributes;
    expect(content.dataSet.getValueAtIndex(0, point.id)).toBe(1);
    expect(content.dataSet.getValueAtIndex(0, sensor.id)).toBe(412);
  });

  it("creates the table first when none is linked", () => {
    const { addTileAfter, content } = renderSampleButtonWithNoLinkedTable();
    fireEvent.click(screen.getByRole("button", { name: /sample/i }));
    expect(addTileAfter).toHaveBeenCalledTimes(1);
    expect(content.dataSet.cases).toHaveLength(1);
  });

  it("is disabled while a continuous recording is running", () => {
    renderSampleButtonWhileRecording();
    expect(screen.getByRole("button", { name: /sample/i })).toBeDisabled();
  });

  it("is disabled in a read-only view", () => {
    renderSampleButtonReadOnly();
    expect(screen.getByRole("button", { name: /sample/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

```bash
npx jest src/plugins/dataflow/components/toolbar/dataflow-table-buttons.test.tsx
```

Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement**

```tsx
import React, { useContext } from "react";
import { observer } from "mobx-react";
import { AddTilesContext, TileModelContext } from "../../../../components/tiles/tile-api";
import { TileToolbarButton } from "../../../../components/toolbar/tile-toolbar-button";
import { BadgedIcon } from "../../../../components/toolbar/badged-icon";
import { IToolbarButtonComponentProps } from "../../../../components/toolbar/toolbar-button-manager";
import { getTileComponentInfo } from "../../../../models/tiles/tile-component-info";
import { getTileCreateActionName } from "../../../../models/tiles/tile-content-info";
import { useUIStore } from "../../../../hooks/use-stores";
import { DataflowContentModelType } from "../../model/dataflow-content";
import { recordCase } from "../../model/utilities/recording-utilities";

import ViewBadgeIcon from "../../../../assets/icons/view/view-badge.svg";

/** Links the program to a table, creating one only when there isn't one already, and sets up the
 * point + node columns when that table is empty. Shared by both buttons below. */
function ensureLinkedTable(
  content: DataflowContentModelType,
  tile: any,
  addTilesContext: any,
  selectTile: (id: string) => void
) {
  const existingId = content.linkedTableTileId;
  if (existingId) {
    selectTile(existingId);
  } else {
    const sharedModel = content.sharedModel;
    if (!sharedModel) return;
    addTilesContext.addTileAfter("Table", tile, [sharedModel]);
  }
  // Only on an empty table: re-preparing would wipe rows the student has already captured.
  if (content.dataSet.cases.length === 0) {
    content.prepareCapture();
  }
}

/** Dataflow's own Table It. Registered under `data-set-view` for this tile type only, so the
 * shared button other tiles use is untouched. */
export const DataflowTableButton = observer(function DataflowTableButton(
  { name }: IToolbarButtonComponentProps
) {
  const tile = useContext(TileModelContext);
  const addTilesContext = useContext(AddTilesContext);
  const ui = useUIStore();
  const content = tile?.content as DataflowContentModelType | undefined;
  const Icon = getTileComponentInfo("Table")?.Icon;

  function handleClick() {
    if (!content || !tile || !addTilesContext) return;
    ensureLinkedTable(content, tile, addTilesContext, id => ui.setSelectedTileId(id));
  }

  return (
    <TileToolbarButton name={name} title={getTileCreateActionName("Table")} onClick={handleClick}
        disabled={!content}>
      {Icon ? <BadgedIcon Icon={Icon} Badge={ViewBadgeIcon} /> : "??"}
    </TileToolbarButton>
  );
});

/** Appends the program's current values as one more point. */
export const RecordSingleSampleButton = observer(function RecordSingleSampleButton(
  { name }: IToolbarButtonComponentProps
) {
  const tile = useContext(TileModelContext);
  const addTilesContext = useContext(AddTilesContext);
  const ui = useUIStore();
  const content = tile?.content as DataflowContentModelType | undefined;
  const readOnly = useReadOnlyContext();
  // Read-only only, for now. Disabling during a continuous recording needs isRecording on the
  // model, which is CLUE-771; see the note under this task.
  const disabled = !content || readOnly;

  function handleClick() {
    if (!content || !tile || !addTilesContext) return;
    ensureLinkedTable(content, tile, addTilesContext, id => ui.setSelectedTileId(id));
    recordCase(content);
  }

  return (
    <TileToolbarButton name={name} title="Record single sample" onClick={handleClick}
        disabled={disabled}
        disabledMessage="Single samples aren't available while a recording is running">
      <RecordSampleIcon />
    </TileToolbarButton>
  );
});
```

**On disabling during a recording.** `isRecording` lives in `DataflowProgram`'s React state, not
the model, so a toolbar button cannot read it — that is exactly the lift CLUE-771 carries. Rather
than fake the check, this story disables the button only in a read-only view and leaves the
recording case to CLUE-771.

So: **delete the `is disabled while a continuous recording is running` test from Step 1** and keep
the read-only one. Say in the PR description that single samples are still clickable mid-recording
and that CLUE-771 closes it. Import `useReadOnlyContext` from
`../../../../components/document/read-only-context`.

- [ ] **Step 4: Add the icon**

Add `src/plugins/dataflow/assets/icons/record-sample-icon.svg`, following the existing
`reset-icon.svg` in that folder for size and stroke. Import it as `RecordSampleIcon`.

- [ ] **Step 5: Run and watch it pass**

```bash
npx jest src/plugins/dataflow/components/toolbar/dataflow-table-buttons.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/dataflow
git commit -m "CLUE-740: add Dataflow's Table It and Record Single Sample buttons"
```

---

## Task 7: Register the buttons and place them in the toolbar

**Files:**
- Modify: `src/plugins/dataflow/dataflow-toolbar-registration.tsx`
- Modify: `src/clue/app-config.json`
- Test: `src/plugins/dataflow/components/toolbar/dataflow-toolbar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("shows Record Single Sample after Table It and Graph It", () => {
  renderDataflowToolbar();
  const names = screen.getAllByRole("button").map(b => b.getAttribute("data-testid"));
  const table = names.indexOf("toolbar-button-data-set-view");
  const sample = names.indexOf("toolbar-button-record-sample");
  expect(sample).toBeGreaterThan(table);
});
```

Check the real `data-testid` format in `tile-toolbar-button.tsx` and use that, rather than the
guess above.

- [ ] **Step 2: Run it and watch it fail**

```bash
npx jest src/plugins/dataflow/components/toolbar/dataflow-toolbar.test.tsx
```

Expected: FAIL — no such button.

- [ ] **Step 3: Implement**

In `dataflow-toolbar-registration.tsx`, import the two new components, point `data-set-view` at
`DataflowTableButton`, and add the new entry:

```tsx
  {
    // Dataflow's own: reuses a linked table rather than always adding one. Registration is per
    // tile type, so the shared DataSetViewButton other tiles use is unaffected.
    name: "data-set-view",
    component: DataflowTableButton
  },
  {
    name: "record-sample",
    component: RecordSingleSampleButton
  },
```

Remove the now-unused `DataSetViewButton` import.

In `src/clue/app-config.json`, the dataflow `tools` list currently begins:

```json
[["data-set-view", "Table"], ["data-set-view", "Graph"], "delete", "group", "ungroup", "|",
 "zoom-in", "zoom-out", "fit-all", "pan", "|", "connect", "reset"]
```

Insert `"record-sample"` after the two `data-set-view` entries.

`DataflowTableButton` ignores the `"Table"` / `"Graph"` argument that the shared button used to
read, so the two existing entries both render a Table button. **Collapse them to one**
`["data-set-view", "Table"]` entry and leave Graph It to a separate story, or give
`DataflowTableButton` the same `args` handling the shared component has so `Graph` still creates a
graph. Pick the second — the toolbar is expected to keep both — and add a test that
`["data-set-view", "Graph"]` still adds a Graph tile.

- [ ] **Step 4: Run and watch it pass**

```bash
npx jest src/plugins/dataflow
npm run check:types
```

Expected: PASS and clean.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/dataflow src/clue/app-config.json
git commit -m "CLUE-740: register the Dataflow table buttons and place them in the toolbar"
```

---

## Task 8: Let a recording append rather than clear

**Files:**
- Modify: `src/plugins/dataflow/components/dataflow-program.tsx`
- Test: `src/plugins/dataflow/model/dataflow-content.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("continues the point numbering when a recording follows single samples", () => {
  const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
  content.prepareCapture();
  recordCase(content);               // a single sample: point 1
  recordCase(content);               // a recorded run appends
  recordCase(content);
  const pointId = content.dataSet.attributes[0].id;
  expect(content.dataSet.cases).toHaveLength(3);
  expect(content.dataSet.getValueAtIndex(2, pointId)).toBe(3);
});
```

- [ ] **Step 2: Run it**

```bash
npx jest src/plugins/dataflow/model/dataflow-content.test.ts -t "continues the point numbering"
```

Expected: PASS already, from Task 3's `cases.length + 1`. This test exists to pin the behavior at
the model level before the component change below can break it.

- [ ] **Step 3: Implement**

In `dataflow-program.tsx`'s `handleChangeOfProgramMode`, the `ProgramMode.Ready` branch calls
`tileContent.prepareCapture()` unconditionally, which clears every row. Make it rebuild only when
the table is empty, so a run started after single samples appends to them:

```ts
      case ProgramMode.Ready:
        // Only when there is nothing to keep: a run started after single samples appends to them
        // rather than discarding what the student captured.
        if (tileContent.dataSet.cases.length === 0) {
          tileContent.prepareCapture();
        }
        this.setState({isPlaying: false, playBackIndex: 0});
        this.setState({isRecording: true});
        break;
```

- [ ] **Step 4: Run the suite**

```bash
npx jest src/plugins/dataflow
```

Expected: PASS. If an existing test asserted that recording clears previous data, update it — that
is the behavior this story deliberately changes — and say so in its name.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/dataflow
git commit -m "CLUE-740: append a recorded run to existing samples"
```

---

## Task 9: Cypress coverage

**Files:**
- Modify: `cypress/e2e/functional/tile_tests/dataflow_tool_spec.js`

`dataflow_tool_spec.js` is already listed in `.github/workflows/manual-regression.yml`, so
extending it avoids a workflow change.

- [ ] **Step 1: Add the test**

```js
it("records a single sample into a linked table", () => {
  // follow the existing spec's setup for adding a Dataflow tile and a node
  dataflowToolTile.getRecordSampleButton().click();
  tableToolTile.getTableTile().should("exist");
  tableToolTile.getTableCell().eq(1).should("contain", "1"); // the first point
  dataflowToolTile.getRecordSampleButton().click();
  tableToolTile.getTableRow().should("have.length", 2);
});
```

Add `getRecordSampleButton` to `cypress/support/elements/tile/DataflowToolTile.js`, following the
accessors already there.

- [ ] **Step 2: Run the spec**

```bash
env -u ELECTRON_RUN_AS_NODE npx cypress run \
  --spec 'cypress/e2e/functional/tile_tests/dataflow_tool_spec.js'
```

Restart `npm start` first and confirm a clean compile — a stale dev bundle fails every spec
misleadingly.

- [ ] **Step 3: Commit**

```bash
git add cypress
git commit -m "CLUE-740: cypress coverage for single-sample recording"
```

---

## Task 10: Full verification

- [ ] **Step 1: Types and lint**

```bash
npm run check:types
npm run lint:build
```

`lint:build` rather than `lint` — it also flags unnecessarily disabled rules, and it is what has
to pass before committing.

- [ ] **Step 2: Jest**

```bash
npx jest src/plugins/dataflow src/components/toolbar src/models/tiles/table
npx jest
```

Report the actual counts. Do not claim completion from a partial run.

- [ ] **Step 3: Mutation-check every behavioral test added here**

For each: revert the behavior it describes and confirm the test fails. A test that passes either
way is not coverage. The likeliest offenders in this plan are the two negative tests in Task 5
(rename and parameter change) and the disabled-state tests in Task 6.

- [ ] **Step 4: Hand-check in the browser**

Restart `npm start`, confirm a clean compile, and in a Dataflow tile: click Table It and see a
table appear headed `Program data HH:MM:SS` with a Point column; click Record Single Sample twice
and watch points 1 and 2 appear; click Table It again and confirm no second table; add a node and
confirm the table detaches with its rows intact; click Graph It and confirm the x-axis is numeric.

**Do not hand-check undo here.** Each tick records its own actions, so undo currently walks back
through tick entries rather than landing on the node change — a known Dataflow issue being
addressed separately. The grouping this story relies on is covered by the model tests in Task 5,
where nothing is ticking. Report it as unverifiable in the browser rather than as broken.

- [ ] **Step 5: Run `/code-self-review` over the full diff**

- [ ] **Step 6: Hold for the user before pushing**

Commit locally. Do not push until the user has checked it on localhost or said to go ahead.

---

## Risks

| Risk | Handling |
|---|---|
| Dataflow's tick actions make undo look broken in the browser | Known and separate — ticks record their own history entries. The Task 5 model tests are where the grouping is proven; Task 10 Step 4 says not to hand-check undo. The design inherits the fix for free once ticks leave history. |
| Undo leaves the table detached, or detaches it again | The reason the detach is a child action of each structural change rather than a reaction. Task 5 Step 0 verifies the history-entry assumption before anything is built on it; Step 1's `undo` tests pin both directions. |
| A structural action is missed, so some edits do not detach | Every one of `addNode`, `addNodeSnapshot`, `addConnection`, `removeConnection`, `removeNode`, `removeNodeAndConnections` gets the call. The rename and parameter tests pin the other side. |
| The `data-set-view` entry for Graph silently becomes a second Table button | Task 7 Step 3 calls this out and requires `args` handling plus a test that Graph still adds a Graph tile. |
| Single samples cannot be disabled during a recording yet | `isRecording` is not on the model until CLUE-771. Task 6 Step 3 narrows the disable to read-only and says to note the gap in the PR rather than fake the check. |
| Old documents' playback drifts | Only when the data rate was changed after recording; CLUE-771 removes playback. Spec records this. |
