# CLUE-671 Timeline Event Icons and Key — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Timeline tile's event marks up to the design — rectangles coloured from their icon, narrow events drawn as a line, an Event Key whose entries switch event types on and off, and a tidied run-info header.

**Architecture:** The event colour words live in one TypeScript array paired with their icons, and one scss map that every `@each` iterates; a test pins the two lists together. Hiding a type is a `hiddenEventTypes` array in the content model's `.props()`, read at two drawing sites and by Prev/Next. The Event Key's control is a native checkbox restyled into a miniature of the event rectangle.

**Tech Stack:** React 18 + TypeScript, MobX State Tree, SCSS, Jest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-12-clue-671-timeline-event-key-design.md`

---

## File Structure

**Create**
- `src/plugins/timeline/timeline-event-styles.tsx` — the one list of event colour words, each with its icon. Drives `kEventColorWords`. `.tsx` because it holds JSX.
- `src/plugins/timeline/components/timeline-key.test.tsx` — tests for the Event Key.
- `src/plugins/timeline/components/event-overlay.styles.test.ts` — reads `event-overlay.scss` for the rules jsdom cannot observe.

**Modify**
- `src/plugins/timeline/timeline-types.ts` — `kEventColorWords` derives from the styles list.
- `src/plugins/timeline/components/timeline-event-colors.scss` — one `$event-colors` map; `transparent` variants re-derived.
- `src/plugins/timeline/components/event-shape.tsx` / `.scss` — `onDark` halo variant; `@each` over the shared map.
- `src/plugins/timeline/components/event-overlay.scss` — `@each`; `select` border; 40% fill; degenerate line; button min-width.
- `src/plugins/timeline/components/timeline-key.tsx` / `.scss` — checkboxes.
- `src/plugins/timeline/models/timeline-content.ts` — `hiddenEventTypes`, `shownEvents`, Prev/Next skipping.
- `src/plugins/timeline/components/full-timeline.tsx` — draw `shownEvents`.
- `src/plugins/timeline/components/timeline-tile.tsx` / `.scss` — header; `kContentControls`.

**Test files touched:** `timeline-content.test.ts`, `event-overlay.test.tsx`, `event-shape.test.tsx`, `timeline-tile.test.tsx`.

---

## Task 1: Model — hidden event types

**Files:**
- Modify: `src/plugins/timeline/models/timeline-content.ts`
- Test: `src/plugins/timeline/models/timeline-content.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `timeline-content.test.ts`, inside the top-level `describe`:

```ts
describe("hiding event types", () => {
  it("hides no types by default", () => {
    const content = TimelineContentModel.create();
    expect(content.isEventTypeHidden("Earthquake")).toBe(false);
  });

  it("toggles a type off and on again", () => {
    const content = TimelineContentModel.create();
    content.toggleEventType("Earthquake");
    expect(content.isEventTypeHidden("Earthquake")).toBe(true);
    content.toggleEventType("Earthquake");
    expect(content.isEventTypeHidden("Earthquake")).toBe(false);
  });

  it("keeps a hidden type through a save and reload", () => {
    const content = TimelineContentModel.create();
    content.toggleEventType("Earthquake");
    const reloaded = TimelineContentModel.create(getSnapshot(content));
    expect(reloaded.isEventTypeHidden("Earthquake")).toBe(true);
  });
});
```

Add `getSnapshot` to the `mobx-state-tree` import at the top of the file if it is not already there.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/plugins/timeline/models/timeline-content.test.ts -t "hiding event types"`
Expected: FAIL — `content.isEventTypeHidden is not a function`

- [ ] **Step 3: Add the prop**

In `timeline-content.ts`, in the `.props({ ... })` block, after `viewEndTimeISO`:

```ts
    hiddenEventTypes: types.array(types.string),
```

- [ ] **Step 4: Add the views**

`events` is defined in the `.views` block that also holds `modelLabel` and `eventTypeColorWords`. A view cannot see others declared in the same block, so add a **new** `.views` block immediately after that one, before the block that begins `get dataRangeSeconds()`:

```ts
  .views(self => ({
    isEventTypeHidden(eventType: string) {
      return self.hiddenEventTypes.includes(eventType);
    },
    // The events whose type is switched on in the Event Key.
    get shownEvents(): TimelineEvent[] {
      return self.events.filter(e => !self.hiddenEventTypes.includes(e.eventType));
    }
  }))
```

- [ ] **Step 5: Add the action**

In the final `.actions` block, beside `selectNextEvent`:

```ts
    toggleEventType(eventType: string) {
      const at = self.hiddenEventTypes.indexOf(eventType);
      if (at >= 0) self.hiddenEventTypes.splice(at, 1);
      else self.hiddenEventTypes.push(eventType);
    },
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest src/plugins/timeline/models/timeline-content.test.ts -t "hiding event types"`
Expected: PASS, 3 tests.

- [ ] **Step 7: Run the whole model suite for regressions**

Run: `npx jest src/plugins/timeline/models/timeline-content.test.ts`
Expected: all PASS. If an `exportJson` assertion now fails because `hiddenEventTypes` appears in the output, update that assertion — the hidden set is saved content, like the view range.

- [ ] **Step 8: Commit**

```bash
git add src/plugins/timeline/models/timeline-content.ts src/plugins/timeline/models/timeline-content.test.ts
git commit -m "Let the model hide event types [CLUE-671]"
```

---

## Task 2: Model — `visibleEvents` and Prev/Next respect hidden types

**Files:**
- Modify: `src/plugins/timeline/models/timeline-content.ts`
- Test: `src/plugins/timeline/models/timeline-content.test.ts`

Numbering stays absolute: `selectedEventIndex` remains an index into the full `events` list. Only the walk changes.

- [ ] **Step 1: Write the failing tests**

Add a new `describe` to `timeline-content.test.ts`, at the end of the file. It reuses the module-scope `createEventsDataSet` helper already in that file (line 17) and mirrors the `beforeEach`/`afterEach` of the existing `describe("event views", ...)` block.

```ts
describe("navigating with types hidden", () => {
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
    // Six events an hour apart, types A B A C A B, so hiding B leaves indices 0, 2, 3, 4.
    mockSharedDataSet = createEventsDataSet(
      ["A", "B", "A", "C", "A", "B"].map((eventType, i) => ({
        windowStart: dataStart.plus({ hours: i + 1 }).toISO()!,
        windowEnd: dataStart.plus({ hours: i + 1, minutes: 30 }).toISO()!,
        eventType
      }))
    );
    mockedGetSharedModelManager.mockReturnValue({
      isReady: true,
      getTileSharedModelsByType: (_self: any, type: any) => {
        if (type === SharedSeismogram) return [mockSharedSeismogram];
        if (type === SharedDataSet) return [mockSharedDataSet];
        return [];
      },
    } as any);
    content = TimelineContentModel.create();
    // Wide enough to hold every event, so visibleEvents is never clipped by the view.
    content.setViewRange(dataStart, dataEnd);
  });

  afterEach(() => {
    mockedGetSharedModelManager.mockReset();
  });

  it("skips hidden events going forward", () => {
    content.toggleEventType("B");
    content.selectEvent(0);
    content.selectNextEvent();
    expect(content.selectedEventIndex).toBe(2);
  });

  it("skips hidden events going back", () => {
    content.toggleEventType("B");
    content.selectEvent(2);
    content.selectPrevEvent();
    expect(content.selectedEventIndex).toBe(0);
  });

  it("does not renumber the events that remain", () => {
    content.toggleEventType("B");
    content.selectEvent(2);
    expect(content.selectedEventLabel).toBe("Event 3");
  });

  it("walks on from a selection whose own type is hidden", () => {
    content.selectEvent(1);
    content.toggleEventType("B");
    expect(content.selectedEventIndex).toBe(1);
    expect(content.canSelectNext).toBe(true);
    content.selectNextEvent();
    expect(content.selectedEventIndex).toBe(2);
  });

  it("disables both Prev and Next when every type is hidden", () => {
    ["A", "B", "C"].forEach(t => content.toggleEventType(t));
    expect(content.canSelectPrev).toBe(false);
    expect(content.canSelectNext).toBe(false);
  });

  it("leaves a hidden event out of visibleEvents", () => {
    content.toggleEventType("B");
    expect(content.visibleEvents.map(e => e.index)).toEqual([0, 2, 3, 4]);
  });
});
```

Note `selectEvent` calls `focusEvent`, which narrows the view onto the selected event. Each test above asserts on indices rather than on `visibleEvents` for that reason, except the last, which does not select anything.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/plugins/timeline/models/timeline-content.test.ts -t "navigating with types hidden"`
Expected: FAIL — Next from 0 lands on 1, not 2.

- [ ] **Step 3: Filter `visibleEvents` from `shownEvents`**

In the `.views` block holding `visibleEvents`, change its source:

```ts
    // Shown in the Event Key and inside the current view. EventOverlay draws exactly these.
    get visibleEvents(): TimelineEvent[] {
      if (!self.viewStartTime || !self.viewEndTime) return [];
      return self.shownEvents.filter(e =>
        e.windowEnd > self.viewStartTime! && e.windowStart < self.viewEndTime!
      );
    },
```

- [ ] **Step 4: Make Prev/Next ask about shown events**

In the same block:

```ts
    get canSelectPrev() {
      return self.shownEvents.some(e => e.index < self.selectedEventIndex);
    },
    get canSelectNext() {
      return self.shownEvents.some(e => e.index > self.selectedEventIndex);
    },
```

- [ ] **Step 5: Make the walk step over hidden events**

In the final `.actions` block, replace `selectNextEvent` and `selectPrevEvent`:

```ts
    selectNextEvent() {
      const next = self.shownEvents.find(e => e.index > self.selectedEventIndex);
      if (next) self.selectEvent(next.index);
    },
    selectPrevEvent() {
      const shownBefore = self.shownEvents.filter(e => e.index < self.selectedEventIndex);
      const prev = shownBefore[shownBefore.length - 1];
      if (prev) self.selectEvent(prev.index);
    }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest src/plugins/timeline/models/timeline-content.test.ts -t "navigating with types hidden"`
Expected: PASS, 6 tests.

- [ ] **Step 7: Mutation-check the skip**

This branch's convention is to break a mechanism and confirm its test fails. Temporarily change `selectNextEvent` back to `self.selectEvent(self.selectedEventIndex + 1)`, run the suite, and confirm "skips hidden events going forward" fails. Restore it.

Run: `npx jest src/plugins/timeline/models/timeline-content.test.ts`
Expected after restoring: all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/plugins/timeline/models/timeline-content.ts src/plugins/timeline/models/timeline-content.test.ts
git commit -m "Skip hidden events in Prev and Next, without renumbering [CLUE-671]"
```

---

## Task 3: One list of colour words and icons

**Files:**
- Create: `src/plugins/timeline/timeline-event-styles.ts`
- Create: `src/plugins/timeline/components/event-overlay.styles.test.ts`
- Modify: `src/plugins/timeline/timeline-types.ts`, `src/plugins/timeline/components/event-shape.tsx`, `src/plugins/timeline/components/timeline-event-colors.scss`, `src/plugins/timeline/components/event-shape.scss`

The colour words are currently a bare array in `timeline-types.ts` while their shapes are a separate record in `event-shape.tsx`, and three scss files restate the same seven-colour ladder. After this task TypeScript has one list, scss has one map, and a test asserts they match.

- [ ] **Step 1: Write the failing test**

Create `src/plugins/timeline/components/event-overlay.styles.test.ts`:

```ts
import fs from "fs";
import path from "path";
import { kEventColorWords } from "../timeline-types";

// jsdom applies no stylesheets, so a rendering test cannot tell a colour word that scss knows about
// from one it has never heard of. These read the stylesheet instead.
describe("timeline event colours", () => {
  const colors = fs.readFileSync(path.join(__dirname, "timeline-event-colors.scss"), "utf8");

  it("declares every colour word TypeScript knows about, and no others", () => {
    const map = colors.match(/\$event-colors:\s*\(([^)]*)\)/s);
    expect(map).not.toBeNull();
    const declared = Array.from(map![1].matchAll(/"([a-z]+)":/g)).map(m => m[1]);
    expect(declared).toEqual([...kEventColorWords, "default"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/plugins/timeline/components/event-overlay.styles.test.ts`
Expected: FAIL — no `$event-colors` map in the stylesheet.

- [ ] **Step 3: Add the scss map**

In `timeline-event-colors.scss`, keep every existing `$...-base`, `$...-hover`, `$...-select` and `$...-full-timeline` variable exactly as it is — these values are correct and must not change. Replace the seven `$...-transparent` lines, which currently restate a base hex in decimal, and add the map. At the end of the file:

```scss
// The marks on the plot sit over black, so their fill is the icon colour at 40%, per the design.
$blue-transparent: rgba($blue-select, 0.4);
$orange-transparent: rgba($orange-select, 0.4);
$red-transparent: rgba($red-select, 0.4);
$yellow-transparent: rgba($yellow-select, 0.4);
$magenta-transparent: rgba($magenta-select, 0.4);
$purple-transparent: rgba($purple-select, 0.4);
$default-transparent: rgba($default-select, 0.4);

$blue-hover-transparent: rgba($blue-hover, 0.4);
$orange-hover-transparent: rgba($orange-hover, 0.4);
$red-hover-transparent: rgba($red-hover, 0.4);
$yellow-hover-transparent: rgba($yellow-hover, 0.4);
$magenta-hover-transparent: rgba($magenta-hover, 0.4);
$purple-hover-transparent: rgba($purple-hover, 0.4);
$default-hover-transparent: rgba($default-hover, 0.4);

// Every per-colour rule in this plugin iterates this map, so a colour is declared once.
// `timeline-event-styles.ts` holds the same words for TypeScript; a test asserts the two agree.
$event-colors: (
  "blue": (base: $blue-base, hover: $blue-hover, select: $blue-select,
           fill: $blue-transparent, hover-fill: $blue-hover-transparent),
  "orange": (base: $orange-base, hover: $orange-hover, select: $orange-select,
             fill: $orange-transparent, hover-fill: $orange-hover-transparent),
  "red": (base: $red-base, hover: $red-hover, select: $red-select,
          fill: $red-transparent, hover-fill: $red-hover-transparent),
  "yellow": (base: $yellow-base, hover: $yellow-hover, select: $yellow-select,
             fill: $yellow-transparent, hover-fill: $yellow-hover-transparent),
  "magenta": (base: $magenta-base, hover: $magenta-hover, select: $magenta-select,
              fill: $magenta-transparent, hover-fill: $magenta-hover-transparent),
  "purple": (base: $purple-base, hover: $purple-hover, select: $purple-select,
             fill: $purple-transparent, hover-fill: $purple-hover-transparent),
  "default": (base: $default-base, hover: $default-hover, select: $default-select,
              fill: $default-transparent, hover-fill: $default-hover-transparent)
);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/plugins/timeline/components/event-overlay.styles.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the TypeScript list**

Create `src/plugins/timeline/timeline-event-styles.tsx` — `.tsx`, not `.ts`, because it holds JSX. The shapes move here verbatim from `event-shape.tsx`:

```ts
import React from "react";

/**
 * The event colour words, in the order `eventTypeColorWords` hands them out, each with the shape
 * that lets its type be told apart without colour. `timeline-event-colors.scss` holds the matching
 * `$event-colors` map; `event-overlay.styles.test.ts` asserts the two lists agree.
 *
 * Shapes are drawn in a 12x12 box, inset by half the 1px outline.
 */
export const kEventStyles: { colorWord: string, shape: React.ReactNode }[] = [
  { colorWord: "blue", shape: <rect x="0.5" y="0.5" width="11" height="11" /> },
  { colorWord: "orange", shape: <circle cx="6" cy="6" r="5.5" /> },
  { colorWord: "red", shape: <polygon points="6,0.5 11.5,11.5 0.5,11.5" /> },
  { colorWord: "yellow", shape: <polygon points="0.5,0.5 11.5,0.5 6,11.5" /> },
  { colorWord: "magenta",
    shape: <><rect x="0.5" y="0.5" width="11" height="4" /><rect x="0.5" y="7.5" width="11" height="4" /></> },
  { colorWord: "purple", shape: <polygon points="6,0.5 11.5,6 6,11.5 0.5,6" /> }
];

/** Types past the six share this. */
export const kDefaultEventShape = <text x="6" y="11" textAnchor="middle">?</text>;

export const kEventShapes: Record<string, React.ReactNode> =
  Object.fromEntries(kEventStyles.map(s => [s.colorWord, s.shape]));
```

- [ ] **Step 6: Derive `kEventColorWords` from it**

In `timeline-types.ts`, replace the literal array:

```ts
import { kEventStyles } from "./timeline-event-styles";

export const kEventColorWords = kEventStyles.map(s => s.colorWord);
```

Leave `getEventColorClass` and the rest of the file unchanged.

- [ ] **Step 7: Make `EventShape` use the shared shapes**

In `event-shape.tsx`, delete the local `kShapes` record and `kDefaultShape` and import instead:

```ts
import { kDefaultEventShape, kEventShapes } from "../timeline-event-styles";
```

and in the body:

```tsx
      {(colorWord && kEventShapes[colorWord]) || kDefaultEventShape}
```

- [ ] **Step 8: Point `event-shape.scss` at the map**

Replace its hand-written `@each` list with one over the shared map:

```scss
@import "./timeline-event-colors.scss";

.event-shape {
  display: block;
  overflow: visible;
  stroke: #121212;
  stroke-width: 1px;

  @each $word, $colors in $event-colors {
    &.#{$word}-event {
      fill: map-get($colors, select);
    }
  }

  &.default-event text {
    fill: #121212;
    font-size: 13px;
    font-weight: bold;
    stroke: none;
  }
}
```

Note this now gives `.default-event` a `fill` as well, which is harmless: the default shape is a `<text>` whose own rule overrides it.

- [ ] **Step 9: Run the affected suites**

Run: `npx jest src/plugins/timeline && npm run check:types`
Expected: all PASS, no type errors. `event-shape.test.tsx` should pass untouched — it is the regression check that moving the shapes changed nothing.

- [ ] **Step 10: Commit**

```bash
git add src/plugins/timeline/timeline-event-styles.tsx src/plugins/timeline/timeline-types.ts \
  src/plugins/timeline/components/event-shape.tsx src/plugins/timeline/components/event-shape.scss \
  src/plugins/timeline/components/timeline-event-colors.scss \
  src/plugins/timeline/components/event-overlay.styles.test.ts
git commit -m "Declare each event colour word and its icon once [CLUE-671]"
```

---

## Task 4: Event rectangles take the icon colour and degenerate to a line

**Files:**
- Modify: `src/plugins/timeline/components/event-overlay.scss`
- Test: `src/plugins/timeline/components/event-overlay.styles.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `event-overlay.styles.test.ts`:

```ts
describe("event-overlay.scss", () => {
  const source = fs.readFileSync(path.join(__dirname, "event-overlay.scss"), "utf8");

  function block(selector: string) {
    const start = source.indexOf(`${selector} {`);
    if (start < 0) throw new Error(`no ${selector} rule in event-overlay.scss`);
    let depth = 0;
    for (let i = source.indexOf("{", start); i < source.length; i++) {
      if (source[i] === "{") depth++;
      if (source[i] === "}" && --depth === 0) return source.slice(start, i);
    }
    throw new Error(`unbalanced braces after ${selector}`);
  }

  // An event narrower than its own borders must read as a single line in the outline colour.
  // With border-box, the two 1px borders fill the minimum width and leave no interior, so this
  // falls out of the box model rather than needing a pixel threshold to test against.
  it("draws a narrow event as a line in the outline colour", () => {
    const rule = block(".event-overlay");
    expect(rule).toMatch(/box-sizing:\s*border-box/);
    expect(rule).toMatch(/min-width:\s*2px/);
  });

  it("colours the rectangle from the icon colour, not the pale button colour", () => {
    const rule = block(".event-overlay");
    expect(rule).toMatch(/border-color:\s*map-get\(\$colors,\s*select\)/);
    expect(rule).toMatch(/background-color:\s*map-get\(\$colors,\s*fill\)/);
    expect(rule).not.toMatch(/\$[a-z]+-base/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/plugins/timeline/components/event-overlay.styles.test.ts`
Expected: FAIL — no `box-sizing` in the rule, and the border still uses a `-base` variable.

- [ ] **Step 3: Rewrite the rectangle rule**

In `event-overlay.scss`, replace the whole `.event-overlay` block — the seven hand-written colour blocks included — with:

```scss
.event-overlay {
  // An event narrower than its own borders becomes a single line in the outline colour: at the
  // minimum width the two borders fill the box and leave no interior for the fill to show through.
  border: 1px solid;
  box-sizing: border-box;
  height: 100%;
  min-width: 2px;
  pointer-events: none;
  position: absolute;
  top: 0;

  @each $word, $colors in $event-colors {
    &.#{$word}-event {
      background-color: map-get($colors, fill);
      border-color: map-get($colors, select);
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/plugins/timeline/components/event-overlay.styles.test.ts`
Expected: PASS.

- [ ] **Step 5: Confirm the stylesheet still compiles**

jsdom never compiles scss, so a syntax error here would reach the browser unnoticed by Jest.

Run: `npm run build:webpack 2>&1 | tail -20`
Expected: build completes with no scss error.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/timeline/components/event-overlay.scss src/plugins/timeline/components/event-overlay.styles.test.ts
git commit -m "Colour event rectangles from their icon, and degenerate narrow ones to a line [CLUE-671]"
```

---

## Task 5: The event number button widens for a 3-digit index

**Files:**
- Modify: `src/plugins/timeline/components/event-overlay.scss`
- Test: `src/plugins/timeline/components/event-overlay.styles.test.ts`

The sheet keeps 1- and 2-digit indices at one width and widens the button for 3 digits. A fixed width cannot do that; a minimum plus padding does, with no second rule.

- [ ] **Step 1: Write the failing test**

Add inside the existing `describe("event-overlay.scss", ...)`:

```ts
  // "1- and 2-digit values use the same width button, while 3-digit values use a wider button."
  // A fixed width cannot widen, so the rule has to be a minimum with padding to grow into.
  it("lets a 3-digit event number widen its button", () => {
    const rule = block(".event-label-button");
    expect(rule).toMatch(/min-width:\s*24px/);
    expect(rule).not.toMatch(/^\s*width:/m);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/plugins/timeline/components/event-overlay.styles.test.ts -t "3-digit"`
Expected: FAIL — the rule has `width: 24px` and no `min-width`.

- [ ] **Step 3: Change the width rule**

In `event-overlay.scss`, inside `.event-label-button`, replace `width: 24px;` with:

```scss
  min-width: 24px;
  padding: 0 4px;
```

Delete the existing `padding: 0;` line in that rule so the new padding is not overridden — check the declaration order and keep only the new one.

- [ ] **Step 4: Replace the button's colour ladder with the map**

Still in `.event-label-button`, replace the seven hand-written colour blocks with:

```scss
  @each $word, $colors in $event-colors {
    &.#{$word}-event {
      background-color: map-get($colors, base);

      &:hover {
        background-color: map-get($colors, hover);
      }
      &:active {
        background-color: map-get($colors, select);
      }
    }
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/plugins/timeline/components/event-overlay.styles.test.ts && npx jest src/plugins/timeline/components/event-overlay.test.tsx`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/timeline/components/event-overlay.scss src/plugins/timeline/components/event-overlay.styles.test.ts
git commit -m "Let a 3-digit event number widen its button [CLUE-671]"
```

---

## Task 6: `EventShape` gains a halo for dark backgrounds

**Files:**
- Modify: `src/plugins/timeline/components/event-shape.tsx`, `src/plugins/timeline/components/event-shape.scss`
- Test: `src/plugins/timeline/components/event-shape.test.tsx`

On the plot the icon sits on the tile's white surround and carries a `#121212` stroke. In the Event Key it overlaps the dark checkbox, where that stroke disappears, so it takes a white halo instead.

- [ ] **Step 1: Write the failing test**

Add to `event-shape.test.tsx`:

```ts
  // In the Event Key the icon overlaps the dark checkbox, where its dark stroke would vanish.
  it("takes a halo when it sits on a dark background", () => {
    const { container } = render(<EventShape colorWord="blue" onDark />);
    expect(container.querySelector("svg")).toHaveClass("on-dark");
  });

  it("has no halo by default", () => {
    expect(renderShape("blue")).not.toHaveClass("on-dark");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/plugins/timeline/components/event-shape.test.tsx -t "halo"`
Expected: FAIL — TypeScript rejects the `onDark` prop.

- [ ] **Step 3: Add the prop**

In `event-shape.tsx`:

```tsx
interface IProps {
  colorWord?: string;
  /** Adds a light halo, for the Event Key where the icon overlaps the dark checkbox. */
  onDark?: boolean;
  size?: number;
}

export function EventShape({ colorWord, onDark, size = 12 }: IProps) {
  return (
    <svg
      className={classNames("event-shape", getEventColorClass(colorWord), { "on-dark": onDark })}
      width={size}
      height={size}
      viewBox="0 0 12 12"
      aria-hidden="true"
    >
      {(colorWord && kEventShapes[colorWord]) || kDefaultEventShape}
    </svg>
  );
}
```

- [ ] **Step 4: Add the halo rule**

In `event-shape.scss`, inside `.event-shape`, after the `@each` block:

```scss
  // A dark stroke is invisible against the Event Key's checkbox, so the icon is ringed in white
  // instead. paint-order puts the stroke behind the fill so it reads as a halo, not a thick outline.
  &.on-dark {
    paint-order: stroke;
    stroke: white;
    stroke-width: 3px;

    text {
      fill: white;
      stroke: none;
    }
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/plugins/timeline/components/event-shape.test.tsx`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/timeline/components/event-shape.tsx src/plugins/timeline/components/event-shape.scss \
  src/plugins/timeline/components/event-shape.test.tsx
git commit -m "Give the event icon a halo for dark backgrounds [CLUE-671]"
```

---

## Task 7: The Event Key becomes checkboxes

**Files:**
- Modify: `src/plugins/timeline/components/timeline-key.tsx`
- Test: `src/plugins/timeline/components/timeline-key.test.tsx` (create)

- [ ] **Step 1: Write the failing tests**

Create `src/plugins/timeline/components/timeline-key.test.tsx`. Mock uPlot and set up a shared dataset exactly as `event-overlay.test.tsx` does — copy that file's `jest.mock("uplot", ...)` block, its imports, its `beforeEach`/`afterEach` and its dataset construction, changing only the component rendered and the event types:

```tsx
describe("TimelineKey", () => {
  function renderKey(readOnly = false) {
    const content = TimelineContentModel.create();
    content.setViewRange(dataStart, dataEnd);
    const model = TileModel.create({ content });
    const result = render(
      <ReadOnlyContext.Provider value={readOnly}>
        <TileModelContext.Provider value={model}>
          <TimelineKey />
        </TileModelContext.Provider>
      </ReadOnlyContext.Provider>
    );
    return { content, ...result };
  }

  it("lists one checkbox per event type present, switched on", () => {
    renderKey();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(2);
    boxes.forEach(box => expect(box).toBeChecked());
    expect(screen.getByRole("checkbox", { name: "Earthquake" })).toBeInTheDocument();
  });

  it("hides a type when its checkbox is unchecked", () => {
    const { content } = renderKey();
    fireEvent.click(screen.getByRole("checkbox", { name: "Earthquake" }));
    expect(content.isEventTypeHidden("Earthquake")).toBe(true);
    expect(screen.getByRole("checkbox", { name: "Earthquake" })).not.toBeChecked();
  });

  it("shows it again when the checkbox is checked", () => {
    const { content } = renderKey();
    const box = screen.getByRole("checkbox", { name: "Earthquake" });
    fireEvent.click(box);
    fireEvent.click(box);
    expect(content.isEventTypeHidden("Earthquake")).toBe(false);
  });

  it("reflects a type hidden before it mounted", () => {
    const content = TimelineContentModel.create();
    content.setViewRange(dataStart, dataEnd);
    content.toggleEventType("Earthquake");
    const model = TileModel.create({ content });
    render(
      <TileModelContext.Provider value={model}>
        <TimelineKey />
      </TileModelContext.Provider>
    );
    expect(screen.getByRole("checkbox", { name: "Earthquake" })).not.toBeChecked();
  });

  // A read-only pane shares the document model, so a live checkbox there edits the student's work.
  it("disables its checkboxes when read-only", () => {
    renderKey(true);
    screen.getAllByRole("checkbox").forEach(box => expect(box).toBeDisabled());
  });

  it("carries each type's icon", () => {
    const { container } = renderKey();
    expect(container.querySelectorAll(".event-shape.on-dark")).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/plugins/timeline/components/timeline-key.test.tsx`
Expected: FAIL — `getAllByRole("checkbox")` finds nothing; the key renders static swatches.

- [ ] **Step 3: Rewrite the component**

Replace `timeline-key.tsx` entirely. Note the `clsx` import goes: CLAUDE.md requires `classnames`.

```tsx
import classNames from "classnames";
import { observer } from "mobx-react-lite";
import React from "react";
import { useReadOnlyContext } from "../../../components/document/read-only-context";
import { useTimelineContent } from "../hooks/use-timeline-content";
import { getEventColorClass } from "../timeline-types";
import { EventShape } from "./event-shape";

import "./timeline-key.scss";

export const TimelineKey = observer(function TimelineKey() {
  const content = useTimelineContent();
  const readOnly = useReadOnlyContext();
  const colorWords = content.eventTypeColorWords;

  return (
    <div className="timeline-key">
      <div className="key-title">Event Key</div>
      {Array.from(colorWords.entries()).map(([eventType, colorWord]) => (
        <label key={eventType} className={classNames("event-type-entry", getEventColorClass(colorWord))}>
          <span className="key-checkbox">
            <input
              type="checkbox"
              checked={!content.isEventTypeHidden(eventType)}
              disabled={readOnly}
              onChange={() => content.toggleEventType(eventType)}
            />
            <EventShape colorWord={colorWord} onDark />
          </span>
          <span className="event-type-label">{eventType}</span>
        </label>
      ))}
    </div>
  );
});
```

The `<label>` wrapper is what gives each checkbox its accessible name, which is what `getByRole("checkbox", { name: "Earthquake" })` matches on.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/plugins/timeline/components/timeline-key.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Mutation-check the wiring**

Temporarily change `checked={!content.isEventTypeHidden(eventType)}` to `checked={true}` and confirm "hides a type when its checkbox is unchecked" fails. Restore it.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/timeline/components/timeline-key.tsx src/plugins/timeline/components/timeline-key.test.tsx
git commit -m "Make the Event Key entries switch their type on and off [CLUE-671]"
```

---

## Task 8: Style the Event Key checkbox

**Files:**
- Modify: `src/plugins/timeline/components/timeline-key.scss`

The control is the event rectangle in miniature over a black backing — the same `select` border and the same 40% fill, which is why its measured colour on the design sheet is identical to the mark on the plot. Only the colour basis changes on hover; only the checkmark changes with checked.

- [ ] **Step 1: Replace the stylesheet**

Replace `timeline-key.scss` entirely:

```scss
@import "../../../components/vars";
@import "./timeline-event-colors.scss";

.timeline-key {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: center;

  .key-title {
    font-weight: bold;
    margin-right: 5px;
  }

  .event-type-entry {
    align-items: center;
    display: flex;
    gap: 6px;

    .key-checkbox {
      display: block;
      position: relative;

      // The icon overlaps the box's top-left corner, as the design has it. It is decorative — the
      // label names the type — so it must not swallow clicks meant for the checkbox.
      .event-shape {
        left: -5px;
        pointer-events: none;
        position: absolute;
        top: -5px;
      }
    }

    input[type="checkbox"] {
      appearance: none;
      // The mark on the plot is its colour over the black graph; the checkbox carries its own
      // black so the swatch is a true miniature of what it governs.
      background-color: #121212;
      border: 3px solid #121212;
      cursor: pointer;
      height: 22px;
      margin: 0;
      position: relative;
      width: 22px;

      &:disabled {
        cursor: default;
      }

      &:focus-visible {
        outline: $focus-ring-outer-width solid $focus-ring-color;
        outline-offset: $focus-ring-inner-width;
      }

      // The checkmark. Drawn always, so hovering an unchecked box can preview it.
      &::after {
        border: solid white;
        border-width: 0 3px 3px 0;
        content: "";
        height: 10px;
        left: 6px;
        opacity: 0;
        position: absolute;
        top: 1px;
        transform: rotate(45deg);
        width: 5px;
      }

      &:checked::after {
        opacity: 1;
      }

      // Hovering an unchecked box ghosts the check in, previewing what the click would do.
      &:hover:not(:checked):not(:disabled)::after {
        opacity: 0.45;
      }
    }

    @each $word, $colors in $event-colors {
      &.#{$word}-event input[type="checkbox"] {
        background-image: linear-gradient(map-get($colors, fill), map-get($colors, fill));
        box-shadow: inset 0 0 0 4px map-get($colors, select);

        &:hover:not(:disabled) {
          background-image: linear-gradient(map-get($colors, hover-fill), map-get($colors, hover-fill));
          box-shadow: inset 0 0 0 4px map-get($colors, hover);
        }
      }
    }
  }
}
```

The fill is a `linear-gradient` rather than a `background-color` because the swatch needs two layers — the black backing and the translucent colour over it — and `background-color` is only one. The gradient is a flat fill of a single colour.

- [ ] **Step 2: Confirm the stylesheet compiles**

Run: `npm run build:webpack 2>&1 | tail -20`
Expected: build completes with no scss error.

- [ ] **Step 3: Run the key's tests for regressions**

Run: `npx jest src/plugins/timeline/components/timeline-key.test.tsx`
Expected: all PASS — jsdom ignores the styling, so these should be unaffected.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/timeline/components/timeline-key.scss
git commit -m "Draw the Event Key checkbox as the event rectangle in miniature [CLUE-671]"
```

---

## Task 9: The Full Timeline draws only shown events

**Files:**
- Modify: `src/plugins/timeline/components/full-timeline.tsx`
- Test: `src/plugins/timeline/components/full-timeline.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `full-timeline.test.tsx`, beside the existing "shows every event..." test. `renderFullTimeline(viewStart, viewEnd)` already returns the content model, and `mockSharedDataSet` is assigned before rendering, exactly as that test does it:

```tsx
  it("stops drawing a type that is switched off in the Event Key", () => {
    const dataSet = DataSet.create();
    addAttributeToDataSet(dataSet, { name: "windowStart" });
    addAttributeToDataSet(dataSet, { name: "windowEnd" });
    addAttributeToDataSet(dataSet, { name: "eventType" });
    addCasesToDataSet(dataSet, [
      { windowStart: day(1.5).toISO()!, windowEnd: day(1.75).toISO()!, eventType: "Earthquake" },
      { windowStart: day(3).toISO()!, windowEnd: day(3.5).toISO()!, eventType: "Noise" }
    ]);
    mockSharedDataSet = SharedDataSet.create({ dataSet });

    const { content, container } = renderFullTimeline(day(1), day(2));
    expect(container.querySelectorAll(".full-timeline-event")).toHaveLength(2);

    act(() => { content.toggleEventType("Earthquake"); });

    const left = container.querySelectorAll<HTMLElement>(".full-timeline-event");
    expect(left).toHaveLength(1);
    expect(left[0]).toHaveClass("orange-event");
  });
```

Add `act` to the `@testing-library/react` import at the top of the file if it is not already there.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/plugins/timeline/components/full-timeline.test.tsx -t "switched off"`
Expected: FAIL — the count is unchanged, because the strip maps `content.events`.

- [ ] **Step 3: Draw the shown events**

In `full-timeline.tsx`, in `FullTimelineEvents`:

```tsx
      {content.shownEvents.map(event => {
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/plugins/timeline/components/full-timeline.test.tsx`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/timeline/components/full-timeline.tsx src/plugins/timeline/components/full-timeline.test.tsx
git commit -m "Leave switched-off events out of the Full Timeline [CLUE-671]"
```

---

## Task 10: The run-info header

**Files:**
- Modify: `src/plugins/timeline/components/timeline-tile.tsx`, `src/plugins/timeline/components/timeline-tile.scss`
- Test: `src/plugins/timeline/components/timeline-tile.test.tsx`

The header shows three lines — station label, start date, end date — as `MM/DD/YYYY` with no time. `modelLabel` leaves the display and stays on the model.

- [ ] **Step 1: Write the failing test**

Add to `timeline-tile.test.tsx` inside `describe("with seismogram data", ...)`. That block's `beforeEach` already mocks a seismogram running from `2026-02-01` to `2026-02-05`, and `renderWithStores()` is in scope there and returns the render result. Do **not** use `renderInTile`/`provideData` — those are scoped to the `"keyboard focus slots"` describe and are not visible here.

```ts
    it("heads the tile with the station and the run's dates, without times", () => {
      const { container } = renderWithStores();
      const lines = container.querySelectorAll(".metadata-display div");
      expect(lines).toHaveLength(3);
      expect(lines[1]).toHaveTextContent("02/01/2026");
      expect(lines[2]).toHaveTextContent("02/05/2026");
      // The old header showed a full locale date-time; the design shows the date alone.
      expect(lines[1]).not.toHaveTextContent(":");
    });
```

This block's mock supplies no `station`, so the first line is empty — that is expected, and the test does not assert on it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/plugins/timeline/components/timeline-tile.test.tsx -t "heads the tile"`
Expected: FAIL — there are four divs, and the dates carry times.

- [ ] **Step 3: Rewrite the header**

In `timeline-tile.tsx`, replace the `.metadata-display` block:

```tsx
      <div className="metadata-display">
        <div>{content.sharedSeismogram?.station?.label ?? ""}</div>
        <div>{content.dataStartTime?.toUTC().toLocaleString(DateTime.DATE_SHORT) ?? ""}</div>
        <div>{content.dataEndTime?.toUTC().toLocaleString(DateTime.DATE_SHORT) ?? ""}</div>
      </div>
```

Add `import { DateTime } from "luxon";` to the file's imports if it is not already there.

- [ ] **Step 4: Style it**

In `timeline-tile.scss`, extend the existing `.metadata-display` rule:

```scss
  .metadata-display {
    color: #121212;
    font-size: 14px;
    left: 10px;
    line-height: 1.3;
    position: absolute;
    top: 10px;
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/plugins/timeline/components/timeline-tile.test.tsx`
Expected: all PASS. If another test asserted on `modelLabel` appearing in the header, update it — the label is deliberately no longer displayed.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/timeline/components/timeline-tile.tsx src/plugins/timeline/components/timeline-tile.scss \
  src/plugins/timeline/components/timeline-tile.test.tsx
git commit -m "Head the Timeline tile with the station and the run's dates [CLUE-671]"
```

---

## Task 11: The key's checkboxes join the tile's focus walk

**Files:**
- Modify: `src/plugins/timeline/components/timeline-tile.tsx`
- Test: `src/plugins/timeline/components/timeline-tile.test.tsx`

`TimelineKey` renders inside `.timeline-container`, after the Full Timeline, so its checkboxes are the last focusable controls in the tile's contents. `kContentControls` picks where the focus trap enters, so leaving them out would make Shift+Tab land on the scrollbar thumb instead of the last key control — the failure CLUE-720's note on this story warns about.

- [ ] **Step 1: Write the failing test**

Add to the `describe("keyboard focus slots", ...)` block in `timeline-tile.test.tsx`:

```ts
    it("Tabs into the key's checkboxes last, and back out of them first", () => {
      provideData({ eventCount: 3, seismogram: true });
      (model.content as TimelineContentModelType).selectEvent(1);
      const { api, elements } = renderInTile();
      const title = elements!.titleElement;
      const boxes = screen.getAllByRole("checkbox");
      const lastBox = boxes[boxes.length - 1];

      const trap = createFocusTrap(api!);
      act(() => trap.enterTrap());
      expect(document.activeElement).toBe(title);
      // One Shift+Tab from the title reaches the last control in the contents. That used to be the
      // scrollbar thumb; the key's checkboxes render after the Full Timeline, so it is now the last
      // of those.
      expect(pressTab(1, true)[0]).toBe(lastBox);
      trap.destroy();
    });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/plugins/timeline/components/timeline-tile.test.tsx -t "key's checkboxes last"`
Expected: FAIL — reverse entry lands on the scrollbar thumb.

- [ ] **Step 3: Add the checkboxes to the control list**

In `timeline-tile.tsx`, extend `kContentControls` and its comment:

```ts
// The controls Tab visits in the tile's contents, in order: Prev, Next, the Full Timeline's
// scrollbar thumb and the Event Key's checkboxes, less any that are disabled.
const kContentControls =
  ".event-row .timeline-button:not(:disabled), .dynamic-scrollbar-thumb:not([aria-disabled]), " +
  ".timeline-key input[type=\"checkbox\"]:not(:disabled)";
```

If CLUE-709 has merged by now, this constant lives in `src/plugins/timeline/components/timeline-content-controls.ts` instead; make the same edit there and leave `timeline-tile.tsx` alone.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/plugins/timeline/components/timeline-tile.test.tsx`
Expected: all PASS, including the existing both-directions Tab test.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/timeline/components/timeline-tile.tsx src/plugins/timeline/components/timeline-tile.test.tsx
git commit -m "Put the Event Key's checkboxes in the tile's focus walk [CLUE-671]"
```

---

## Task 12: Verify the whole branch

- [ ] **Step 1: Run every test**

Run: `npx jest --silent 2>&1 | tail -10`
Expected: 0 failures.

- [ ] **Step 2: Type-check**

Run: `npm run check:types`
Expected: no output.

- [ ] **Step 3: Lint**

Run: `npm run lint:build 2>&1 | grep -E "^✖"`
Expected: `0 errors` on every line. Warnings that were already in the tree are fine; new ones in the touched files are not.

- [ ] **Step 4: Self-review the diff**

Use the `code-self-review` skill over `git diff master...HEAD`.

- [ ] **Step 5: Check it by hand on localhost**

jsdom renders no layout and applies no stylesheets, so none of the following is covered by any test above. Start the dev server and open a unit with a Timeline tile holding several event types.

- The rectangle colours against the black plot, and that their interiors let the waveform through.
- A narrow event at a wide zoom: it should be a single line in the outline colour, not a bordered blob.
- Each Event Key checkbox in all four states — checked, unchecked, checked-hovered, unchecked-hovered with its ghost check — plus its focus ring under Tab.
- The icon's overlap on the checkbox's top-left corner, and that its halo keeps it legible there.
- An event numbered 100 or more, to see the button widen.
- The header's three lines.

Run: `npm start`, then check the above. Per the repo's convention, confirm the dev server reports 0 compile errors before judging anything on screen.

- [ ] **Step 6: Push and open the PR**

Do not push until the hand-check above passes and the user has confirmed.

---

## Notes carried from the spec

- **Do not sample hexes from the spec sheet attached to CLUE-671.** It is Display P3 converted to sRGB: saturated colours read desaturated — blue samples as `#5ea4f8` where the design is `#42a6ff` — while greys come back exact, so the file looks trustworthy when it is not. The values in `timeline-event-colors.scss` are correct and confirmed by the designer. The sheet is authoritative for *structure* only.
- **Out of scope, deliberately:** the number buttons' keyboard focus state, which would mean putting them in the Tab order and reversing CLUE-720's deferral; and the sheet's green table-select highlighting, which is selection shared with a linked Table tile. Both are their own stories.
- **Hiding the selected event's type leaves the selection where it is** — the Event label goes on reading "Event 3" while nothing is drawn for it. Moving the selection instead would re-aim the viewport on a checkbox click, because `selectEvent` calls `focusEvent`.
