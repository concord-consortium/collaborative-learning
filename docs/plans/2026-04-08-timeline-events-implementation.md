# Timeline Events Display Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Display events from a SharedDataSet as colored rectangles overlaying the waveform in the timeline tile, with Prev/Next navigation and click-to-select.

**Architecture:** Add views to `TimelineContentModel` that read events from the tile's SharedDataSet. Add a persisted `selectedEventIndex` property with navigation actions. Render event rectangles as absolutely positioned divs over the waveform. A color map system maps event types to color words, then to hex values.

**Tech Stack:** React 17, MobX State Tree, TypeScript, SCSS

---

### Task 1: Add event color map constant

**Files:**
- Create: `src/plugins/timeline/timeline-event-colors.ts`

**Step 1: Create the color map file**

```ts
export const kEventColorWords = ["blue", "orange", "red", "yellow", "magenta", "purple"] as const;

export type EventColorWord = typeof kEventColorWords[number];

export interface ColorGroup {
  default: string;
}

export const kEventColorMap: Record<EventColorWord, ColorGroup> = {
  blue:    { default: "#aad7ff" },
  orange:  { default: "#ffd097" },
  red:     { default: "#ff9494" },
  yellow:  { default: "#e8ea95" },
  magenta: { default: "#eea3ff" },
  purple:  { default: "#cbb1ff" },
};
```

**Step 2: Commit**

```bash
git add src/plugins/timeline/timeline-event-colors.ts
git commit -m "feat: add event color map for timeline tile"
```

---

### Task 2: Add SharedDataSet and event views to TimelineContentModel

**Files:**
- Modify: `src/plugins/timeline/models/timeline-content.ts`

**Step 1: Write failing tests**

Add these tests to `src/plugins/timeline/models/timeline-content.test.ts`. The mock setup needs to return both a SharedSeismogram and a SharedDataSet from `getTileSharedModelsByType`. Update the existing mock to dispatch based on the model type argument:

```ts
import { SharedDataSet } from "../../../models/shared/shared-data-set";
import { SharedSeismogram } from "../../shared-seismogram/shared-seismogram";
import { DataSet, addAttributeToDataSet, addCasesToDataSet } from "../../../models/data/data-set";

// Helper to create a SharedDataSet with events
function createEventsDataSet(events: Array<{ windowStart: string; windowEnd: string; eventType: string }>) {
  const dataSet = DataSet.create();
  addAttributeToDataSet(dataSet, { name: "windowStart" });
  addAttributeToDataSet(dataSet, { name: "windowEnd" });
  addAttributeToDataSet(dataSet, { name: "eventType" });
  addAttributeToDataSet(dataSet, { name: "confidence" });
  addCasesToDataSet(dataSet, events.map(e => ({ ...e, confidence: "0.9" })));
  return SharedDataSet.create({ dataSet });
}
```

Update the `beforeEach` in the "zoom functionality" describe block so `getTileSharedModelsByType` checks which type is requested:

```ts
let mockSharedDataSet: any;

beforeEach(() => {
  const mockSharedSeismogram = {
    station: { network: "AK", station: "K204", location: "", channel: "HNZ" },
    startTime: dataStart,
    endTime: dataEnd,
  };
  mockSharedDataSet = undefined;

  mockedGetSharedModelManager.mockReturnValue({
    isReady: true,
    getTileSharedModelsByType: (_self: any, type: any) => {
      if (type === SharedSeismogram) return [mockSharedSeismogram];
      if (type === SharedDataSet) return mockSharedDataSet ? [mockSharedDataSet] : [];
      return [];
    },
  } as any);

  content = TimelineContentModel.create();
});
```

Add a new describe block for event views:

```ts
describe("event views", () => {
  const dataStart = DateTime.fromISO("2026-01-30T00:00:00.000Z");
  const dataEnd = DateTime.fromISO("2026-02-06T00:00:00.000Z");

  let content: ReturnType<typeof TimelineContentModel.create>;
  let mockSharedDataSet: any;

  beforeEach(() => {
    const mockSharedSeismogram = {
      station: { network: "AK", station: "K204", location: "", channel: "HNZ" },
      startTime: dataStart,
      endTime: dataEnd,
    };
    mockSharedDataSet = undefined;

    mockedGetSharedModelManager.mockReturnValue({
      isReady: true,
      getTileSharedModelsByType: (_self: any, type: any) => {
        if (type === SharedSeismogram) return [mockSharedSeismogram];
        if (type === SharedDataSet) return mockSharedDataSet ? [mockSharedDataSet] : [];
        return [];
      },
    } as any);

    content = TimelineContentModel.create();
  });

  afterEach(() => {
    mockedGetSharedModelManager.mockReset();
  });

  it("returns empty events when no shared dataset", () => {
    expect(content.events).toEqual([]);
  });

  it("parses events from shared dataset sorted by windowStart", () => {
    mockSharedDataSet = createEventsDataSet([
      { windowStart: "2026-01-31T00:00:00.000Z", windowEnd: "2026-01-31T01:00:00.000Z", eventType: "Earthquake" },
      { windowStart: "2026-01-30T12:00:00.000Z", windowEnd: "2026-01-30T13:00:00.000Z", eventType: "Noise" },
    ]);
    const events = content.events;
    expect(events).toHaveLength(2);
    // Should be sorted by windowStart
    expect(events[0].eventType).toBe("Noise");
    expect(events[1].eventType).toBe("Earthquake");
  });

  it("assigns color words by order of first appearance in dataset", () => {
    mockSharedDataSet = createEventsDataSet([
      { windowStart: "2026-01-30T12:00:00.000Z", windowEnd: "2026-01-30T13:00:00.000Z", eventType: "Earthquake" },
      { windowStart: "2026-01-31T00:00:00.000Z", windowEnd: "2026-01-31T01:00:00.000Z", eventType: "Noise" },
      { windowStart: "2026-02-01T00:00:00.000Z", windowEnd: "2026-02-01T01:00:00.000Z", eventType: "Earthquake" },
    ]);
    const colors = content.eventTypeColorWords;
    expect(colors.get("Earthquake")).toBe("blue");
    expect(colors.get("Noise")).toBe("orange");
  });

  it("returns visible events that overlap the view window", () => {
    mockSharedDataSet = createEventsDataSet([
      { windowStart: "2026-01-30T06:00:00.000Z", windowEnd: "2026-01-30T07:00:00.000Z", eventType: "Earthquake" },
      { windowStart: "2026-02-01T23:00:00.000Z", windowEnd: "2026-02-02T01:00:00.000Z", eventType: "Noise" },
      { windowStart: "2026-02-03T00:00:00.000Z", windowEnd: "2026-02-03T01:00:00.000Z", eventType: "Earthquake" },
      { windowStart: "2026-02-03T23:00:00.000Z", windowEnd: "2026-02-04T01:00:00.000Z", eventType: "Noise" },
      { windowStart: "2026-02-05T00:00:00.000Z", windowEnd: "2026-02-05T01:00:00.000Z", eventType: "Earthquake" },
    ]);
    // Set view to middle of data range
    content.setViewRange(
      DateTime.fromISO("2026-02-02T00:00:00.000Z"),
      DateTime.fromISO("2026-02-04T00:00:00.000Z")
    );
    const visible = content.visibleEvents;
    // Should include: event overlapping start edge, fully contained event, event overlapping end edge
    expect(visible).toHaveLength(3);
    expect(visible[0].windowStart.toISO()).toBe("2026-02-01T23:00:00.000Z");
    expect(visible[1].windowStart.toISO()).toBe("2026-02-03T00:00:00.000Z");
    expect(visible[2].windowStart.toISO()).toBe("2026-02-03T23:00:00.000Z");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest --no-watchman src/plugins/timeline/models/timeline-content.test.ts --no-coverage`
Expected: FAIL — `content.events` is not a property, etc.

**Step 3: Implement the views**

In `src/plugins/timeline/models/timeline-content.ts`, add imports at the top:

```ts
import { SharedDataSet, SharedDataSetType } from "../../../models/shared/shared-data-set";
import { kEventColorWords } from "../timeline-event-colors";
```

Add an interface for parsed events (above the model):

```ts
export interface TimelineEvent {
  index: number;
  windowStart: DateTime;
  windowEnd: DateTime;
  eventType: string;
}
```

Add a new views block after the `sharedSeismogram` view (after line 29):

```ts
get sharedDataSet() {
  const smm = getSharedModelManager(self);
  return smm?.getTileSharedModelsByType(self, SharedDataSet)[0] as SharedDataSetType | undefined;
},
```

Add a views block after the `dataEndTime` view (after line 50) for deriving events from the dataset:

```ts
.views(self => ({
  get events(): TimelineEvent[] {
    const ds = self.sharedDataSet?.dataSet;
    if (!ds) return [];
    const windowStartAttr = ds.attrFromName("windowStart");
    const windowEndAttr = ds.attrFromName("windowEnd");
    const eventTypeAttr = ds.attrFromName("eventType");
    if (!windowStartAttr || !windowEndAttr || !eventTypeAttr) {
      console.warn("Timeline: SharedDataSet missing required attribute(s)",
        { windowStart: !!windowStartAttr, windowEnd: !!windowEndAttr, eventType: !!eventTypeAttr });
      return [];
    }

    const events: TimelineEvent[] = [];
    for (const c of ds.cases) {
      const startStr = windowStartAttr.strValue(c.__id__);
      const endStr = windowEndAttr.strValue(c.__id__);
      const eventType = eventTypeAttr.strValue(c.__id__);
      const windowStart = DateTime.fromISO(startStr);
      const windowEnd = DateTime.fromISO(endStr);
      if (windowStart.isValid && windowEnd.isValid && eventType) {
        events.push({ index: 0, windowStart, windowEnd, eventType });
      }
    }
    events.sort((a, b) => a.windowStart.toMillis() - b.windowStart.toMillis());
    events.forEach((e, i) => e.index = i);
    return events;
  },
  get eventTypeColorWords(): Map<string, string> {
    const ds = self.sharedDataSet?.dataSet;
    if (!ds) return new Map();
    const eventTypeAttr = ds.attrFromName("eventType");
    if (!eventTypeAttr) return new Map();

    const colorMap = new Map<string, string>();
    let colorIndex = 0;
    for (const c of ds.cases) {
      const eventType = eventTypeAttr.strValue(c.__id__);
      if (eventType && !colorMap.has(eventType) && colorIndex < kEventColorWords.length) {
        colorMap.set(eventType, kEventColorWords[colorIndex]);
        colorIndex++;
      }
    }
    return colorMap;
  }
}))
```

Add a views block for `visibleEvents` (needs both `events` and view range):

```ts
.views(self => ({
  get visibleEvents(): TimelineEvent[] {
    if (!self.viewStartTime || !self.viewEndTime) return [];
    return self.events.filter(e =>
      e.windowEnd > self.viewStartTime! && e.windowStart < self.viewEndTime!
    );
  }
}))
```

Note: The `attrFromName` and `value` methods are part of the DataSet and Attribute MST models. Check those exist by reading the Attribute model if needed — they should be standard. If `attrFromName` doesn't exist, use `ds.attributes.find(a => a.name === "windowStart")` instead.

**Step 4: Run tests to verify they pass**

Run: `npx jest --no-watchman src/plugins/timeline/models/timeline-content.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/plugins/timeline/models/timeline-content.ts src/plugins/timeline/models/timeline-content.test.ts
git commit -m "feat: add SharedDataSet and event views to TimelineContentModel"
```

---

### Task 3: Add selectedEventIndex property and navigation actions

**Files:**
- Modify: `src/plugins/timeline/models/timeline-content.ts`
- Modify: `src/plugins/timeline/models/timeline-content.test.ts`

**Step 1: Write failing tests**

Add to the "event views" describe block in `timeline-content.test.ts`:

```ts
it("selectedEventIndex defaults to 0", () => {
  expect(content.selectedEventIndex).toBe(0);
});

it("selectedEventLabel shows 'Event' when no events", () => {
  expect(content.selectedEventLabel).toBe("Event");
});

it("selectedEventLabel shows 'Event 1' when events exist", () => {
  mockSharedDataSet = createEventsDataSet([
    { windowStart: "2026-01-31T00:00:00.000Z", windowEnd: "2026-01-31T01:00:00.000Z", eventType: "Earthquake" },
  ]);
  expect(content.selectedEventLabel).toBe("Event 1");
});

it("canSelectPrev is false when at first event", () => {
  mockSharedDataSet = createEventsDataSet([
    { windowStart: "2026-01-31T00:00:00.000Z", windowEnd: "2026-01-31T01:00:00.000Z", eventType: "Earthquake" },
  ]);
  expect(content.canSelectPrev).toBe(false);
});

it("canSelectNext is true when more events exist", () => {
  mockSharedDataSet = createEventsDataSet([
    { windowStart: "2026-01-31T00:00:00.000Z", windowEnd: "2026-01-31T01:00:00.000Z", eventType: "Earthquake" },
    { windowStart: "2026-02-01T00:00:00.000Z", windowEnd: "2026-02-01T01:00:00.000Z", eventType: "Noise" },
  ]);
  expect(content.canSelectNext).toBe(true);
});

it("selectNextEvent increments selectedEventIndex", () => {
  mockSharedDataSet = createEventsDataSet([
    { windowStart: "2026-01-31T00:00:00.000Z", windowEnd: "2026-01-31T01:00:00.000Z", eventType: "Earthquake" },
    { windowStart: "2026-02-01T00:00:00.000Z", windowEnd: "2026-02-01T01:00:00.000Z", eventType: "Noise" },
  ]);
  content.fitToData();
  content.selectNextEvent();
  expect(content.selectedEventIndex).toBe(1);
  expect(content.selectedEventLabel).toBe("Event 2");
});

it("selectPrevEvent decrements selectedEventIndex", () => {
  mockSharedDataSet = createEventsDataSet([
    { windowStart: "2026-01-31T00:00:00.000Z", windowEnd: "2026-01-31T01:00:00.000Z", eventType: "Earthquake" },
    { windowStart: "2026-02-01T00:00:00.000Z", windowEnd: "2026-02-01T01:00:00.000Z", eventType: "Noise" },
  ]);
  content.fitToData();
  content.selectNextEvent();
  content.selectPrevEvent();
  expect(content.selectedEventIndex).toBe(0);
});

it("selectEvent adjusts view to show event with 25% padding", () => {
  mockSharedDataSet = createEventsDataSet([
    { windowStart: "2026-02-01T00:00:00.000Z", windowEnd: "2026-02-01T01:00:00.000Z", eventType: "Earthquake" },
  ]);
  content.fitToData();
  content.selectEvent(0);
  // Event is 1 hour = 3600 seconds. Padding = 900 seconds on each side.
  // View should be 3600 + 900 + 900 = 5400 seconds
  expect(content.viewRangeSeconds).toBeCloseTo(5400, 0);
});

it("selectNextEvent adjusts view to show selected event", () => {
  mockSharedDataSet = createEventsDataSet([
    { windowStart: "2026-01-31T00:00:00.000Z", windowEnd: "2026-01-31T01:00:00.000Z", eventType: "Earthquake" },
    { windowStart: "2026-02-01T00:00:00.000Z", windowEnd: "2026-02-01T01:00:00.000Z", eventType: "Noise" },
  ]);
  content.fitToData();
  content.selectNextEvent();
  // Should adjust view to second event with padding
  const event = content.events[1];
  const duration = event.windowEnd.diff(event.windowStart, "seconds").seconds;
  const padding = duration * 0.25;
  expect(content.viewRangeSeconds).toBeCloseTo(duration + padding * 2, 0);
});

it("selectEvent clamps view to data bounds", () => {
  mockSharedDataSet = createEventsDataSet([
    // Event near the very start of data
    { windowStart: "2026-01-30T00:00:00.000Z", windowEnd: "2026-01-30T00:10:00.000Z", eventType: "Earthquake" },
  ]);
  content.fitToData();
  content.selectEvent(0);
  // Padding would push viewStart before dataStart — should clamp
  expect(content.viewStartTime!.toMillis()).toBeGreaterThanOrEqual(dataStart.toMillis());
});

it("selectEvent clamps index to valid range", () => {
  mockSharedDataSet = createEventsDataSet([
    { windowStart: "2026-01-31T00:00:00.000Z", windowEnd: "2026-01-31T01:00:00.000Z", eventType: "Earthquake" },
  ]);
  content.selectEvent(5);
  expect(content.selectedEventIndex).toBe(0);
  content.selectEvent(-1);
  expect(content.selectedEventIndex).toBe(0);
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest --no-watchman src/plugins/timeline/models/timeline-content.test.ts --no-coverage`
Expected: FAIL

**Step 3: Implement the property, views, and actions**

In `src/plugins/timeline/models/timeline-content.ts`:

Add the persisted property:

```ts
.props({
  type: types.optional(types.literal(kTimelineTileType), kTimelineTileType),
  viewStartTimeISO: types.maybe(types.string),
  viewEndTimeISO: types.maybe(types.string),
  selectedEventIndex: types.optional(types.number, 0),
})
```

Add views (in a views block that has access to `events`):

```ts
get selectedEvent() {
  const events = self.events;
  if (events.length === 0) return undefined;
  const idx = Math.max(0, Math.min(self.selectedEventIndex, events.length - 1));
  return events[idx];
},
get canSelectPrev() {
  return self.events.length > 0 && self.selectedEventIndex > 0;
},
get canSelectNext() {
  return self.selectedEventIndex < self.events.length - 1;
},
get selectedEventLabel() {
  if (self.events.length === 0) return "Event";
  return `Event ${self.selectedEventIndex + 1}`;
},
```

Add three separate actions blocks. The first defines `focusEvent` (needs `selectedEvent`, `setViewRange`):

```ts
.actions(self => ({
  focusEvent() {
    const event = self.selectedEvent;
    if (!event) return;
    // Adjust view to show the event with 25% padding
    const durationSeconds = event.windowEnd.diff(event.windowStart, "seconds").seconds;
    const paddingSeconds = durationSeconds * 0.25;
    let newStart = event.windowStart.minus({ seconds: paddingSeconds });
    let newEnd = event.windowEnd.plus({ seconds: paddingSeconds });
    // Clamp to data bounds
    if (self.dataStartTime && newStart < self.dataStartTime) {
      newStart = self.dataStartTime;
    }
    if (self.dataEndTime && newEnd > self.dataEndTime) {
      newEnd = self.dataEndTime;
    }
    self.setViewRange(newStart, newEnd);
  },
}))
```

The second defines `selectEvent` (needs `focusEvent`):

```ts
.actions(self => ({
  selectEvent(index: number) {
    const events = self.events;
    if (events.length === 0) return;
    self.selectedEventIndex = Math.max(0, Math.min(index, events.length - 1));
    self.focusEvent();
  },
}))
```

The third defines `selectNextEvent` and `selectPrevEvent` (needs `selectEvent`):

```ts
.actions(self => ({
  selectNextEvent() {
    if (self.canSelectNext) {
      self.selectEvent(self.selectedEventIndex + 1);
    }
  },
  selectPrevEvent() {
    if (self.canSelectPrev) {
      self.selectEvent(self.selectedEventIndex - 1);
    }
  },
}))
```

**Step 4: Run tests to verify they pass**

Run: `npx jest --no-watchman src/plugins/timeline/models/timeline-content.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/plugins/timeline/models/timeline-content.ts src/plugins/timeline/models/timeline-content.test.ts
git commit -m "feat: add selectedEventIndex and navigation actions to TimelineContentModel"
```

---

### Task 4: Wire up Prev/Next buttons and event label

**Files:**
- Modify: `src/plugins/timeline/components/timeline-tile.tsx`
- Modify: `src/plugins/timeline/components/timeline-tile.test.tsx`

**Step 1: Write failing tests**

Add to `src/plugins/timeline/components/timeline-tile.test.tsx`:

```ts
it("displays the selected event label", () => {
  renderWithStores();
  expect(screen.getByText("Event")).toBeInTheDocument();
});

it("Prev and Next buttons are disabled when no events exist", () => {
  renderWithStores();
  const prevButton = screen.getByText("Prev");
  const nextButton = screen.getByText("Next");
  expect(prevButton).toBeDisabled();
  expect(nextButton).toBeDisabled();
});
```

**Step 2: Run tests to verify they pass** (these should already pass with current code)

Run: `npx jest --no-watchman src/plugins/timeline/components/timeline-tile.test.tsx --no-coverage`

**Step 3: Update the component to wire up model**

In `src/plugins/timeline/components/timeline-tile.tsx`, add the model context and wire buttons:

```tsx
import { observer } from "mobx-react";
import React, { useContext } from "react";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { ITileProps } from "../../../components/tiles/tile-component";
import { TileToolbar } from "../../../components/toolbar/tile-toolbar";
import { isTimelineContentModel } from "../models/timeline-content";
import { Timeline } from "./timeline";
import { TimelineKey } from "./timeline-key";
import "../timeline-toolbar";
import "./timeline-tile.scss";

export const TimelineComponent: React.FC<ITileProps> = observer(function TimelineComponent({ readOnly, tileElt }) {
  const rawContent = useContext(TileModelContext)?.content;
  const model = isTimelineContentModel(rawContent) ? rawContent : undefined;

  return (
    <div className="tile-content timeline-tile">
      <BasicEditableTileTitle />
      <TileToolbar tileType="timeline" readOnly={!!readOnly} tileElement={tileElt} />
      <div className="timeline-content">
        <div className="event-row">
          <button disabled={!model?.canSelectPrev} onClick={() => model?.selectPrevEvent()}>Prev</button>
          <button disabled={!model?.canSelectNext} onClick={() => model?.selectNextEvent()}>Next</button>
          <div className="event-label">{model?.selectedEventLabel ?? "Event"}</div>
        </div>
        <div className="timeline-container">
          <Timeline />
        </div>
        <TimelineKey />
      </div>
    </div>
  );
});
```

**Step 4: Run tests to verify they pass**

Run: `npx jest --no-watchman src/plugins/timeline/ --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/plugins/timeline/components/timeline-tile.tsx src/plugins/timeline/components/timeline-tile.test.tsx
git commit -m "feat: wire up Prev/Next buttons and event label to model"
```

---

### Task 5: Create EventOverlay component

**Files:**
- Create: `src/plugins/timeline/components/event-overlay.tsx`
- Create: `src/plugins/timeline/components/event-overlay.scss`
- Modify: `src/plugins/timeline/components/timeline.tsx` (render `<EventOverlay />` inside the waveform area)
- Modify: `src/plugins/timeline/components/timeline.scss` (add a positioned wrapper around `<WaveformPanel>` so the overlay covers only the waveform, not the range row)

**Background:** `Timeline.tsx` currently renders a `<WaveformPanel>` and a `<div className="timeline-range-row">` as siblings inside `.timeline-area`. `EventOverlay` should overlay only the waveform, not the range row. To achieve this, wrap `<WaveformPanel>` in a new `.waveform-wrapper` div with `position: relative`, and render `<EventOverlay />` as a sibling inside that wrapper.

**Step 1: Create the hexToRgba helper and EventOverlay component**

Create `src/plugins/timeline/components/event-overlay.tsx`:

```tsx
import { observer } from "mobx-react-lite";
import React, { useContext } from "react";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { isTimelineContentModel, TimelineEvent } from "../models/timeline-content";
import { kEventColorMap, EventColorWord } from "../timeline-event-colors";

import "./event-overlay.scss";

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const EventOverlay = observer(function EventOverlay() {
  const rawContent = useContext(TileModelContext)?.content;
  const model = isTimelineContentModel(rawContent) ? rawContent : undefined;
  if (!model) return null;

  const startTime = model.viewStartTime;
  const endTime = model.viewEndTime;
  const visibleEvents = model.visibleEvents;
  const colorWords = model.eventTypeColorWords;

  function getEventPosition(event: TimelineEvent) {
    if (!startTime || !endTime) return null;
    const viewStartMs = startTime.toMillis();
    const viewEndMs = endTime.toMillis();
    const viewDuration = viewEndMs - viewStartMs;
    if (viewDuration <= 0) return null;

    const leftPct = ((event.windowStart.toMillis() - viewStartMs) / viewDuration) * 100;
    const rightPct = ((event.windowEnd.toMillis() - viewStartMs) / viewDuration) * 100;
    const widthPct = rightPct - leftPct;

    return { leftPct, widthPct };
  }

  return (
    <>
      {visibleEvents.map((event, i) => {
        const pos = getEventPosition(event);
        if (!pos) return null;
        const colorWord = colorWords.get(event.eventType) as EventColorWord | undefined;
        const color = colorWord ? kEventColorMap[colorWord].default : "#aad7ff";
        return (
          <React.Fragment key={i}>
            <div
              className="event-overlay"
              style={{
                left: `${pos.leftPct}%`,
                width: `${pos.widthPct}%`,
                backgroundColor: hexToRgba(color, 0.5),
              }}
              onClick={() => model.selectEvent(event.index)}
            />
            <button
              className="event-label-button"
              style={{
                left: `${pos.leftPct + pos.widthPct / 2}%`,
                backgroundColor: color,
              }}
              onClick={() => model.selectEvent(event.index)}
            >
              {event.index + 1}
            </button>
          </React.Fragment>
        );
      })}
    </>
  );
});
```

**Step 2: Create SCSS**

Create `src/plugins/timeline/components/event-overlay.scss`:

```scss
.event-overlay {
  position: absolute;
  top: 0;
  height: 100%;
  cursor: pointer;
}

.event-label-button {
  position: absolute;
  top: -24px;
  transform: translateX(-50%);
  width: 24px;
  height: 20px;
  border: none;
  cursor: pointer;
  color: #121212;
  font-size: 12px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

**Step 3: Add EventOverlay to Timeline.tsx**

In `src/plugins/timeline/components/timeline.tsx`, import `EventOverlay` and wrap `<WaveformPanel>` in a `.waveform-wrapper` div, with `<EventOverlay />` as a sibling:

```tsx
import { EventOverlay } from "./event-overlay";
```

Replace the waveform/range-row block inside the conditional with:

```tsx
{sharedSeismogram && isValidDateTime(startTime) && isValidDateTime(endTime) ? (
  <>
    <div className="waveform-wrapper">
      <WaveformPanel
        label="Full waveform"
        sharedSeismogram={sharedSeismogram}
        startTime={startTime}
        endTime={endTime}
      />
      <EventOverlay />
    </div>
    <div className="timeline-range-row">
      {/* ...existing range row content unchanged... */}
    </div>
  </>
) : <div className="waveform" />}
```

**Step 4: Update timeline.scss**

Add `.waveform-wrapper` as a positioned wrapper inside `.timeline-area`:

```scss
.timeline-area {
  // ...existing rules...

  .waveform-wrapper {
    position: relative;
  }
}
```

**Step 5: Run tests**

Run: `npx jest --no-watchman src/plugins/timeline/ --no-coverage`
Expected: PASS

**Step 6: Commit**

```bash
git add src/plugins/timeline/components/event-overlay.tsx src/plugins/timeline/components/event-overlay.scss src/plugins/timeline/components/timeline.tsx src/plugins/timeline/components/timeline.scss
git commit -m "feat: add EventOverlay component to render event rectangles with label buttons"
```

---

### Task 6: Update TimelineKey to show event types

**Files:**
- Modify: `src/plugins/timeline/components/timeline-key.tsx`
- Modify: `src/plugins/timeline/components/timeline-key.scss`

**Step 1: Update the component**

In `src/plugins/timeline/components/timeline-key.tsx`:

```tsx
import { observer } from "mobx-react-lite";
import React, { useContext } from "react";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { isTimelineContentModel } from "../models/timeline-content";
import { kEventColorMap, EventColorWord } from "../timeline-event-colors";

import "./timeline-key.scss";

export const TimelineKey = observer(function TimelineKey() {
  const rawContent = useContext(TileModelContext)?.content;
  const model = isTimelineContentModel(rawContent) ? rawContent : undefined;
  const colorWords = model?.eventTypeColorWords ?? new Map();

  return (
    <div className="timeline-key">
      <div className="key-title">Event Key</div>
      <div className="event-types">
        {Array.from(colorWords.entries()).map(([eventType, colorWord]) => {
          const color = kEventColorMap[colorWord as EventColorWord]?.default ?? "#aad7ff";
          return (
            <div key={eventType} className="event-type-entry">
              <div className="color-swatch" style={{ backgroundColor: color }} />
              <span className="event-type-label">{eventType}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
```

**Step 2: Update SCSS**

In `src/plugins/timeline/components/timeline-key.scss`:

```scss
.timeline-key {
  display: flex;

  .key-title {
    font-weight: bold;
    margin-right: 5px;
  }

  .event-types {
    display: flex;
    gap: 10px;

    .event-type-entry {
      display: flex;
      align-items: center;
      gap: 4px;

      .color-swatch {
        width: 16px;
        height: 16px;
        border-radius: 2px;
      }
    }
  }
}
```

**Step 3: Run tests**

Run: `npx jest --no-watchman src/plugins/timeline/ --no-coverage`
Expected: PASS

**Step 4: Commit**

```bash
git add src/plugins/timeline/components/timeline-key.tsx src/plugins/timeline/components/timeline-key.scss
git commit -m "feat: display event type legend in TimelineKey component"
```

---

### Task 7: Final integration test and type check

**Step 1: Run full timeline test suite**

Run: `npx jest --no-watchman src/plugins/timeline/ --no-coverage`
Expected: PASS

**Step 2: Run TypeScript type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run lint**

Run: `npm run lint -- --quiet`
Expected: No errors (or only pre-existing ones)

**Step 4: Fix any issues found, commit fixes**

```bash
git add -A
git commit -m "fix: address lint and type errors from timeline events feature"
```
