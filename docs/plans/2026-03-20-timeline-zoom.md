# Timeline Zoom Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add zoom in/out/fit functionality to the Timeline tile so users can view a sub-range of the seismogram waveform.

**Architecture:** Add `viewStartTimeISO` and `viewEndTimeISO` persisted props (ISO 8601 strings) to TimelineContentModel, initialized from the SharedSeismogram's full range. Computed views convert these to Luxon DateTime objects. Zoom actions adjust these times around the current center, clamped to the shared model's range. The WaveformPanel already supports arbitrary time windows via its `startTime`/`durationSeconds` props—we just need to feed it the tile's zoom state instead of the full seismogram range.

**Tech Stack:** MobX State Tree (models/actions/views), React (toolbar buttons), seisplotjs (Luxon DateTime for time values)

---

### Task 1: Add start/end time views to SharedSeismogram

**Files:**
- Modify: `src/plugins/shared-seismogram/shared-seismogram.ts:30-33`
- Test: `src/plugins/shared-seismogram/shared-seismogram.test.ts`

**Step 1: Write the failing test**

In `shared-seismogram.test.ts`, add a test that checks `startTime` and `endTime` views exist and return the seismogram's times:

```typescript
it("exposes startTime and endTime from the seismogram", () => {
  const model = SharedSeismogram.create();
  // Before data is loaded, should be undefined
  expect(model.startTime).toBeUndefined();
  expect(model.endTime).toBeUndefined();

  // After setting a seismogram, should reflect its times
  model.setSeismogram(mockSeismogram);
  expect(model.startTime).toBe(mockSeismogram.startTime);
  expect(model.endTime).toBe(mockSeismogram.endTime);
});
```

Note: The test file already creates a `mockSeismogram` via `miniseed.merge()`. Use the existing mock setup. If `mockSeismogram` isn't already stored in a variable, extract the seismogram creation from the existing `setSeismogram` test into a shared variable.

**Step 2: Run the test to verify it fails**

Run: `npx jest --no-watchman src/plugins/shared-seismogram/shared-seismogram.test.ts -t "exposes startTime" --no-coverage`
Expected: FAIL — `model.startTime` is not a property

**Step 3: Implement the views**

In `shared-seismogram.ts`, add `startTime` and `endTime` views to the existing `.views()` block (lines 30-33):

```typescript
.views(self => ({
  get hasData() {
    return self.seismogram !== undefined;
  },
  get startTime() {
    return self.seismogram?.startTime;
  },
  get endTime() {
    return self.seismogram?.endTime;
  }
}))
```

**Step 4: Run the test to verify it passes**

Run: `npx jest --no-watchman src/plugins/shared-seismogram/shared-seismogram.test.ts --no-coverage`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/plugins/shared-seismogram/shared-seismogram.ts src/plugins/shared-seismogram/shared-seismogram.test.ts
git commit -m "feat: add startTime and endTime views to SharedSeismogram"
```

---

### Task 2: Add zoom state and actions to TimelineContentModel

**Files:**
- Modify: `src/plugins/timeline/models/timeline-content.ts`
- Test: `src/plugins/timeline/models/timeline-content.test.ts`

This is the core task. The model needs:
- `viewStartTimeISO` and `viewEndTimeISO` as MST props (`types.maybe(types.string)`) storing ISO 8601 strings, so the zoom state persists across page reloads
- Computed views `viewStartTime` and `viewEndTime` that convert the ISO strings to Luxon DateTime objects
- `setViewRange(start, end)` action (takes DateTime, stores as ISO)
- `zoom(factor)` action — multiplies the range by `factor`, keeping center. Factor < 1 zooms in, factor > 1 zooms out. Clamped to shared model range (shifted from edges if needed) and minimum range.
- `fitToData()` action — resets to full shared model range. Also used to initialize the view range when data first loads.
- Views: `canZoomIn`, `canZoomOut`, `canFitToData`, `viewStartTime`, `viewEndTime`

**Constant:** `kMinViewRangeSeconds = 5` — minimum zoom range in seconds.

**Step 1: Write the failing tests**

In `timeline-content.test.ts`, replace the existing content with comprehensive tests. You'll need to mock the SharedSeismogram. Use the existing test patterns from the codebase.

Since TimelineContentModel accesses the SharedSeismogram via `getSharedModelManager(self)`, and this requires a full document/tile setup, create a helper that sets up the model with a mock shared model manager. Look at how other tile tests mock `getSharedModelManager` — search for `getSharedModelManager` in test files for patterns.

If mocking the shared model manager is complex, an alternative approach: test the zoom logic via a simpler helper or by directly testing the actions with injected start/end times. The key tests needed:

```typescript
describe("zoom functionality", () => {
  // Setup: create a TimelineContentModel with a mock sharedSeismogram
  // that has startTime = DateTime(2026-01-30) and endTime = DateTime(2026-02-06)
  // (7 days = 604800 seconds)

  it("fitToData sets view range to shared seismogram range", () => {
    // After fitToData, viewStartTime and viewEndTime should match shared model
  });

  it("zoom(0.5) halves the time range around center", () => {
    // Starting from full range (604800s), zoom(0.5) should give 302400s range centered
  });

  it("zoom(2) doubles the time range around center", () => {
    // After zooming in, zoom(2) should restore the range
  });

  it("zoom(2) clamps to shared model range", () => {
    // At full range, zoom(2) should not exceed shared model bounds
  });

  it("zoom(2) shifts from edge when clamped", () => {
    // If zoomed in near the start edge, zooming out should shift right
    // to maintain target range size rather than exceeding the start boundary
  });

  it("zoom(0.5) respects minimum range of 5 seconds", () => {
    // Repeatedly zoom in — should stop at kMinViewRangeSeconds
  });

  it("canZoomIn is false at minimum range", () => {
    // When range <= kMinViewRangeSeconds, canZoomIn should be false
  });

  it("canZoomOut is false at full range", () => {
    // When range matches shared model range, canZoomOut should be false
  });

  it("fitToData resets to full range", () => {
    // After zooming in, fitToData should restore original range
  });

  it("canFitToData is false when already at full range", () => {
    // When range matches shared model range, canFitToData should be false
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest --no-watchman src/plugins/timeline/models/timeline-content.test.ts --no-coverage`
Expected: FAIL

**Step 3: Implement the model changes**

In `timeline-content.ts`:

```typescript
import { types, Instance } from "mobx-state-tree";
import { DateTime } from "luxon";
import { ITileContentModel, TileContentModel } from "../../../models/tiles/tile-content";
import { getSharedModelManager } from "../../../models/tiles/tile-environment";
import { SharedSeismogram } from "../../shared-seismogram/shared-seismogram";
import { kTimelineTileType } from "../timeline-types";

export const kMinViewRangeSeconds = 5;

export function defaultTimelineContent(): TimelineContentModelType {
  return TimelineContentModel.create();
}

export const TimelineContentModel = TileContentModel
  .named("TimelineTool")
  .props({
    type: types.optional(types.literal(kTimelineTileType), kTimelineTileType),
    viewStartTimeISO: types.maybe(types.string),
    viewEndTimeISO: types.maybe(types.string),
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    get sharedSeismogram() {
      const smm = getSharedModelManager(self);
      return smm?.findFirstSharedModelByType(SharedSeismogram);
    },
    get viewStartTime() {
      return self.viewStartTimeISO ? DateTime.fromISO(self.viewStartTimeISO) : undefined;
    },
    get viewEndTime() {
      return self.viewEndTimeISO ? DateTime.fromISO(self.viewEndTimeISO) : undefined;
    }
  }))
  .views(self => ({
    get seismogram() {
      return self.sharedSeismogram?.seismogram;
    },
    get dataStartTime() {
      return self.sharedSeismogram?.startTime;
    },
    get dataEndTime() {
      return self.sharedSeismogram?.endTime;
    }
  }))
  .views(self => ({
    get viewRangeSeconds() {
      if (!self.viewStartTime || !self.viewEndTime) return undefined;
      return self.viewEndTime.diff(self.viewStartTime, "seconds").seconds;
    },
    get dataRangeSeconds() {
      if (!self.dataStartTime || !self.dataEndTime) return undefined;
      return self.dataEndTime.diff(self.dataStartTime, "seconds").seconds;
    }
  }))
  .views(self => ({
    get canZoomIn() {
      const range = self.viewRangeSeconds;
      return range !== undefined && range > kMinViewRangeSeconds;
    },
    get canZoomOut() {
      const viewRange = self.viewRangeSeconds;
      const dataRange = self.dataRangeSeconds;
      if (viewRange === undefined || dataRange === undefined) return false;
      return viewRange < dataRange;
    }
  }))
  .views(self => ({
    get canFitToData() {
      return self.canZoomOut;
    }
  }))
  .actions(self => ({
    setViewRange(start: DateTime, end: DateTime) {
      self.viewStartTimeISO = start.toISO();
      self.viewEndTimeISO = end.toISO();
    }
  }))
  .actions(self => ({
    fitToData() {
      if (self.dataStartTime && self.dataEndTime) {
        self.setViewRange(self.dataStartTime, self.dataEndTime);
      }
    },
    zoom(factor: number) {
      if (!self.viewStartTime || !self.viewEndTime) return;
      if (!self.dataStartTime || !self.dataEndTime) return;
      const currentRange = self.viewRangeSeconds!;
      const dataRange = self.dataRangeSeconds!;
      // Clamp to [kMinViewRangeSeconds, dataRange]
      const newRange = Math.max(Math.min(currentRange * factor, dataRange), kMinViewRangeSeconds);
      const center = self.viewStartTime.plus({ seconds: currentRange / 2 });
      let newStart = center.minus({ seconds: newRange / 2 });
      let newEnd = center.plus({ seconds: newRange / 2 });

      // Shift if bumping into edges
      if (newStart < self.dataStartTime) {
        newStart = self.dataStartTime;
        newEnd = newStart.plus({ seconds: newRange });
      }
      if (newEnd > self.dataEndTime) {
        newEnd = self.dataEndTime;
        newStart = newEnd.minus({ seconds: newRange });
      }

      self.setViewRange(newStart, newEnd);
    }
  }));
```

**Important implementation notes:**
- Luxon `DateTime` comparison uses `<` and `>` operators (compares milliseconds).
- `viewStartTimeISO` and `viewEndTimeISO` are MST props (persisted), so the zoom level survives page reloads. The computed views `viewStartTime`/`viewEndTime` convert them to Luxon DateTime objects.
- `setViewRange` accepts DateTime objects and stores them as ISO strings via `toISO()`.
- `canFitToData` delegates to `canZoomOut` since both check "not already at full range."

**Step 4: Run tests to verify they pass**

Run: `npx jest --no-watchman src/plugins/timeline/models/timeline-content.test.ts --no-coverage`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/plugins/timeline/models/timeline-content.ts src/plugins/timeline/models/timeline-content.test.ts
git commit -m "feat: add zoom state and actions to TimelineContentModel"
```

---

### Task 3: Wire up toolbar buttons to model actions

**Files:**
- Modify: `src/plugins/timeline/timeline-toolbar.tsx`
- Test: `src/plugins/timeline/components/timeline-tile.test.tsx`

**Step 1: Write failing tests**

In `timeline-tile.test.tsx`, add tests that verify the zoom buttons' disabled state and click behavior. Since we don't have a real SharedSeismogram in the test, the buttons should be disabled when there's no data. For a more complete test, set up a mock shared model manager.

At minimum, add:

```typescript
it("zoom buttons are disabled when no seismogram data is available", () => {
  renderWithStores();
  const zoomInButton = screen.getByTitle("Zoom In");
  const zoomOutButton = screen.getByTitle("Zoom Out");
  const viewAllButton = screen.getByTitle("View All");
  expect(zoomInButton.closest("button")).toBeDisabled();
  expect(zoomOutButton.closest("button")).toBeDisabled();
  expect(viewAllButton.closest("button")).toBeDisabled();
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest --no-watchman src/plugins/timeline/components/timeline-tile.test.tsx --no-coverage`
Expected: The test may already pass since buttons are currently hardcoded disabled. If so, skip to step 3.

**Step 3: Implement the toolbar button wiring**

In `timeline-toolbar.tsx`, update the zoom buttons to access the model via `TileModelContext` and call its actions:

```typescript
import React, { useContext } from "react";
import { observer } from "mobx-react-lite";
import { TileModelContext } from "../../components/tiles/tile-api";
import { TileToolbarButton } from "../../components/toolbar/tile-toolbar-button";
import {
  IToolbarButtonComponentProps, registerTileToolbarButtons
} from "../../components/toolbar/toolbar-button-manager";
import { isTimelineContentModel } from "./models/timeline-content";

// ... (keep existing icon imports and TableIt/DataCardIt/BarGraphIt buttons unchanged)

const ZoomInButton = observer(function ZoomInButton({ name }: IToolbarButtonComponentProps) {
  const model = useContext(TileModelContext);
  const content = isTimelineContentModel(model?.content) ? model?.content : undefined;
  return (
    <TileToolbarButton
      name={name}
      title="Zoom In"
      onClick={() => content?.zoom(0.5)}
      disabled={!content?.canZoomIn}
    >
      <ZoomInIcon/>
    </TileToolbarButton>
  );
});

const ZoomOutButton = observer(function ZoomOutButton({ name }: IToolbarButtonComponentProps) {
  const model = useContext(TileModelContext);
  const content = isTimelineContentModel(model?.content) ? model?.content : undefined;
  return (
    <TileToolbarButton
      name={name}
      title="Zoom Out"
      onClick={() => content?.zoom(2)}
      disabled={!content?.canZoomOut}
    >
      <ZoomOutIcon/>
    </TileToolbarButton>
  );
});

const ViewAllButton = observer(function ViewAllButton({ name }: IToolbarButtonComponentProps) {
  const model = useContext(TileModelContext);
  const content = isTimelineContentModel(model?.content) ? model?.content : undefined;
  return (
    <TileToolbarButton
      name={name}
      title="View All"
      onClick={() => content?.fitToData()}
      disabled={!content?.canFitToData}
    >
      <ZoomToFitIcon/>
    </TileToolbarButton>
  );
});
```

**Key changes:**
- Buttons become `observer` components (wrap with `observer` from `mobx-react-lite`)
- Use `useContext(TileModelContext)` to get the tile model
- Extract timeline content with `isTimelineContentModel` guard
- Wire `onClick` to model actions and `disabled` to model views

**Step 4: Run tests to verify they pass**

Run: `npx jest --no-watchman src/plugins/timeline/components/timeline-tile.test.tsx --no-coverage`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/plugins/timeline/timeline-toolbar.tsx src/plugins/timeline/components/timeline-tile.test.tsx
git commit -m "feat: wire zoom toolbar buttons to TimelineContentModel actions"
```

---

### Task 4: Update Timeline component to use zoom state

**Files:**
- Modify: `src/plugins/timeline/components/timeline.tsx`
- Test: `src/plugins/timeline/components/timeline-tile.test.tsx` (or a new `timeline.test.tsx` if needed)

**Step 1: Write failing test**

This is primarily a wiring change. The key behavior: when the model has `viewStartTime`/`viewEndTime`, pass those to WaveformPanel instead of the full seismogram range. Testing this in isolation is tricky since WaveformPanel renders a canvas element. Verify through the integration test or manual testing.

If a unit test is feasible, test that the Timeline component passes the model's view range to WaveformPanel.

**Step 2: Implement the component change**

In `timeline.tsx`, update to use the model's view times:

```typescript
import { observer } from "mobx-react-lite";
import React, { useContext, useEffect } from "react";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { WaveformPanel } from "../../shared-seismogram/components/waveform-panel";
import { isTimelineContentModel } from "../models/timeline-content";

import "./timeline.scss";

export const Timeline = observer(function Timeline() {
  const rawContent = useContext(TileModelContext)?.content;
  const model = isTimelineContentModel(rawContent) ? rawContent : undefined;
  const seismogram = model?.seismogram;

  // Initialize view range when seismogram data becomes available
  useEffect(() => {
    if (seismogram && !model?.viewStartTime) {
      model?.fitToData();
    }
  }, [seismogram, model]);

  const startTime = model?.viewStartTime;
  const endTime = model?.viewEndTime;

  return (
    <div className="timeline-area">
      {seismogram && startTime && endTime ? (
        <WaveformPanel
          label="Full waveform"
          startTime={startTime}
          durationSeconds={endTime.diff(startTime, "seconds").seconds}
          seismogram={seismogram}
        />
      ) : <div className="waveform" />}
    </div>
  );
});
```

**Key changes:**
- Added `useEffect` to call `initializeViewRange()` when seismogram data first arrives
- Use `model.viewStartTime` and `model.viewEndTime` instead of `seismogram.startTime`/`seismogram.endTime`
- The `!model?.viewStartTime` check prevents re-initialization on re-renders

**Step 3: Run all timeline tests**

Run: `npx jest --no-watchman src/plugins/timeline/ --no-coverage`
Expected: All tests PASS

**Step 4: Manual verification**

Run: `npm start`
- Open a document with a Timeline tile and seismogram data
- Verify the waveform displays the full range initially
- Click Zoom In — waveform should show half the time range, centered
- Click Zoom In repeatedly — should stop at 5 seconds
- Click Zoom Out — should expand the range
- Click View All — should restore to full range
- Zoom in, then pan near an edge (if panning exists), then zoom out — verify it shifts from the edge

**Step 5: Commit**

```bash
git add src/plugins/timeline/components/timeline.tsx
git commit -m "feat: display zoomed time range in Timeline waveform"
```

---

### Task 5: Run full test suite and fix any issues

**Step 1: Run all tests**

Run: `npx jest --no-watchman --no-coverage`
Expected: All tests PASS

**Step 2: Run lint**

Run: `npm run lint`
Expected: No new lint errors

**Step 3: Run type check**

Run: `npm run check:types`
Expected: No type errors

**Step 4: Fix any issues found in steps 1-3**

**Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address lint and type issues from timeline zoom implementation"
```
