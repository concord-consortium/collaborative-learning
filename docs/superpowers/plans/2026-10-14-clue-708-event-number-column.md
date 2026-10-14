# CLUE-708 Event Number Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A table linked to a Wave Runner or a Timeline shows an Event Number as its first column, carrying the same number the Timeline puts on the event.

**Architecture:** The number is an `eventNumber` attribute in the shared events dataset, not a row position, so sorting the table cannot disturb it and every consumer of the dataset sees it. One `renumberEvents` helper owns the attribute and the numbering, ranking events by `windowStart`. The column is read-only through a restored `editable` flag on the attribute model, which keeps knowledge of seismic data out of the generic Table tile.

**Tech Stack:** TypeScript, MobX State Tree, React 18, Jest + React Testing Library, Luxon.

**Spec:** `docs/superpowers/specs/2026-10-13-clue-708-event-number-column-design.md`

---

## Task order matters

Adding the `editable` prop to the attribute model (Task 3) breaks six tests — five in
`dc-shared-models.test.ts`, one in `drag-tiles.test.ts`. Those are rewritten **first**, in Tasks 1 and 2, so that each rewrite can be run against the
branch *before* the model changes. An assertion that passes both before and after the prop is
testing the behaviour it names; one written after the change could merely be describing the new
output. Do not reorder these.

## File Structure

**Create**
- `src/plugins/shared-seismogram/event-numbering.ts` — `kEventNumberAttrName` and
  `renumberEvents`. Owns the attribute and the numbering rule; nothing else writes event numbers.
- `src/plugins/shared-seismogram/event-numbering.test.ts` — its tests.
- `src/components/tiles/table/use-columns-from-data-set.test.tsx` — covers the read-only column.

**Modify**
- `src/models/data/attribute.ts` — restore the `editable` prop and its setter.
- `src/components/tiles/table/use-columns-from-data-set.ts` — honour `editable`.
- `src/plugins/wave-runner/models/wave-runner-content.ts` — lift the dataset write out of
  `runModel` into a `recordDetectedEvents` action, and renumber there.
- `src/models/document/document-content-tests/dc-shared-models.test.ts` — four blobs rewritten,
  one explicit expected object updated.
- `src/models/document/drag-tiles.test.ts` — one blob rewritten; its five others left alone.

---

## Task 1: Replace the document blobs in `dc-shared-models.test.ts`

**Files:**
- Modify: `src/models/document/document-content-tests/dc-shared-models.test.ts`

Four of the five assert a whole serialized document with `toMatchInlineSnapshot`; replace each blob
with assertions about what the test's name claims, keeping every non-snapshot assertion already
there, since those are the part that carries meaning.

The fifth, "can export content with shared models", is **not** a blob — it already asserts an
explicit object with `toEqual`, listing each attribute's fields. That one is simply updated, not
rewritten. Telling the two apart is the whole point: an explicit expected value is worth keeping.

The document under test comes from `shared-model-example.json` and holds two tiles, `tableTool` and
`graphTool`, sharing one `SharedDataSet` with id `sharedDataSet1`.

- [ ] **Step 1: Confirm the five tests currently pass**

Run: `npx jest src/models/document/document-content-tests/dc-shared-models.test.ts`
Expected: all PASS. This is the baseline the rewrites must preserve.

- [ ] **Step 2: Read each test before touching it**

Open the file and read these five tests in full, including the blob:

- "can export content with shared models"
- "can copy a tile into another empty document"
- "can copy a tile into another document's row"
- "can copy two tiles into another document"
- "can move a tile within its own row before another tile in its own row"

For each, write down in one sentence what it is protecting. The blob is not the answer — the test
name and the assertions beside it are. One test already carries the author's
`// FIXME: the ids here are not going to be consistent`.

- [ ] **Step 3: Replace the blob in "can copy a tile into another empty document"**

Delete the `expect(getSnapshot(targetDocument)).toMatchInlineSnapshot(...)` call and put in its
place assertions on the data model:

```ts
      // The copy lands as the only tile in the only row, and the shared dataset comes with it,
      // rewired to the copy's new id rather than the source tile's.
      const rowIds = targetDocument.rowOrder;
      expect(rowIds).toHaveLength(1);
      const copiedTileIds = targetDocument.rowMap.get(rowIds[0])!.tiles.map(t => t.tileId);
      expect(copiedTileIds).toHaveLength(1);

      const copiedTileId = copiedTileIds[0];
      expect(targetDocument.tileMap.get(copiedTileId)!.content.type).toBe("Table");
      expect(copiedTileId).not.toBe("tableTool");

      expect(targetDocument.sharedModelMap.size).toBe(1);
      const copiedShared = Array.from(targetDocument.sharedModelMap.values())[0];
      expect(copiedShared.tiles.map(t => t.id)).toEqual([copiedTileId]);
```

If `copiedShared.tiles` holds ids rather than tile objects, use `expect(copiedShared.tiles).toEqual([copiedTileId])`
instead — run the test and let the failure message tell you which.

- [ ] **Step 4: Run that one test**

Run: `npx jest src/models/document/document-content-tests/dc-shared-models.test.ts -t "can copy a tile into another empty document"`
Expected: PASS. If it fails, the assertions are wrong — fix them against the real model rather than
reinstating the blob.

- [ ] **Step 5: Replace the blob in "can copy a tile into another document's row"**

Same shape, but the target document already has a row, so assert the copy joined it:

```ts
      // The copy joins the existing row rather than making a new one, and brings its dataset.
      expect(targetDocument.rowOrder).toHaveLength(1);
      const tilesInRow = targetDocument.rowMap.get(targetDocument.rowOrder[0])!.tiles;
      expect(tilesInRow).toHaveLength(2);

      const copiedTileId = tilesInRow[tilesInRow.length - 1].tileId;
      expect(targetDocument.tileMap.get(copiedTileId)!.content.type).toBe("Table");
      expect(targetDocument.sharedModelMap.size).toBe(1);
```

The source document's row holds `tableTool` then `graphTool`; the target in this test already has
one tile, so two is the count after the copy. Confirm against the test's own arrangement as you
read it in Step 2.

- [ ] **Step 6: Replace the blob in "can copy two tiles into another document"**

```ts
      // Both tiles arrive, and the one shared dataset they both used is copied once, not twice,
      // with both copies referencing it.
      const copiedIds = targetDocument.rowOrder
        .flatMap(rowId => targetDocument.rowMap.get(rowId)!.tiles.map(t => t.tileId));
      expect(copiedIds).toHaveLength(2);
      expect(targetDocument.sharedModelMap.size).toBe(1);

      const copiedShared = Array.from(targetDocument.sharedModelMap.values())[0];
      expect(copiedShared.tiles).toHaveLength(2);
```

- [ ] **Step 7: Replace the blob in "can move a tile within its own row before another tile in its own row"**

A move must not copy anything, so assert the order changed and nothing was added:

```ts
      // A move reorders within the row; it must not duplicate the tile or its shared model.
      const tileIds = documentContent.rowMap.get(documentContent.rowOrder[0])!.tiles.map(t => t.tileId);
      expect(tileIds).toEqual(["graphTool", "tableTool"]);
      expect(documentContent.sharedModelMap.size).toBe(1);
```

The test's own comment says "move tableTool to the right of graphTool", so `["graphTool", "tableTool"]`
is the order a correct move produces. Note this test mutates `documentContent` itself rather than a
target document, which is why the assertions read from it.

- [ ] **Step 8: Update "can export content with shared models"**

This one already asserts an explicit object via `parsedExport(documentContent)`. Leave its shape
alone and add the new field to each of the two attribute literals inside `dataSet.attributes`,
keeping the existing alphabetical ordering of the keys:

```ts
                {
                  clientKey: "",
                  editable: true,
                  formula: { display: "" },
                  hidden: false,
                  id: "attribute1",
                  name: "x",
                  title: "",
                  units: "",
                  values: [ "1", "2", "3"]
                },
```

Do the same for `attribute2`. This is the one change in this task that is a re-record rather than a
rewrite, and it is legitimate: the expected value names every field, so a reviewer can see exactly
what changed.

Note this step will not fail until Task 3 adds the prop. Make the edit now and expect the test to
fail until then — Step 9 covers that.

- [ ] **Step 9: Run the whole file**

Run: `npx jest src/models/document/document-content-tests/dc-shared-models.test.ts`
Expected: every test PASSES except "can export content with shared models", which now fails
because Step 8 added `editable: true` before the model has it. That single expected failure is
fine and Task 3 Step 6 clears it. Everything else must pass.

Check: `grep -c toMatchInlineSnapshot src/models/document/document-content-tests/dc-shared-models.test.ts`
Expected: `0`.

- [ ] **Step 10: Commit**

```bash
git add src/models/document/document-content-tests/dc-shared-models.test.ts
git commit -m "Assert what the shared-model copy tests protect, not a document blob [CLUE-708]"
```

(Committing with one known-failing test is deliberate here: the rewrite and the model change are
separate commits so a reviewer can see that the rewritten assertions survive the prop.)

---

## Task 2: Rewrite the snapshot in `drag-tiles.test.ts`

**Files:**
- Modify: `src/models/document/drag-tiles.test.ts`

Only one of this file's inline snapshots involves a shared model. The other five cover Text tiles
with no dataset and are deliberately left alone — see the spec's scope note.

- [ ] **Step 1: Confirm the file currently passes**

Run: `npx jest src/models/document/drag-tiles.test.ts`
Expected: all PASS.

- [ ] **Step 2: Replace the blob in "returns the tile and the shared model"**

That test is in `describe("getDragTiles") > describe("with a tile using a shared model")`, and
drags `tile3`, a Table. Replace its `expect(dragTiles).toMatchInlineSnapshot(...)` with:

```ts
        // The drag payload carries the tile and the shared dataset it uses, so a drop into another
        // document can recreate both. The contents travel as JSON strings.
        expect(dragTiles.tiles.map(t => t.tileId)).toEqual(["tile3"]);
        expect(dragTiles.tiles[0].tileType).toBe("Table");
        expect(JSON.parse(dragTiles.tiles[0].tileContent).content.type).toBe("Table");

        expect(dragTiles.sharedModels).toHaveLength(1);
        const shared = dragTiles.sharedModels[0];
        expect(shared.modelId).toBe("shared-data-set-1");
        expect(shared.providerId).toBe("tile3");
        expect(shared.tileIds).toEqual(["tile3"]);
        expect(JSON.parse(shared.content).type).toBe("SharedDataSet");
```

Keep the `cleanDragTiles(...)` call. The surrounding `/*eslint-disable max-len*/` and
`/*eslint-enable max-len*/` pair can go, since no long line is left to disable.

- [ ] **Step 3: Run that test**

Run: `npx jest src/models/document/drag-tiles.test.ts -t "returns the tile and the shared model"`
Expected: PASS.

- [ ] **Step 4: Run the whole file**

Run: `npx jest src/models/document/drag-tiles.test.ts`
Expected: all PASS. The other five snapshots are untouched and still pass.

- [ ] **Step 5: Commit**

```bash
git add src/models/document/drag-tiles.test.ts
git commit -m "Assert the drag payload's contents rather than its serialization [CLUE-708]"
```

---

## Task 3: Restore `editable` on the attribute model

**Files:**
- Modify: `src/models/data/attribute.ts`
- Test: `src/models/data/attribute.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/models/data/attribute.test.ts`:

```ts
  it("is editable unless told otherwise", () => {
    expect(Attribute.create({ name: "a" }).editable).toBe(true);
  });

  // Set on an attribute whose values are derived, so the table does not offer a cell editor that
  // would be silently overwritten.
  it("can be marked as not editable", () => {
    const attr = Attribute.create({ name: "a", editable: false });
    expect(attr.editable).toBe(false);
    attr.setEditable(true);
    expect(attr.editable).toBe(true);
  });
```

If the file imports `Attribute` under a different name, match the file's existing imports.

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/models/data/attribute.test.ts -t "editable"`
Expected: FAIL — `editable` is not a property of the model.

- [ ] **Step 3: Add the prop**

In `attribute.ts`, in the `.props({ ... })` block, immediately after `hidden: false,`:

```ts
  // False for a value the owning tile derives, such as the Timeline's event number: the table
  // offers no editor for it, because an edit would be overwritten the next time it is recomputed.
  editable: true,
```

- [ ] **Step 4: Restore the setter**

Still in `attribute.ts`, replace the commented-out setter:

```ts
  // setEditable(editable: boolean) {
  //   self.editable = editable;
  // },
```

with:

```ts
  setEditable(editable: boolean) {
    self.editable = editable;
  },
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx jest src/models/data/attribute.test.ts`
Expected: all PASS.

- [ ] **Step 6: Prove the rewritten tests were worth rewriting**

Run: `npx jest src/models/document/drag-tiles.test.ts src/models/document/document-content-tests/dc-shared-models.test.ts`
Expected: all PASS — unchanged by the new prop. This is the point of Tasks 1 and 2: these same
tests failed against the blobs. If any fails now, the rewrite in Task 1 or 2 captured serialization
rather than behaviour, and should be fixed here rather than by re-recording anything.

- [ ] **Step 7: Run the whole suite for anything else the prop disturbs**

Run: `npx jest --silent 2>&1 | tail -5`
Expected: 0 failures. If something else fails, read it: an additive prop with a default should
disturb nothing that was asserting behaviour.

- [ ] **Step 8: Commit**

```bash
git add src/models/data/attribute.ts src/models/data/attribute.test.ts
git commit -m "Let an attribute declare that its values are not editable [CLUE-708]"
```

---

## Task 4: The table offers no editor for a non-editable attribute

**Files:**
- Modify: `src/components/tiles/table/use-columns-from-data-set.ts`
- Create: `src/components/tiles/table/use-columns-from-data-set.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/tiles/table/use-columns-from-data-set.test.tsx`:

```tsx
import { renderHook } from "@testing-library/react";
import { addAttributeToDataSet, DataSet } from "../../../models/data/data-set";
import { useColumnsFromDataSet } from "./use-columns-from-data-set";

// jsdom renders no grid here; what is under test is which columns the hook hands react-data-grid,
// and in particular whether it gives a column an editor.
describe("useColumnsFromDataSet", () => {
  function renderColumns() {
    const dataSet = DataSet.create();
    addAttributeToDataSet(dataSet, { name: "typed" });
    addAttributeToDataSet(dataSet, { name: "derived", editable: false });

    const { result } = renderHook(() => useColumnsFromDataSet({
      gridContext: { isColumnSelected: () => false } as any,
      dataSet,
      content: { hasExpression: () => false } as any,
      columnChanges: 0,
      headerHeight: () => 30,
      rowHeight: () => 30,
      RowLabelHeader: () => null,
      RowLabelFormatter: () => null,
      measureColumnWidth: () => 100,
      lookupImage: () => undefined
    }));
    const byName = (name: string) => result.current.columns.find((c: any) => c.name === name);
    return { byName };
  }

  it("gives an ordinary attribute a cell editor", () => {
    expect(renderColumns().byName("typed")?.renderEditCell).toBeDefined();
  });

  // The Timeline's event number is derived, so an edit would be overwritten on the next renumber.
  it("gives a non-editable attribute no cell editor", () => {
    expect(renderColumns().byName("derived")?.renderEditCell).toBeUndefined();
  });
});
```

If `useColumnsFromDataSet` returns something other than `{ columns }`, read its return and adjust
`byName`. If it needs arguments this stub omits, add them as minimal stubs — the test only needs the
hook to reach the point where it builds columns.

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/components/tiles/table/use-columns-from-data-set.test.tsx`
Expected: the "no cell editor" test FAILS — every attribute currently gets an editor.

- [ ] **Step 3: Honour the flag**

In `use-columns-from-data-set.ts`, in the column built for each attribute, change:

```ts
        renderEditCell: !readOnly && !content.hasExpression(attr.id) ? CellTextEditor : undefined,
```

to:

```ts
        // `editable: false` marks a value the owning tile derives; an edit would be overwritten.
        renderEditCell: !readOnly && !content.hasExpression(attr.id) && attr.editable
                          ? CellTextEditor : undefined,
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/components/tiles/table/use-columns-from-data-set.test.tsx`
Expected: both PASS.

- [ ] **Step 5: Check nothing else in the table regressed**

Run: `npx jest src/components/tiles/table`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/tiles/table/use-columns-from-data-set.ts \
        src/components/tiles/table/use-columns-from-data-set.test.tsx
git commit -m "Offer no cell editor for an attribute the tile derives [CLUE-708]"
```

---

## Task 5: `renumberEvents`

**Files:**
- Create: `src/plugins/shared-seismogram/event-numbering.ts`
- Create: `src/plugins/shared-seismogram/event-numbering.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/plugins/shared-seismogram/event-numbering.test.ts`:

```ts
import { onPatch } from "mobx-state-tree";
import { addAttributeToDataSet, addCasesToDataSet, DataSet, IDataSet } from "../../models/data/data-set";
import { kEventNumberAttrName, renumberEvents } from "./event-numbering";

describe("renumberEvents", () => {
  /** A dataset shaped like the Wave Runner's, with events given in the order supplied. */
  function eventsDataSet(startHours: number[]) {
    const dataSet = DataSet.create();
    addAttributeToDataSet(dataSet, { name: "eventType" });
    addAttributeToDataSet(dataSet, { name: "windowStart" });
    addCasesToDataSet(dataSet, startHours.map(h => ({
      eventType: "Earthquake",
      windowStart: `2026-02-01T${String(h).padStart(2, "0")}:00:00.000Z`
    })));
    return dataSet;
  }

  /** The event numbers, read back in the dataset's own case order. */
  function numbers(dataSet: IDataSet) {
    const attr = dataSet.attrFromName(kEventNumberAttrName);
    return dataSet.cases.map(c => dataSet.getStrValue(c.__id__, attr!.id));
  }

  it("adds the attribute, first, when the dataset has none", () => {
    const dataSet = eventsDataSet([1, 2]);
    renumberEvents(dataSet);
    expect(dataSet.attributes[0].name).toBe(kEventNumberAttrName);
  });

  it("marks the attribute as not editable, since it is derived", () => {
    const dataSet = eventsDataSet([1]);
    renumberEvents(dataSet);
    expect(dataSet.attrFromName(kEventNumberAttrName)!.editable).toBe(false);
  });

  it("numbers by time order, not the order the events were recorded", () => {
    const dataSet = eventsDataSet([5, 1, 3]);
    renumberEvents(dataSet);
    // Cases stay in their recorded order; the numbers describe time order.
    expect(numbers(dataSet)).toEqual(["3", "1", "2"]);
  });

  it("shifts the events after one that is inserted earlier in time", () => {
    const dataSet = eventsDataSet([1, 2]);
    renumberEvents(dataSet);
    addCasesToDataSet(dataSet, [
      { eventType: "Avalanche", windowStart: "2026-02-01T01:30:00.000Z" }
    ]);
    renumberEvents(dataSet);
    expect(numbers(dataSet)).toEqual(["1", "3", "2"]);
  });

  // Opening a document must not dirty it, and a run that appends in time order is the usual case.
  it("writes nothing when the numbers are already right", () => {
    const dataSet = eventsDataSet([1, 2, 3]);
    renumberEvents(dataSet);

    const patches: unknown[] = [];
    onPatch(dataSet, patch => patches.push(patch));
    renumberEvents(dataSet);

    expect(patches).toEqual([]);
  });

  it("numbers an event with an unusable windowStart last, as the Timeline drops it", () => {
    const dataSet = eventsDataSet([2]);
    addCasesToDataSet(dataSet, [{ eventType: "Noise", windowStart: "" }]);
    renumberEvents(dataSet);
    expect(numbers(dataSet)).toEqual(["1", "2"]);
  });

  it("does nothing to a dataset that is not events", () => {
    const dataSet = DataSet.create();
    addAttributeToDataSet(dataSet, { name: "height" });
    renumberEvents(dataSet);
    expect(dataSet.attrFromName(kEventNumberAttrName)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest src/plugins/shared-seismogram/event-numbering.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the helper**

Create `src/plugins/shared-seismogram/event-numbering.ts`:

```ts
import { DateTime } from "luxon";
import { addAttributeToDataSet, ICase, IDataSet } from "../../models/data/data-set";

export const kEventNumberAttrName = "eventNumber";

/**
 * Numbers every event by its place in `windowStart` order and writes the numbers into `dataSet`,
 * adding the attribute if it is missing. Call it after anything changes which events exist.
 *
 * The number has to be data rather than a row position: the table can be sorted, and the Timeline
 * numbers by time, so a row index would disagree with it the moment a student sorted by type.
 */
export function renumberEvents(dataSet: IDataSet) {
  const startAttr = dataSet.attrFromName("windowStart");
  if (!startAttr) return;

  if (!dataSet.attrFromName(kEventNumberAttrName)) {
    // First, so it is the first column of any table showing this data, and not editable, because
    // the next renumber would overwrite anything typed into it.
    addAttributeToDataSet(dataSet, { name: kEventNumberAttrName, editable: false },
                          dataSet.attributes[0]?.id);
  }
  const numberAttr = dataSet.attrFromName(kEventNumberAttrName);
  if (!numberAttr) return;

  // An event whose windowStart will not parse sorts last, matching the Timeline, which leaves such
  // a case out of `events` entirely.
  const startMs = (caseId: string) => {
    const time = DateTime.fromISO(dataSet.getStrValue(caseId, startAttr.id));
    return time.isValid ? time.toMillis() : Number.POSITIVE_INFINITY;
  };

  const inTimeOrder = dataSet.cases.map(c => c.__id__)
                        .sort((a, b) => startMs(a) - startMs(b));

  // Only what changes is written: merely opening a document must not dirty it, and a run that
  // appends in time order leaves every existing number alone.
  const changed: ICase[] = [];
  inTimeOrder.forEach((caseId, i) => {
    const eventNumber = i + 1;
    if (Number(dataSet.getStrValue(caseId, numberAttr.id)) !== eventNumber) {
      changed.push({ __id__: caseId, [numberAttr.id]: eventNumber });
    }
  });
  if (changed.length) dataSet.setCaseValues(changed, [numberAttr.id]);
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest src/plugins/shared-seismogram/event-numbering.test.ts`
Expected: all PASS.

- [ ] **Step 5: Mutation-check the two that are easy to get wrong**

This branch's convention is to break a mechanism and confirm its own test fails.

Temporarily change `inTimeOrder` to `dataSet.cases.map(c => c.__id__)` — dropping the sort — and
confirm "numbers by time order" fails. Restore it.

Temporarily change the write to `dataSet.setCaseValues(inTimeOrder.map((caseId, i) => ({ __id__: caseId, [numberAttr.id]: i + 1 })), [numberAttr.id])`
— writing every case unconditionally — and confirm "writes nothing when the numbers are already right" fails. Restore it.

Run after restoring: `npx jest src/plugins/shared-seismogram/event-numbering.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/shared-seismogram/event-numbering.ts \
        src/plugins/shared-seismogram/event-numbering.test.ts
git commit -m "Number seismic events by time order [CLUE-708]"
```

---

## Task 6: The Wave Runner numbers the events it records

**Files:**
- Modify: `src/plugins/wave-runner/models/wave-runner-content.ts`
- Test: `src/plugins/wave-runner/models/wave-runner-content.test.ts`

The write happens inside `runModel`, a long `flow` that also downloads data and drives a worker, so
there is no test that reaches it. Lift the recording step into its own action first: that is what
makes the behaviour testable, and it reads better than a dataset write buried mid-flow.

- [ ] **Step 1: Extract the recording step**

In `wave-runner-content.ts`, find this block inside `runModel`:

```ts
        const dataSet = self.getOrCreateEventsDataSet()?.dataSet;
        if (dataSet) {
          const models = getAppConfig(self)?.getSetting("models", "wave-runner") as ModelListEntry[] | undefined;
          const modelLabel = models?.find(m => m.metadataUrl === self.selectedModelUrl)?.label ?? "";
          addCasesToDataSet(dataSet, self.detectedEvents.map(evt => ({
            windowStart: new Date(evt.windowStart).toISOString(),
            windowEnd: new Date(evt.windowEnd).toISOString(),
            eventType: evt.eventType,
            confidence: evt.confidence,
            modelLabel,
          })));
        }

        self.detectedEvents = [];
```

Replace it in the flow with a single call:

```ts
        self.recordDetectedEvents();
```

and add the action beside `addDetectedEvents`, in the same `.actions` block:

```ts
    /** Moves the events the run has detected into the shared dataset, numbered in time order. */
    recordDetectedEvents() {
      const dataSet = self.getOrCreateEventsDataSet()?.dataSet;
      if (dataSet) {
        const models = getAppConfig(self)?.getSetting("models", "wave-runner") as ModelListEntry[] | undefined;
        const modelLabel = models?.find(m => m.metadataUrl === self.selectedModelUrl)?.label ?? "";
        addCasesToDataSet(dataSet, self.detectedEvents.map(evt => ({
          windowStart: new Date(evt.windowStart).toISOString(),
          windowEnd: new Date(evt.windowEnd).toISOString(),
          eventType: evt.eventType,
          confidence: evt.confidence,
          modelLabel,
        })));
      }
      self.detectedEvents = [];
    },
```

If `addDetectedEvents` sits in an earlier `.actions` block than the one `runModel` is in, put
`recordDetectedEvents` in that same earlier block so `runModel` can call it through `self`.

- [ ] **Step 2: Confirm the extraction changed nothing**

Run: `npx jest src/plugins/wave-runner`
Expected: all PASS. This is a pure move; nothing should react to it.

- [ ] **Step 3: Write the failing test**

Add to `wave-runner-content.test.ts`, after "addDetectedEvents drops events duplicating an existing
windowStart+eventType". `setupTileInDocument()` is the harness the file already uses when a shared
model manager is needed — `WaveRunnerContentModel.create()` on its own has no environment, so
`getOrCreateEventsDataSet` would return undefined.

```ts
  it("numbers the events it records, in time order rather than detection order", () => {
    const content = setupTileInDocument();
    const hour = (h: number) => Date.UTC(2026, 1, 1, h);
    // Detected out of order, as a re-run over an earlier range would produce.
    content.addDetectedEvents([
      { windowStart: hour(5), windowEnd: hour(6), eventType: "earthquake", confidence: 0.9 },
      { windowStart: hour(1), windowEnd: hour(2), eventType: "avalanche", confidence: 0.8 },
      { windowStart: hour(3), windowEnd: hour(4), eventType: "traffic", confidence: 0.7 }
    ]);

    content.recordDetectedEvents();

    const dataSet = content.getOrCreateEventsDataSet()!.dataSet;
    const numberAttr = dataSet.attrFromName(kEventNumberAttrName);
    expect(numberAttr).toBeDefined();
    const typeAttr = dataSet.attrFromName("eventType")!;
    const numberOf = (eventType: string) => {
      const match = dataSet.cases.find(c => dataSet.getStrValue(c.__id__, typeAttr.id) === eventType)!;
      return dataSet.getStrValue(match.__id__, numberAttr!.id);
    };

    expect(numberOf("avalanche")).toBe("1");
    expect(numberOf("traffic")).toBe("2");
    expect(numberOf("earthquake")).toBe("3");
  });
```

Add `import { kEventNumberAttrName } from "../../shared-seismogram/event-numbering";` to the test's
imports.

- [ ] **Step 4: Run to verify it fails**

Run: `npx jest src/plugins/wave-runner/models/wave-runner-content.test.ts -t "numbers the events"`
Expected: FAIL — `numberAttr` is undefined, because nothing writes event numbers yet.

- [ ] **Step 5: Renumber after appending**

In `wave-runner-content.ts`, import the helper:

```ts
import { renumberEvents } from "../../shared-seismogram/event-numbering";
```

and in `recordDetectedEvents`, inside the `if (dataSet)` block, immediately after
`addCasesToDataSet(...)`:

```ts
        // The numbers describe time order across every event recorded so far, so they are
        // rewritten after each day's events arrive rather than assigned on the way in.
        renumberEvents(dataSet);
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx jest src/plugins/wave-runner/models/wave-runner-content.test.ts`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/plugins/wave-runner/models/wave-runner-content.ts \
        src/plugins/wave-runner/models/wave-runner-content.test.ts
git commit -m "Number the events the Wave Runner records [CLUE-708]"
```

---

## Task 7: Verify the branch

- [ ] **Step 1: Run every test**

Run: `npx jest --silent 2>&1 | tail -6`
Expected: 0 failures.

- [ ] **Step 2: Type-check**

Run: `npm run check:types`
Expected: no output.

- [ ] **Step 3: Lint**

Run: `npm run lint:build 2>&1 | grep -E "^✖"`
Expected: `0 errors` on every line. Warnings already in the tree are fine; new ones in the touched
files are not.

- [ ] **Step 4: Confirm no snapshot blob came back**

Run: `grep -rn "toMatchInlineSnapshot" src/models/document/document-content-tests/dc-shared-models.test.ts`
Expected: no output.

Run: `grep -c "toMatchInlineSnapshot" src/models/document/drag-tiles.test.ts`
Expected: `5` — the Text-tile snapshots this story deliberately leaves alone.

- [ ] **Step 5: Self-review the diff**

Use the `code-self-review` skill over `git diff master...HEAD`.

- [ ] **Step 6: Check it by hand on localhost**

Nothing here depends on layout, so the tests carry the weight — but the column has never been seen.
Start the dev server, open a unit with a Wave Runner, run the model over a short range, and use
"Table It!".

- Event Number is the first column, before Event Type.
- Its values run 1..n in time order.
- A cell in it cannot be edited; a cell in another column still can.
- Sorting the table by Event Type leaves the numbers attached to their rows.

Run: `npm start`, and confirm the dev server reports 0 compile errors before judging anything.

- [ ] **Step 7: Push and open the PR**

Do not push until the hand-check passes and the user has confirmed.

---

## Notes carried from the spec

- **A run saved before this story shows no Event Number until the Wave Runner next writes to that
  dataset.** Numbering on load would cover those documents, but it means writing to a document
  merely by opening it, which is wrong in a read-only pane. Accepted deliberately.
- **The Timeline is not touched.** It already numbers by `windowStart` order, so both sides reach
  the same answer by the same rule, and documents saved without the attribute keep working.
- **The row-label column stays.** It is the row-select and drag handle, about rows rather than
  events; the Event Number is the first *data* column beside it.
