# CLUE-709 Timeline Marker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A student turns on a marker tool from the toolbar, places one marker on the timeline graph, drags it to move it, and deletes it from its own label. The marker is saved with the document.

**Architecture:** The marker already exists in the model and the overlay; CLUE-673 removed the only things that set it. This plan gives it a deliberate way in — a toolbar mode that `TimelinePlot` checks before its click zooms — moves it from volatile state into the document, and adds dragging and deletion to the overlay that already draws it.

**Tech Stack:** TypeScript 5.8, React 18.3, MobX State Tree, Luxon `DateTime`, SCSS with `src/components/vars.scss` tokens, Jest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-09-clue-709-timeline-marker-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `src/plugins/timeline/models/timeline-content.ts` | MODIFY. `markerTimeISO` prop, `isPlacingMarker` volatile, the rename, a `viewPctToTime` view, clamping. |
| `src/plugins/timeline/models/timeline-content.test.ts` | MODIFY. Persistence, the mode flag, and the inverted export assertion. |
| `src/plugins/timeline/timeline-toolbar.tsx` | MODIFY. The Add Marker button. |
| `src/clue/app-config.json` | MODIFY. Put the button in the timeline toolbar. |
| `src/plugins/timeline/components/timeline-plot.tsx` | MODIFY. Crosshair cursor; a click places instead of zooming while in the mode. |
| `src/plugins/timeline/components/time-marker-overlay.tsx` | MODIFY. Dashed while placing, the delete control, drag handling. |
| `src/plugins/timeline/components/time-marker-overlay.scss` | MODIFY. Dashed treatment and the delete control's styling. |
| `src/plugins/timeline/components/time-marker-overlay.test.tsx` | MODIFY. Delete and drag. |
| `src/plugins/timeline/components/timeline-plot.test.tsx` | MODIFY. Place-not-zoom, Escape. |
| `src/plugins/timeline/components/full-timeline.tsx` | MODIFY. Dashed while-placing look. |

### Two things to know before starting

**The rename is mechanical but wide.** `pinnedTime` → `markerTime`, `setPinnedTime` → `setMarkerTime`, `clearPinnedTime` → `clearMarkerTime`. Task 1 does the whole rename in one commit so later tasks read cleanly. Run `grep -rn "pinnedTime\|PinnedTime" src/` first and change every hit, including tests and SCSS class names.

**One existing assertion is now wrong by design.** `timeline-content.test.ts:~407` asserts the marker is absent from `exportJson`. It was right for a transient pin. The marker is now content, so that assertion must be INVERTED, not deleted. Task 2 covers it.

---

## Task 1: Rename pinnedTime to markerTime

Pure rename, no behaviour change, so later tasks are not reading two names for one thing.

**Files:**
- Modify: `src/plugins/timeline/models/timeline-content.ts`
- Modify: `src/plugins/timeline/components/time-marker-overlay.tsx`
- Modify: `src/plugins/timeline/components/time-marker-overlay.scss`
- Modify: `src/plugins/timeline/models/timeline-content.test.ts`
- Modify: `src/plugins/timeline/components/time-marker-overlay.test.tsx`

- [ ] **Step 1: Find every occurrence**

Run: `grep -rn "pinnedTime\|PinnedTime\|\.pinned" src/ --include="*.ts" --include="*.tsx" --include="*.scss"`

Expected: hits in the five files above. Note the SCSS class `.pinned` and the `className="time-marker-line pinned"` / `"time-marker-label pinned"` strings — rename those to `placed`, which describes the state rather than the old gesture.

- [ ] **Step 2: Rename**

`pinnedTime` → `markerTime`, `setPinnedTime` → `setMarkerTime`, `clearPinnedTime` → `clearMarkerTime`, the CSS class `pinned` → `placed`, and `handlePinnedLabelClick` → `handleMarkerLabelClick`.

- [ ] **Step 3: Confirm nothing was missed**

Run: `grep -rn "pinnedTime\|PinnedTime" src/`
Expected: no output.

- [ ] **Step 4: Verify**

```bash
npx jest src/plugins/timeline --silent
npx tsc --noEmit -p .
npx sass --no-source-map --load-path=src --load-path=. src/plugins/timeline/components/time-marker-overlay.scss > /dev/null
```
Expected: tests pass, no type errors, the stylesheet compiles. **Jest does not compile SCSS, so the sass step is the only thing that catches a broken stylesheet.**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "CLUE-709: rename pinnedTime to markerTime

The old name described a transient pin. It is about to become a placed object the student owns and
the document stores, so the name moves with it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Persist the marker

**Files:**
- Modify: `src/plugins/timeline/models/timeline-content.ts`
- Test: `src/plugins/timeline/models/timeline-content.test.ts`

- [ ] **Step 1: Write the failing tests**

Add at the TOP LEVEL of `timeline-content.test.ts` (a sibling of the existing describes, not nested — verify brace depth; misplaced describe blocks have been a recurring mistake in this repo):

```ts
describe("marker persistence", () => {
  const markerISO = "2026-02-01T12:00:00.000Z";

  it("round-trips the marker through a snapshot", () => {
    const content = TimelineContentModel.create({});
    content.setMarkerTime(DateTime.fromISO(markerISO, { zone: "utc" }));

    const reloaded = TimelineContentModel.create(getSnapshot(content));
    expect(reloaded.markerTime?.toISO()).toBe(content.markerTime?.toISO());
  });

  // This assertion is the inverse of the one it replaces. The marker used to be a transient pin
  // and was deliberately excluded from the exported document; it is now the student's own work.
  it("includes the marker in the exported document", () => {
    const content = TimelineContentModel.create({});
    content.setMarkerTime(DateTime.fromISO(markerISO, { zone: "utc" }));

    expect(JSON.parse(content.exportJson())).toHaveProperty("markerTimeISO", markerISO);
  });

  it("clears the marker out of the exported document", () => {
    const content = TimelineContentModel.create({});
    content.setMarkerTime(DateTime.fromISO(markerISO, { zone: "utc" }));
    content.clearMarkerTime();

    expect(JSON.parse(content.exportJson())).not.toHaveProperty("markerTimeISO");
  });
});
```

Add `import { getSnapshot } from "mobx-state-tree";` if it is not already imported.

**DELETE the old assertion** that asserts the marker is absent from `exportJson` — it is superseded by the second test above. Do not leave both; they contradict each other.

- [ ] **Step 2: Run and watch it fail**

Run: `npx jest src/plugins/timeline/models/timeline-content --silent`
Expected: FAIL — the snapshot does not carry the marker.

- [ ] **Step 3: Move the marker into props**

In `src/plugins/timeline/models/timeline-content.ts`, add to `.props()` beside the view bounds:

```ts
    markerTimeISO: types.maybe(types.string),
```

Remove `markerTime` from `.volatile()`, leaving `hoverTime` there.

Add a view that reads it back as a `DateTime`:

```ts
    get markerTime(): DateTime | undefined {
      return self.markerTimeISO ? DateTime.fromISO(self.markerTimeISO, { zone: "utc" }) : undefined;
    },
```

Change the actions to write the string:

```ts
    setMarkerTime(time: DateTime) {
      self.markerTimeISO = time.toUTC().toISO() ?? undefined;
    },
    clearMarkerTime() {
      self.markerTimeISO = undefined;
    },
```

Check `exportJson` includes `markerTimeISO`. If it builds its output from an explicit list of fields rather than the snapshot, add it there.

- [ ] **Step 4: Run and watch it pass**

Run: `npx jest src/plugins/timeline --silent`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "CLUE-709: save the timeline marker in the document

A marker the student deliberately places is their work: it should survive a reload, travel with a
copied document, and be visible to a teacher reviewing it. The export assertion that excluded it is
inverted rather than removed.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Placement mode in the model

**Files:**
- Modify: `src/plugins/timeline/models/timeline-content.ts`
- Test: `src/plugins/timeline/models/timeline-content.test.ts`

- [ ] **Step 1: Write the failing tests**

Add at the top level of `timeline-content.test.ts`:

```ts
describe("marker placement mode", () => {
  it("starts off and toggles on", () => {
    const content = TimelineContentModel.create({});
    expect(content.isPlacingMarker).toBe(false);

    content.startPlacingMarker();
    expect(content.isPlacingMarker).toBe(true);

    content.stopPlacingMarker();
    expect(content.isPlacingMarker).toBe(false);
  });

  // Half-finished placement is not something to reload into.
  it("is not saved in the document", () => {
    const content = TimelineContentModel.create({});
    content.startPlacingMarker();

    expect(JSON.parse(content.exportJson())).not.toHaveProperty("isPlacingMarker");
  });

  it("stops placing once a marker is set", () => {
    const content = TimelineContentModel.create({});
    content.startPlacingMarker();
    content.setMarkerTime(DateTime.fromISO("2026-02-01T12:00:00.000Z", { zone: "utc" }));

    expect(content.isPlacingMarker).toBe(false);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx jest src/plugins/timeline/models/timeline-content --silent -t "placement mode"`
Expected: FAIL — `isPlacingMarker` is not a property.

- [ ] **Step 3: Implement**

Add to `.volatile()` beside `hoverTime`:

```ts
    isPlacingMarker: false,
```

Add the actions:

```ts
    startPlacingMarker() {
      self.isPlacingMarker = true;
    },
    stopPlacingMarker() {
      self.isPlacingMarker = false;
      self.hoverTime = undefined;
    },
```

In `setMarkerTime`, end the mode as part of placing:

```ts
    setMarkerTime(time: DateTime) {
      self.markerTimeISO = time.toUTC().toISO() ?? undefined;
      self.isPlacingMarker = false;
      self.hoverTime = undefined;
    },
```

- [ ] **Step 4: Run and watch it pass**

Run: `npx jest src/plugins/timeline --silent`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "CLUE-709: add marker placement mode

Volatile: a half-finished placement is not something to reload into. Setting the marker ends the
mode, so placement is one gesture rather than a mode the student has to turn off.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Convert a view position back to a time

The overlay's drag needs x → time. `TimelinePlot` has a local `timeAtClientX`, but that is tied to its own element. A model view is testable without a DOM and usable from both.

**Files:**
- Modify: `src/plugins/timeline/models/timeline-content.ts`
- Test: `src/plugins/timeline/models/timeline-content.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
describe("viewPctToTime", () => {
  function contentWithView() {
    const content = TimelineContentModel.create({
      viewStartTimeISO: "2026-02-01T00:00:00.000Z",
      viewEndTimeISO: "2026-02-02T00:00:00.000Z"
    });
    return content;
  }

  it("is the inverse of timeToViewPct", () => {
    const content = contentWithView();
    const time = DateTime.fromISO("2026-02-01T06:00:00.000Z", { zone: "utc" });
    const pct = content.timeToViewPct(time);

    expect(pct).toBeDefined();
    expect(content.viewPctToTime(pct!)?.toMillis()).toBe(time.toMillis());
  });

  // A drag can run past the edge of the plot; the marker must not land where there is no data.
  it("clamps to the loaded data range", () => {
    const content = contentWithView();
    const early = content.viewPctToTime(-500);
    const late = content.viewPctToTime(500);

    expect(early?.toMillis()).toBe(content.dataStartTime?.toMillis());
    expect(late?.toMillis()).toBe(content.dataEndTime?.toMillis());
  });

  it("returns undefined with no view set", () => {
    expect(TimelineContentModel.create({}).viewPctToTime(50)).toBeUndefined();
  });
});
```

If `dataStartTime`/`dataEndTime` come from a shared data set rather than the content's own props, build the fixture the way the existing tests in this file do — read them first and follow that pattern rather than inventing one.

- [ ] **Step 2: Run and watch it fail**

Run: `npx jest src/plugins/timeline/models/timeline-content --silent -t "viewPctToTime"`
Expected: FAIL — not a function.

- [ ] **Step 3: Implement**

Add beside `timeToViewPct`:

```ts
    // The inverse of timeToViewPct, clamped to the loaded data rather than to the visible view: a
    // drag can run past the edge of the plot, and the marker must not land where there is no data.
    viewPctToTime(pct: number): DateTime | undefined {
      const { viewStartMs, viewRangeMs } = self;
      if (viewStartMs === undefined || viewRangeMs === undefined || viewRangeMs <= 0) return undefined;
      const ms = viewStartMs + pct / 100 * viewRangeMs;
      const min = self.dataStartTime?.toMillis() ?? ms;
      const max = self.dataEndTime?.toMillis() ?? ms;
      return DateTime.fromMillis(Math.min(Math.max(ms, min), max), { zone: "utc" });
    },
```

- [ ] **Step 4: Run and watch it pass**

Run: `npx jest src/plugins/timeline --silent`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "CLUE-709: convert a view position back to a time

The marker drag needs the inverse of timeToViewPct. On the model rather than in the plot component
so it is testable without a DOM and usable from the overlay too.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: The Add Marker toolbar button

**Files:**
- Modify: `src/plugins/timeline/timeline-toolbar.tsx`
- Modify: `src/clue/app-config.json`
- Create: `src/plugins/timeline/assets/toolbar/add-marker-icon.svg`
- Test: `src/plugins/timeline/timeline-toolbar.test.tsx` (create if absent)

- [ ] **Step 1: Add the icon asset**

No marker glyph exists in the timeline assets. Copy a placeholder so the work is not blocked on a design export, and flag it in the commit:

```bash
cp src/plugins/timeline/assets/toolbar/zoom-to-fit-icon.svg src/plugins/timeline/assets/toolbar/add-marker-icon.svg
```

Report this in your hand-back so the real glyph can replace this one file.

- [ ] **Step 2: Write the failing test**

Create `src/plugins/timeline/timeline-toolbar.test.tsx` modelled on an existing toolbar test. Find one first:

Run: `ls src/plugins/*/*toolbar*.test.tsx src/plugins/*/components/toolbar/*.test.tsx 2>/dev/null`

Follow its setup. The test must cover:

```tsx
  it("turns on placement mode when clicked", () => {
    const content = renderToolbarWithContent();
    fireEvent.click(screen.getByRole("button", { name: "Add Marker" }));
    expect(content.isPlacingMarker).toBe(true);
  });

  // Only one marker at a time: the way to get a second is to delete the first.
  it("is disabled once a marker exists", () => {
    const content = renderToolbarWithContent();
    content.setMarkerTime(DateTime.fromISO("2026-02-01T12:00:00.000Z", { zone: "utc" }));
    expect(screen.getByRole("button", { name: "Add Marker" })).toBeDisabled();
  });
```

- [ ] **Step 3: Run and watch it fail**

Run: `npx jest src/plugins/timeline/timeline-toolbar --silent`
Expected: FAIL — no such button.

- [ ] **Step 4: Implement the button**

In `timeline-toolbar.tsx`, add the import:

```tsx
import AddMarkerIcon from "./assets/toolbar/add-marker-icon.svg";
```

Add the component alongside the others:

```tsx
const AddMarkerButton = observer(function AddMarkerButton({ name }: IToolbarButtonComponentProps) {
  const content = useTimelineContent();

  return (
    <TileToolbarButton
      name={name}
      title="Add Marker"
      onClick={() => content?.startPlacingMarker()}
      selected={!!content?.isPlacingMarker}
      disabled={!!content?.markerTime || !content?.dataStartTime}
    >
      <AddMarkerIcon/>
    </TileToolbarButton>
  );
});
```

Check `TileToolbarButton`'s props before using `selected` — read `src/components/toolbar/tile-toolbar-button.tsx` and use whatever it actually calls its active state. If it has none, leave it out and report that.

Register it:

```tsx
  { name: "add-marker", component: AddMarkerButton },
```

- [ ] **Step 5: Put it in the toolbar**

In `src/clue/app-config.json`, in the `timeline` tools array, after `"view-all"`:

```json
          "|",
          "add-marker",
```

- [ ] **Step 6: Run and watch it pass**

Run: `npx jest src/plugins/timeline --silent`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "CLUE-709: add the Add Marker toolbar button

Disabled while a marker exists, since only one is allowed, and while there is no data to place it
against. The icon is a placeholder copied from zoom-to-fit pending a real glyph.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Placing a marker instead of zooming

**Files:**
- Modify: `src/plugins/timeline/components/timeline-plot.tsx`
- Modify: `src/plugins/timeline/components/timeline-plot.scss`
- Test: `src/plugins/timeline/components/timeline-plot.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `timeline-plot.test.tsx`, following the file's existing render helper:

```tsx
describe("placing a marker", () => {
  // While placing, the click belongs to the marker. Zooming would move the ground under it.
  it("places the marker instead of zooming", () => {
    const content = renderPlot();
    const viewStartMs = content.viewStartMs;
    content.startPlacingMarker();

    clickPlotAt(0.5);

    expect(content.markerTime).toBeDefined();
    expect(content.isPlacingMarker).toBe(false);
    expect(content.viewStartMs).toBe(viewStartMs);
  });

  it("zooms as usual when not placing", () => {
    const content = renderPlot();
    clickPlotAt(0.5);

    expect(content.markerTime).toBeUndefined();
  });

  it("leaves the mode on Escape without placing", () => {
    const content = renderPlot();
    content.startPlacingMarker();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(content.isPlacingMarker).toBe(false);
    expect(content.markerTime).toBeUndefined();
  });
});
```

Write `clickPlotAt(fraction)` as a helper that fires pointerdown then pointerup at that fraction across the plot's width. jsdom gives every element a zero-size rect, so stub `getBoundingClientRect` on the plot element — read the existing tests in this file first; if they already solve this, reuse their approach rather than inventing a second one.

- [ ] **Step 2: Run and watch it fail**

Run: `npx jest src/plugins/timeline/components/timeline-plot --silent -t "placing"`
Expected: FAIL — the click zooms.

- [ ] **Step 3: Intercept the click**

In `timeline-plot.tsx`, in the pointer-up handler, immediately after `const time = timeAtClientX(e); if (!time) return;`:

```tsx
    // While placing, the click belongs to the marker: zooming would move the ground under it.
    if (content.isPlacingMarker) {
      content.setMarkerTime(time);
      announce(`Marker placed at ${formatTime(time)}.`);
      return;
    }
```

Give the mode its own cursor:

```tsx
  const cursorClass = content.isPlacingMarker
    ? "placing"
    : isDragging ? "grabbing" : isShiftDown ? "zoom-out" : "zoom-in";
```

Add an Escape handler:

```tsx
  useEffect(() => {
    if (!content.isPlacingMarker) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") content.stopPlacingMarker();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [content, content.isPlacingMarker]);
```

Add `useEffect` to the React import if it is not already there.

In `timeline-plot.scss`, beside the other cursor classes:

```scss
  &.placing {
    cursor: crosshair;
  }
```

- [ ] **Step 4: Run and watch it pass**

Run: `npx jest src/plugins/timeline --silent`
Expected: PASS.

- [ ] **Step 5: Mutation-check**

Temporarily delete the `if (content.isPlacingMarker)` block. Run `npx jest src/plugins/timeline/components/timeline-plot --silent -t "placing"`. Expected: FAIL on "places the marker instead of zooming". Restore and confirm green. Report both results.

- [ ] **Step 6: Verify and commit**

```bash
npx sass --no-source-map --load-path=src --load-path=. src/plugins/timeline/components/timeline-plot.scss > /dev/null
git add -A
git commit -m "CLUE-709: a click places the marker while in placement mode

Previously every click zoomed. While placing, the click belongs to the marker - zooming would move
the ground out from under it. Escape leaves the mode without placing.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: The preview while placing

**Files:**
- Modify: `src/plugins/timeline/components/timeline-plot.tsx`
- Modify: `src/plugins/timeline/components/time-marker-overlay.tsx`
- Modify: `src/plugins/timeline/components/time-marker-overlay.scss`
- Test: `src/plugins/timeline/components/time-marker-overlay.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
  // The preview is what tells the student where the marker will land, and dashed is what
  // distinguishes it from one already placed.
  it("draws a dashed preview at the hovered time while placing", () => {
    const { content, container } = renderOverlay();
    content.startPlacingMarker();
    content.setHoverTime(viewStart.plus({ hours: 12 }));

    expect(container.querySelector(".time-marker-line.placing")).toBeInTheDocument();
  });

  it("draws no preview when not placing", () => {
    const { content, container } = renderOverlay();
    content.setHoverTime(viewStart.plus({ hours: 12 }));

    expect(container.querySelector(".time-marker-line.placing")).not.toBeInTheDocument();
  });
```

Follow the existing render helper in this file rather than writing a new one. If it does not already return both the content and the container, widen it to do so — the overlay tests all need both.

- [ ] **Step 2: Run and watch it fail**

Run: `npx jest src/plugins/timeline/components/time-marker-overlay --silent`
Expected: FAIL — no `.placing` element.

- [ ] **Step 3: Feed the preview from the plot**

In `timeline-plot.tsx`'s pointer-move handler, while placing, track the pointer:

```tsx
    if (content.isPlacingMarker) {
      const time = timeAtClientX(e);
      if (time) content.setHoverTime(time);
    }
```

- [ ] **Step 4: Draw it dashed**

In `time-marker-overlay.tsx`, give the hover line the placing class:

```tsx
      {hoverTime && isPctInView(hoverPct) && (
        <>
          <div
            className={classNames("time-marker-line", content.isPlacingMarker ? "placing" : "hover")}
            style={{ left: `${hoverPct}%` }}
          />
          <div
            className={classNames("time-marker-label", content.isPlacingMarker ? "placing" : "hover")}
            style={{ left: `${hoverPct}%` }}
          >
            <TimeLabel time={hoverTime} />
          </div>
        </>
      )}
```

Add `import classNames from "classnames";` — this repo REQUIRES the `classnames` package for conditional classes; do not build the string by hand.

In `time-marker-overlay.scss`:

```scss
.time-marker-line.placing {
  border-left-style: dashed;
}
```

Read the existing `.time-marker-line` rule first and match how it draws its line — if it uses `border-left`, the above fits; if it uses a background, dash it the way that rule is built.

- [ ] **Step 5: Run and watch it pass**

Run: `npx jest src/plugins/timeline --silent`
Expected: PASS.

- [ ] **Step 6: Verify and commit**

```bash
npx sass --no-source-map --load-path=src --load-path=. src/plugins/timeline/components/time-marker-overlay.scss > /dev/null
git add -A
git commit -m "CLUE-709: show a dashed preview while placing the marker

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Deleting a placed marker

The label currently deletes the marker when clicked anywhere on it. The design puts that on an explicit "x" instead, so the label itself can be a drag handle in Task 9.

**Files:**
- Modify: `src/plugins/timeline/components/time-marker-overlay.tsx`
- Modify: `src/plugins/timeline/components/time-marker-overlay.scss`
- Test: `src/plugins/timeline/components/time-marker-overlay.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
describe("deleting the marker", () => {
  it("deletes from the x in the label", () => {
    const content = renderOverlayWithMarker();
    fireEvent.click(screen.getByRole("button", { name: "Delete marker" }));
    expect(content.markerTime).toBeUndefined();
  });

  // The label becomes a drag handle in its own right, so clicking it must no longer delete.
  it("does not delete when the label itself is clicked", () => {
    const content = renderOverlayWithMarker();
    fireEvent.click(screen.getByTestId("marker-label"));
    expect(content.markerTime).toBeDefined();
  });
});
```

**The second test replaces an existing one** that asserts clicking the label clears the marker. Find it (`grep -n "clearMarkerTime\|toBeUndefined" src/plugins/timeline/components/time-marker-overlay.test.tsx`) and remove it — leaving both would assert opposite things.

- [ ] **Step 2: Run and watch it fail**

Run: `npx jest src/plugins/timeline/components/time-marker-overlay --silent -t "deleting"`
Expected: FAIL — no Delete marker button.

- [ ] **Step 3: Implement**

Replace the placed label's `<button>` with a non-button element carrying the time, plus a delete control:

```tsx
          <div
            className="time-marker-label placed"
            data-testid="marker-label"
            style={{ left: `${markerPct}%` }}
          >
            <TimeLabel time={markerTime} />
            <button
              className="marker-delete"
              aria-label="Delete marker"
              onClick={e => { e.stopPropagation(); content.clearMarkerTime(); }}
              type="button"
            >
              ×
            </button>
          </div>
```

In `time-marker-overlay.scss`, style `.marker-delete` from `src/components/vars.scss` tokens. No raw hex.

- [ ] **Step 4: Run and watch it pass**

Run: `npx jest src/plugins/timeline --silent`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

```bash
npx sass --no-source-map --load-path=src --load-path=. src/plugins/timeline/components/time-marker-overlay.scss > /dev/null
grep -nE "#[0-9a-fA-F]{3,6}" src/plugins/timeline/components/time-marker-overlay.scss
git add -A
git commit -m "CLUE-709: delete the marker from an x in its label

Clicking the label used to delete it. The label is about to become a drag handle, so deletion moves
to an explicit control.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

The grep should print nothing. Any hit is a new hex value and must become a token.

---

## Task 9: Dragging the marker

The only genuinely new mechanism, so it gets the most tests.

**Files:**
- Modify: `src/plugins/timeline/components/time-marker-overlay.tsx`
- Modify: `src/plugins/timeline/components/time-marker-overlay.scss`
- Test: `src/plugins/timeline/components/time-marker-overlay.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
describe("dragging the marker", () => {
  it("moves the marker when the stem is dragged", () => {
    const content = renderOverlayWithMarker();
    const before = content.markerTime;

    dragBy("marker-stem", 0.25);

    expect(content.markerTime?.toMillis()).toBeGreaterThan(before!.toMillis());
  });

  it("moves the marker when the label is dragged", () => {
    const content = renderOverlayWithMarker();
    const before = content.markerTime;

    dragBy("marker-label", 0.25);

    expect(content.markerTime?.toMillis()).toBeGreaterThan(before!.toMillis());
  });

  // A drag is hundreds of pointermoves. Writing each one would bury the document's undo history
  // under a single gesture.
  it("writes the model once, at the end of the drag", () => {
    const content = renderOverlayWithMarker();
    const writes: (string | undefined)[] = [];
    onPatch(content, patch => {
      if (patch.path === "/markerTimeISO") writes.push(patch.value);
    });

    dragBy("marker-stem", 0.25);

    expect(writes).toHaveLength(1);
  });

  // A pointerup that never arrives must not leave a drag running.
  it("ends the drag on pointer cancel", () => {
    const content = renderOverlayWithMarker();
    const before = content.markerTime!;
    const stem = screen.getByTestId("marker-stem");

    fireEvent.pointerDown(stem, { pointerId: 1, clientX: 100 });
    fireEvent.pointerCancel(stem, { pointerId: 1 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 400 });

    expect(content.markerTime?.toMillis()).toBe(before.toMillis());
  });
});
```

Write `dragBy(testId, fraction)` as a helper firing pointerdown, a pointermove at the new x, then pointerup. Stub the overlay element's `getBoundingClientRect` the same way the plot tests do. Import `onPatch` from `mobx-state-tree`.

- [ ] **Step 2: Run and watch it fail**

Run: `npx jest src/plugins/timeline/components/time-marker-overlay --silent -t "dragging"`
Expected: FAIL — no stem test id, no drag.

- [ ] **Step 3: Implement the drag**

In `time-marker-overlay.tsx`:

```tsx
  const overlayRef = useRef<HTMLDivElement>(null);
  // Where the marker sits while it is being dragged. The model is written once, on pointer-up: a
  // drag is hundreds of pointermoves, and writing each one would bury the undo history.
  const [dragTime, setDragTime] = useState<DateTime | undefined>(undefined);
  const dragPointerRef = useRef<number | undefined>(undefined);

  const timeAtClientX = (clientX: number) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return undefined;
    return content.viewPctToTime((clientX - rect.left) / rect.width * 100);
  };

  const handleDragStart = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    dragPointerRef.current = e.pointerId;
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragTime(content.markerTime);
  };

  const handleDragMove = (e: React.PointerEvent) => {
    if (dragPointerRef.current !== e.pointerId) return;
    const time = timeAtClientX(e.clientX);
    if (time) setDragTime(time);
  };

  const endDrag = (e: React.PointerEvent, commit: boolean) => {
    if (dragPointerRef.current !== e.pointerId) return;
    dragPointerRef.current = undefined;
    if (commit && dragTime) content.setMarkerTime(dragTime);
    setDragTime(undefined);
  };
```

Put `ref={overlayRef}` on the overlay's own wrapper element — add one if the component currently returns a fragment. Render the stem and label with the drag handlers and `data-testid="marker-stem"` / `"marker-label"`, and position them from `dragTime ?? markerTime` so they follow the pointer during a drag. Use `onPointerUp={e => endDrag(e, true)}` and `onPointerCancel={e => endDrag(e, false)}`.

Add `useRef` and `useState` to the React import.

In the SCSS, give the stem and label `cursor: grab`, and `cursor: grabbing` while dragging.

- [ ] **Step 4: Run and watch it pass**

Run: `npx jest src/plugins/timeline --silent`
Expected: PASS.

- [ ] **Step 5: Mutation-check twice**

- Change `endDrag`'s commit to write on every move instead. Expected: "writes the model once" FAILS. Restore.
- Remove the `onPointerCancel` handler. Expected: "ends the drag on pointer cancel" FAILS. Restore.

Report both. If either does not fail, the test is not pinning the behaviour — say so.

- [ ] **Step 6: Verify and commit**

```bash
npx sass --no-source-map --load-path=src --load-path=. src/plugins/timeline/components/time-marker-overlay.scss > /dev/null
git add -A
git commit -m "CLUE-709: drag the marker by its stem or its label

The marker follows the pointer from local state and the model is written once, on pointer-up: a
drag is hundreds of pointermoves and writing each would bury the undo history under one gesture.
Position is clamped to the loaded data, so a drag cannot strand the marker where there is no data.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: The marker on the Full Timeline strip

**Files:**
- Modify: `src/plugins/timeline/components/full-timeline.tsx`
- Modify: `src/plugins/timeline/components/full-timeline.scss`
- Test: `src/plugins/timeline/components/full-timeline.test.tsx`

- [ ] **Step 1: Read what the strip already draws**

Run: `grep -n "marker\|hoverTime\|markerTime" src/plugins/timeline/components/full-timeline.tsx`

CLUE-719 was expected to draw a placed marker. If it already does, this task is only the dashed while-placing treatment. If it does not, both are needed. **Report which you found** — the plan cannot know, because that work landed separately.

- [ ] **Step 2: Write the failing test**

```tsx
  it("shows the placed marker", () => {
    const content = renderFullTimelineWithMarker();
    expect(content.container.querySelector(".full-timeline-marker")).toBeInTheDocument();
  });

  // Dashed on the strip too, so the two views agree about what is settled and what is not.
  it("shows the preview dashed while placing", () => {
    const content = renderFullTimeline();
    content.startPlacingMarker();
    content.setHoverTime(someTimeInRange);

    expect(screen.getByTestId("full-timeline").querySelector(".full-timeline-marker.placing"))
      .toBeInTheDocument();
  });
```

Adapt the class names to whatever Step 1 found. Follow the file's existing render helper.

- [ ] **Step 3: Implement what Step 1 showed to be missing**

Position the marker with the strip's own time-to-position helper — it covers the whole data range, not the zoomed view, so do NOT reuse `timeToViewPct` here.

- [ ] **Step 4: Verify and commit**

```bash
npx jest src/plugins/timeline --silent
npx sass --no-source-map --load-path=src --load-path=. src/plugins/timeline/components/full-timeline.scss > /dev/null
git add -A
git commit -m "CLUE-709: show the marker on the full timeline strip

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Final verification

- [ ] **Step 1: Everything**

```bash
npx jest --silent
npx tsc --noEmit -p .
npm run lint:build
```
Expected: no failures, no type errors, zero lint errors.

- [ ] **Step 2: Every stylesheet compiles**

```bash
for f in time-marker-overlay timeline-plot full-timeline; do
  npx sass --no-source-map --load-path=src --load-path=. \
    src/plugins/timeline/components/$f.scss > /dev/null && echo "$f ok" || echo "$f FAILED"
done
```

**Not optional.** Jest does not compile SCSS; a broken stylesheet has shipped past a green suite in this repo before.

- [ ] **Step 3: No raw hex**

```bash
grep -nE "#[0-9a-fA-F]{3,6}" src/plugins/timeline/components/*.scss
```
Expected: no new hits. Colours come from `src/components/vars.scss`.

- [ ] **Step 4: The old name is gone**

```bash
grep -rn "pinnedTime\|PinnedTime" src/
```
Expected: no output.

- [ ] **Step 5: Self-review the branch**

Run the `code-self-review` skill over `git diff origin/master...HEAD` and apply its MUST items.

- [ ] **Step 6: Check it by hand**

```bash
npm start
```

jsdom renders no layout and no colour, so nothing above has verified appearance. On localhost: the crosshair while placing, the dashed preview, the marker surviving a reload, dragging by both the stem and the label, the x deleting it, the button disabling while a marker exists, and the marker on the Full Timeline strip.

- [ ] **Step 7: Report before pushing**

Do not push or open a PR without explicit approval. Report: the placeholder icon still needing a real glyph, anything Step 1 of Task 10 revealed, and the hand-check results.
