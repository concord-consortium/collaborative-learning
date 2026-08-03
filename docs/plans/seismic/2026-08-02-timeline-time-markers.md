# Timeline Time Markers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show a hover time marker (vertical line + date/time label) on the timeline waveform, and let the user pin one stationary marker by clicking, per [2026-08-02-timeline-time-markers-design.md](./2026-08-02-timeline-time-markers-design.md).

**Architecture:** Marker state (`hoverTime`, `pinnedTime`) lives in `.volatile()` on `TimelineContentModel` — never serialized. A new `TimeMarkerOverlay` component renders the markers as absolutely-positioned children of `.waveform-wrapper`. Mouse handlers are passed through `WaveformPanel` via new optional props; `Timeline` converts mouse x → time.

**Tech Stack:** React 17 + MST (Concord fork) + luxon `DateTime`. Jest + @testing-library/react (jsdom).

**Important project conventions:**
- Run jest with `--no-watchman`: `npm test -- --no-watchman <path>`
- Show all file changes (especially SCSS) as Edit-tool diffs so the user can review them in the IDE before applying. Never change CSS beyond what this plan specifies without asking.
- Use `classNames` helper only when classes are conditional/computed; plain string literals are fine for static classes.

---

### Task 1: Volatile marker state and actions on TimelineContentModel

**Files:**
- Modify: `src/plugins/timeline/models/timeline-content.ts`
- Test: `src/plugins/timeline/models/timeline-content.test.ts`

**Step 1: Write the failing tests**

Add a new describe block at the end of `timeline-content.test.ts`:

```ts
describe("time markers", () => {
  const viewStart = DateTime.fromISO("2026-02-01T00:00:00.000Z");
  const viewEnd = DateTime.fromISO("2026-02-02T00:00:00.000Z");

  it("hoverTime and pinnedTime default to undefined", () => {
    const content = TimelineContentModel.create();
    expect(content.hoverTime).toBeUndefined();
    expect(content.pinnedTime).toBeUndefined();
  });

  it("setHoverTime and clearHoverTime update hoverTime", () => {
    const content = TimelineContentModel.create();
    const time = DateTime.fromISO("2026-02-01T12:00:00.000Z");
    content.setHoverTime(time);
    expect(content.hoverTime?.toISO()).toBe(time.toISO());
    content.clearHoverTime();
    expect(content.hoverTime).toBeUndefined();
  });

  it("setPinnedTime and clearPinnedTime update pinnedTime", () => {
    const content = TimelineContentModel.create();
    const time = DateTime.fromISO("2026-02-01T12:00:00.000Z");
    content.setPinnedTime(time);
    expect(content.pinnedTime?.toISO()).toBe(time.toISO());
    content.clearPinnedTime();
    expect(content.pinnedTime).toBeUndefined();
  });

  it("marker times are volatile, not serialized", () => {
    const content = TimelineContentModel.create();
    content.setPinnedTime(DateTime.fromISO("2026-02-01T12:00:00.000Z"));
    expect(JSON.parse(content.exportJson())).not.toHaveProperty("pinnedTime");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- --no-watchman src/plugins/timeline/models/timeline-content.test.ts`
Expected: the four new tests FAIL (`hoverTime`/`setHoverTime` do not exist); all pre-existing tests PASS.

**Step 3: Implement volatile state and actions**

In `timeline-content.ts`, add a `.volatile()` block immediately after `.props({...})` (before the first `.views`):

```ts
  .volatile(self => ({
    hoverTime: undefined as DateTime | undefined,
    pinnedTime: undefined as DateTime | undefined,
  }))
```

Add a new `.actions` block after the existing view blocks (e.g. just before the `setViewRange` actions block):

```ts
  .actions(self => ({
    setHoverTime(time: DateTime) {
      self.hoverTime = time;
    },
    clearHoverTime() {
      self.hoverTime = undefined;
    },
    setPinnedTime(time: DateTime) {
      self.pinnedTime = time;
    },
    clearPinnedTime() {
      self.pinnedTime = undefined;
    },
  }))
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- --no-watchman src/plugins/timeline/models/timeline-content.test.ts`
Expected: PASS (all tests).

**Step 5: Commit**

```bash
git add src/plugins/timeline/models/timeline-content.ts src/plugins/timeline/models/timeline-content.test.ts
git commit -m "Add volatile time marker state to timeline content model."
```

---

### Task 2: timeToViewPct view

**Files:**
- Modify: `src/plugins/timeline/models/timeline-content.ts`
- Test: `src/plugins/timeline/models/timeline-content.test.ts`

**Step 1: Write the failing tests**

Add to the `time markers` describe block:

```ts
  it("timeToViewPct returns undefined when there is no view range", () => {
    const content = TimelineContentModel.create();
    expect(content.timeToViewPct(viewStart)).toBeUndefined();
  });

  it("timeToViewPct maps times within the view range to 0-100", () => {
    const content = TimelineContentModel.create();
    content.setViewRange(viewStart, viewEnd);
    expect(content.timeToViewPct(viewStart)).toBe(0);
    expect(content.timeToViewPct(viewEnd)).toBe(100);
    expect(content.timeToViewPct(viewStart.plus({ hours: 6 }))).toBe(25);
  });

  it("timeToViewPct maps times outside the view range to <0 or >100", () => {
    const content = TimelineContentModel.create();
    content.setViewRange(viewStart, viewEnd);
    expect(content.timeToViewPct(viewStart.minus({ hours: 6 }))).toBe(-25);
    expect(content.timeToViewPct(viewEnd.plus({ hours: 12 }))).toBe(150);
  });
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- --no-watchman src/plugins/timeline/models/timeline-content.test.ts`
Expected: new tests FAIL (`timeToViewPct` is not a function).

**Step 3: Implement the view**

In `timeline-content.ts`, add to the second `.views` block (the one containing `hasStationData` — it can see `viewStartTime`/`viewEndTime`):

```ts
    timeToViewPct(time: DateTime): number | undefined {
      if (!self.viewStartTime || !self.viewEndTime) return undefined;
      const viewStartMs = self.viewStartTime.toMillis();
      const viewDurationMs = self.viewEndTime.toMillis() - viewStartMs;
      if (viewDurationMs <= 0) return undefined;
      return (time.toMillis() - viewStartMs) / viewDurationMs * 100;
    },
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- --no-watchman src/plugins/timeline/models/timeline-content.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/plugins/timeline/models/timeline-content.ts src/plugins/timeline/models/timeline-content.test.ts
git commit -m "Add timeToViewPct view to timeline content model."
```

---

### Task 3: Refactor EventOverlay to use timeToViewPct; make event rectangles click-through

**Files:**
- Modify: `src/plugins/timeline/components/event-overlay.tsx`
- Modify: `src/plugins/timeline/components/event-overlay.scss`

The rectangles will sit on top of the waveform panel, which is about to receive mouse handlers (Task 4); `pointer-events: none` lets hover/click pass through them. The label buttons keep pointer events and sit above the panel, so they are unaffected.

**Step 1: Refactor getEventPosition**

In `event-overlay.tsx`, replace the `getEventPosition` function (and remove the now-unused `startTime`/`endTime` locals if nothing else uses them):

```ts
  function getEventPosition(event: TimelineEvent) {
    const startPct = content.timeToViewPct(event.windowStart);
    const endPct = content.timeToViewPct(event.windowEnd);
    if (startPct === undefined || endPct === undefined) return null;

    const leftPct = Math.max(startPct, 0);
    const widthPct = Math.min(endPct, 100) - leftPct;

    return { leftPct, widthPct };
  }
```

**Step 2: Add pointer-events to SCSS**

In `event-overlay.scss`, add one line to the `.event-overlay` rule (after `height: 100%;`, keeping alphabetical-ish order used in the file):

```scss
.event-overlay {
  border: 1px solid;
  height: 100%;
  pointer-events: none;
  position: absolute;
  top: 0;
  ...
```

**Step 3: Run the timeline test suites (regression check)**

Run: `npm test -- --no-watchman src/plugins/timeline`
Expected: PASS (this is a pure refactor plus CSS; no behavior change yet).

**Step 4: Commit**

```bash
git add src/plugins/timeline/components/event-overlay.tsx src/plugins/timeline/components/event-overlay.scss
git commit -m "Refactor event overlay positioning to use timeToViewPct; make event rectangles click-through."
```

---

### Task 4: WaveformPanel mouse handler pass-through props

**Files:**
- Modify: `src/plugins/shared-seismogram/components/waveform-panel.tsx`

`WaveformPanel` is shared with the seismogram tile ("waveform" mode), so the props are optional pass-throughs — callers that don't use them see no change.

**Step 1: Add the props**

In `waveform-panel.tsx`, extend the props interface:

```ts
interface WaveformPanelProps {
  mode?: "waveform" | "timeline";
  sharedSeismogram: SharedSeismogramType;
  startTime: DateTime;
  endTime: DateTime;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
  onMouseMove?: React.MouseEventHandler<HTMLDivElement>;
}
```

Destructure the new props in the component signature:

```ts
export const WaveformPanel: React.FC<WaveformPanelProps> = observer(function WaveformPanel({
  mode = "waveform", sharedSeismogram, startTime, endTime, onClick, onMouseLeave, onMouseMove,
}) {
```

Attach them to the root div:

```tsx
  return (
    <div className="waveform-panel" onClick={onClick} onMouseLeave={onMouseLeave} onMouseMove={onMouseMove}>
      <div ref={containerRef} className="waveform-panel-display" style={style} />
    </div>
  );
```

**Step 2: Verify types and existing tests**

Run: `npm run check:types`
Expected: no errors.

Run: `npm test -- --no-watchman src/plugins/shared-seismogram src/plugins/timeline`
Expected: PASS.

**Step 3: Commit**

```bash
git add src/plugins/shared-seismogram/components/waveform-panel.tsx
git commit -m "Add optional mouse handler props to WaveformPanel."
```

---

### Task 5: TimeMarkerOverlay component (TDD)

**Files:**
- Create: `src/plugins/timeline/components/time-marker-overlay.tsx`
- Create: `src/plugins/timeline/components/time-marker-overlay.scss`
- Create: `src/plugins/timeline/components/time-marker-overlay.test.tsx`

**Step 1: Write the failing tests**

Create `time-marker-overlay.test.tsx`. The component only needs `TileModelContext` (no stores). The model's `timeToViewPct` only depends on the view range props, so no shared-model mocking is needed:

```tsx
import { fireEvent, render } from "@testing-library/react";
import { DateTime } from "luxon";
import React from "react";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { TileModel } from "../../../models/tiles/tile-model";
import { TimelineContentModel, TimelineContentModelType } from "../models/timeline-content";
import { TimeMarkerOverlay } from "./time-marker-overlay";

// The timeline tile needs to be registered so TileModel.create
// knows it is a supported tile type
import "../timeline-registration";

describe("TimeMarkerOverlay", () => {
  const viewStart = DateTime.fromISO("2026-02-01T00:00:00.000Z");
  const viewEnd = DateTime.fromISO("2026-02-02T00:00:00.000Z");

  function createContent() {
    return TimelineContentModel.create({
      viewStartTimeISO: viewStart.toISO()!,
      viewEndTimeISO: viewEnd.toISO()!,
    });
  }

  function renderOverlay(content: TimelineContentModelType) {
    const model = TileModel.create({ content });
    return render(
      <TileModelContext.Provider value={model}>
        <TimeMarkerOverlay />
      </TileModelContext.Provider>
    );
  }

  it("renders no markers by default", () => {
    const { container } = renderOverlay(createContent());
    expect(container.querySelector(".time-marker-line")).toBeNull();
    expect(container.querySelector(".time-marker-label")).toBeNull();
  });

  it("renders a hover marker with a two-line UTC label", () => {
    const content = createContent();
    const hoverTime = viewStart.plus({ hours: 6 });
    content.setHoverTime(hoverTime);
    const { container } = renderOverlay(content);

    const line = container.querySelector<HTMLElement>(".time-marker-line.hover");
    const label = container.querySelector<HTMLElement>(".time-marker-label.hover");
    expect(line).toBeInTheDocument();
    expect(label).toBeInTheDocument();
    expect(line!.style.left).toBe("25%");
    expect(label!.textContent).toContain(hoverTime.toUTC().toLocaleString());
    expect(label!.textContent).toContain(hoverTime.toUTC().toLocaleString(DateTime.TIME_WITH_SECONDS));
  });

  it("renders a pinned marker and clears it when its label is clicked", () => {
    const content = createContent();
    content.setPinnedTime(viewStart.plus({ hours: 12 }));
    const { container } = renderOverlay(content);

    const label = container.querySelector<HTMLElement>("button.time-marker-label.pinned");
    expect(container.querySelector(".time-marker-line.pinned")).toBeInTheDocument();
    expect(label).toBeInTheDocument();

    fireEvent.click(label!);
    expect(content.pinnedTime).toBeUndefined();
    expect(container.querySelector(".time-marker-line.pinned")).toBeNull();
  });

  it("hides the pinned marker when its time is outside the view range", () => {
    const content = createContent();
    content.setPinnedTime(viewEnd.plus({ hours: 1 }));
    const { container } = renderOverlay(content);
    expect(container.querySelector(".time-marker-line.pinned")).toBeNull();
    // Still pinned — it reappears if the view pans back
    expect(content.pinnedTime).toBeDefined();
  });

  it("renders hover and pinned markers simultaneously", () => {
    const content = createContent();
    content.setHoverTime(viewStart.plus({ hours: 6 }));
    content.setPinnedTime(viewStart.plus({ hours: 12 }));
    const { container } = renderOverlay(content);
    expect(container.querySelectorAll(".time-marker-line")).toHaveLength(2);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- --no-watchman src/plugins/timeline/components/time-marker-overlay.test.tsx`
Expected: FAIL — cannot find module `./time-marker-overlay`.

**Step 3: Implement the component**

Create `time-marker-overlay.tsx`:

```tsx
import { DateTime } from "luxon";
import { observer } from "mobx-react-lite";
import React from "react";
import { useTimelineContent } from "../hooks/use-timeline-content";

import "./time-marker-overlay.scss";

function isPctInView(pct?: number): pct is number {
  return pct !== undefined && pct >= 0 && pct <= 100;
}

function TimeMarkerLabelText({ time }: { time: DateTime }) {
  return (
    <>
      <div>{time.toUTC().toLocaleString()}</div>
      <div>{time.toUTC().toLocaleString(DateTime.TIME_WITH_SECONDS)}</div>
    </>
  );
}

export const TimeMarkerOverlay = observer(function TimeMarkerOverlay() {
  const content = useTimelineContent();
  const { hoverTime, pinnedTime } = content;
  const hoverPct = hoverTime && content.timeToViewPct(hoverTime);
  const pinnedPct = pinnedTime && content.timeToViewPct(pinnedTime);

  const handlePinnedLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    content.clearPinnedTime();
  };

  return (
    <>
      {pinnedTime && isPctInView(pinnedPct) && (
        <>
          <div className="time-marker-line pinned" style={{ left: `${pinnedPct}%` }} />
          <button className="time-marker-label pinned" style={{ left: `${pinnedPct}%` }}
              onClick={handlePinnedLabelClick}>
            <TimeMarkerLabelText time={pinnedTime} />
          </button>
        </>
      )}
      {hoverTime && isPctInView(hoverPct) && (
        <>
          <div className="time-marker-line hover" style={{ left: `${hoverPct}%` }} />
          <div className="time-marker-label hover" style={{ left: `${hoverPct}%` }}>
            <TimeMarkerLabelText time={hoverTime} />
          </div>
        </>
      )}
    </>
  );
});
```

Create `time-marker-overlay.scss`. The waveform background is black with a white trace, so the line is white; hover is semi-transparent to distinguish it from the pinned marker. Labels sit at `top: 100%`, in line with the `timeline-range-row` below the waveform, with a solid background so they read over the range text:

```scss
.time-marker-line {
  background-color: white;
  height: 100%;
  pointer-events: none;
  position: absolute;
  top: 0;
  width: 1px;

  &.hover {
    opacity: 0.7;
  }
}

.time-marker-label {
  align-items: center;
  background-color: white;
  border: 1px solid #949494;
  border-radius: 3px;
  color: #121212;
  display: flex;
  flex-direction: column;
  font-size: 11px;
  padding: 1px 4px;
  position: absolute;
  top: 100%;
  transform: translateX(-50%);
  white-space: nowrap;
  z-index: 1;

  &.hover {
    pointer-events: none;
  }

  &.pinned {
    cursor: pointer;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- --no-watchman src/plugins/timeline/components/time-marker-overlay.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/plugins/timeline/components/time-marker-overlay.tsx \
        src/plugins/timeline/components/time-marker-overlay.scss \
        src/plugins/timeline/components/time-marker-overlay.test.tsx
git commit -m "Add TimeMarkerOverlay component for timeline time markers."
```

---

### Task 6: Wire mouse handlers in Timeline

**Files:**
- Modify: `src/plugins/timeline/components/timeline.tsx`

**Step 1: Add handlers and render the overlay**

In `timeline.tsx`, inside the `Timeline` component add (after the effects, before `return`):

```tsx
  const timeFromMouseEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!viewStartTime || !viewEndTime) return undefined;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return undefined;
    const fraction = (e.clientX - rect.left) / rect.width;
    const rangeMs = viewEndTime.toMillis() - viewStartTime.toMillis();
    return viewStartTime.plus({ milliseconds: fraction * rangeMs });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const time = timeFromMouseEvent(e);
    if (time) content.setHoverTime(time);
  };

  const handleMouseLeave = () => content.clearHoverTime();

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const time = timeFromMouseEvent(e);
    if (time) content.setPinnedTime(time);
  };
```

Pass them to `WaveformPanel` and render the overlay after `EventOverlay`:

```tsx
            <WaveformPanel
              mode="timeline"
              sharedSeismogram={sharedSeismogram}
              startTime={viewStartTime}
              endTime={viewEndTime}
              onClick={handleClick}
              onMouseLeave={handleMouseLeave}
              onMouseMove={handleMouseMove}
            />
            <EventOverlay />
            <TimeMarkerOverlay />
```

Add the import alongside the `EventOverlay` import:

```tsx
import { TimeMarkerOverlay } from "./time-marker-overlay";
```

**Step 2: Verify types, lint, and full timeline tests**

Run: `npm run check:types`
Expected: no errors.

Run: `npm test -- --no-watchman src/plugins/timeline src/plugins/shared-seismogram`
Expected: PASS.

**Step 3: Commit**

```bash
git add src/plugins/timeline/components/timeline.tsx
git commit -m "Wire timeline time marker mouse handlers."
```

---

### Task 7: Manual verification and final checks

**Step 1: Manual verification in the browser**

Start the dev server (`npm start`) and open a unit/problem with a timeline tile that has seismogram data loaded. Verify with the user:

1. Hovering over the waveform shows a vertical line under the cursor with a date/time label below the waveform, in line with the range row.
2. Moving the mouse moves the line/label; leaving the waveform hides them.
3. Clicking pins a marker; clicking elsewhere moves it (only one pinned marker).
4. Clicking the pinned marker's label clears it.
5. Pan/zoom: the pinned marker tracks its timestamp and disappears/reappears as it leaves/enters the view.
6. Clicking a numbered event label button still selects the event and does NOT pin a marker.
7. Hovering/clicking over an event rectangle behaves the same as over bare waveform.

**Step 2: Run lint and full checks**

Run: `npm run lint:build`
Expected: no errors on changed files.

Run: `npm run check:types`
Expected: no errors.

Run: `npm test -- --no-watchman src/plugins/timeline src/plugins/shared-seismogram`
Expected: PASS.

**Step 3: Fix anything found, commit any fixes**

```bash
git add -A src/plugins/timeline src/plugins/shared-seismogram
git commit -m "Address lint/type issues in timeline time markers."
```

(Skip the commit if there is nothing to fix.)
