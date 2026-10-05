# CLUE-669 WaveRunner Date Set-up Styling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Style the WaveRunner tile's Data Setup dropdowns and date fields to Michael's design, and make an end-date-before-start-date unselectable.

**Architecture:** The two native `<select>` elements move to CLUE's existing `CustomSelect`, which needs no new dependency. The two native `<input type="datetime-local">` elements are replaced by a new `DateField` wrapping React Aria's `DatePicker`, because a native calendar panel is browser chrome and cannot be styled. `DateField` converts at its boundary between the model's `"YYYY-MM-DD"` strings and `@internationalized/date` objects, so the model, the range logic and everything downstream of `TimeRange` are untouched.

**Tech Stack:** TypeScript 5.8, React 18.3, MobX State Tree, SCSS with `src/components/vars.scss` tokens, Jest + React Testing Library. New: `react-aria-components`, `@internationalized/date` (both Apache-2.0).

**Spec:** `docs/superpowers/specs/2026-10-05-clue-669-waverunner-date-setup-styling-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `src/plugins/wave-runner/models/wave-runner-content.ts` | MODIFY. Default dates; the `run` single-day check. |
| `src/plugins/wave-runner/components/date-utils.ts` | CREATE. Pure conversion between `"YYYY-MM-DD"` and `CalendarDate`. No React. |
| `src/plugins/wave-runner/components/date-utils.test.ts` | CREATE. Round-trip and malformed-input tests. |
| `src/plugins/wave-runner/components/date-field.tsx` | CREATE. The styled picker: field, popover, calendar, month-year header, Clear/Cancel/OK. |
| `src/plugins/wave-runner/components/date-field.scss` | CREATE. Picker styling, tokens only. |
| `src/plugins/wave-runner/components/date-field.test.tsx` | CREATE. Render, buffering, min/max. |
| `src/plugins/wave-runner/components/data-setup.tsx` | MODIFY. Use `CustomSelect` and `DateField`. |
| `src/plugins/wave-runner/components/data-setup.scss` | MODIFY. Layout plus dropdown scoping. |
| `src/plugins/wave-runner/components/data-setup.test.tsx` | CREATE. Wiring and disabled states. |

### A refinement this plan makes to the spec

The spec says the field displays `12:00 AM`. React Aria only renders time segments when the value is a `CalendarDateTime` and `granularity` is `"hour"` or finer — and those segments are **keyboard-editable**, which would hand students the time control the spec explicitly defers.

So `DateField` uses `granularity="day"` (date segments only) and renders `, 12:00 AM` as **static text** inside the field. Same appearance, genuinely not settable, and no `CalendarDateTime` anywhere. Task 5 implements this.

### Known risk: React Aria API drift

The React Aria code below is written against its documented API but has not been executed, because the package is not yet installed. **Task 3 installs it and renders a minimal picker specifically to surface any drift early.** If import names or slot names differ, fix them in Task 3 and carry the correction forward; do not work around it later.

---

## Task 1: Change the default date range

**Files:**
- Modify: `src/plugins/wave-runner/models/wave-runner-content.ts:45-46`
- Test: `src/plugins/wave-runner/models/wave-runner-content.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/plugins/wave-runner/models/wave-runner-content.test.ts`:

```ts
describe("default date range", () => {
  it("starts a new tile at 2026-09-01 through 2026-10-01", () => {
    const content = defaultWaveRunnerContent();
    expect(content.startDate).toBe("2026-09-01");
    expect(content.endDate).toBe("2026-10-01");
  });

  it("serializes the defaults into the document snapshot", () => {
    const snapshot = getSnapshot(defaultWaveRunnerContent()) as Record<string, unknown>;
    expect(snapshot.startDate).toBe("2026-09-01");
    expect(snapshot.endDate).toBe("2026-10-01");
  });
});
```

Add `import { getSnapshot } from "mobx-state-tree";` to the file's imports if it is not already there.

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx jest src/plugins/wave-runner/models/wave-runner-content --silent`
Expected: FAIL — received `"2025-01-01"`, expected `"2026-09-01"`.

- [ ] **Step 3: Change the defaults**

In `src/plugins/wave-runner/models/wave-runner-content.ts`, replace:

```ts
    startDate: types.optional(types.string, "2025-01-01"),
    endDate: types.optional(types.string, "2025-12-31"),
```

with:

```ts
    startDate: types.optional(types.string, "2026-09-01"),
    endDate: types.optional(types.string, "2026-10-01"),
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx jest src/plugins/wave-runner/models/wave-runner-content --silent`
Expected: PASS.

- [ ] **Step 5: Find every other test that assumed the old defaults**

Run: `grep -rn "2025-01-01\|2025-12-31" src/ cypress/`
Expected: any hit is a test or fixture asserting the old range. Update each to the new dates. If a hit is unrelated to WaveRunner, leave it alone.

- [ ] **Step 6: Run the full suite**

Run: `npx jest --silent`
Expected: no failures.

- [ ] **Step 7: Commit**

```bash
git add src/plugins/wave-runner/models/wave-runner-content.ts src/plugins/wave-runner/models/wave-runner-content.test.ts
git commit -m "CLUE-669: default the WaveRunner date range to 2026-09-01 through 2026-10-01"
```

---

## Task 2: Let Run accept a single-day range

`loadData` rejects `end < start`, so a single day is valid. `run` rejects `end <= start`, so it is not. Once a student can pick the same day in both pickers, Load Data accepts the range and Run fails on it.

**Files:**
- Modify: `src/plugins/wave-runner/models/wave-runner-content.ts:233`
- Test: `src/plugins/wave-runner/models/wave-runner-content.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/plugins/wave-runner/models/wave-runner-content.test.ts`:

```ts
describe("single-day range", () => {
  it("does not set a run error when start and end are the same day", () => {
    const content = defaultWaveRunnerContent();
    content.setStartDate("2026-09-15");
    content.setEndDate("2026-09-15");
    expect(content.startDate).toBe(content.endDate);
    // endDate is inclusive, so one day is a legitimate range and must not be rejected
    // on the grounds that end is not strictly after start.
    expect(content.runError).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and watch it pass for the wrong reason**

Run: `npx jest src/plugins/wave-runner/models/wave-runner-content --silent -t "single-day"`
Expected: PASS, because `runError` is only set once `run` executes. This test alone does not prove the fix. Treat it as a guard against a regression in the setters, and rely on Step 3's reading of the code for the actual change.

- [ ] **Step 3: Change the comparison**

In `src/plugins/wave-runner/models/wave-runner-content.ts`, inside the `run` action, replace:

```ts
        if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
          self.runError = "Invalid date range. End date must be after start date.";
```

with:

```ts
        // endDate is inclusive, so start == end is a valid single-day range, matching loadData.
        if (isNaN(startMs) || isNaN(endMs) || endMs < startMs) {
          self.runError = "Invalid date range. End date must not be before start date.";
```

- [ ] **Step 4: Confirm the two checks now agree**

Run: `grep -n "endMs < startMs\|endMs <= startMs" src/plugins/wave-runner/models/wave-runner-content.ts`
Expected: two hits, both `endMs < startMs`.

- [ ] **Step 5: Run the suite**

Run: `npx jest src/plugins/wave-runner --silent`
Expected: no failures.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/wave-runner/models/wave-runner-content.ts src/plugins/wave-runner/models/wave-runner-content.test.ts
git commit -m "CLUE-669: accept a single-day range in run, matching loadData"
```

---

## Task 3: Install React Aria, measure the bundle, and prove the API

This task exists to find out two things early: what the dependency costs, and whether the API in this plan is correct.

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Record the bundle size before**

```bash
npm run build
du -sk dist | tee /tmp/clue-669-dist-before.txt
ls -lS dist/*.js | head -10 | tee -a /tmp/clue-669-dist-before.txt
```

Expected: a total in kilobytes and the ten largest chunks. Keep this output.

- [ ] **Step 2: Install**

```bash
npm install --save react-aria-components @internationalized/date
```

- [ ] **Step 3: Write a throwaway smoke render to prove the API**

Create `src/plugins/wave-runner/components/aria-smoke.test.tsx`:

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { parseDate } from "@internationalized/date";
import {
  Button, Calendar, CalendarCell, CalendarGrid, DateInput, DatePicker,
  DateSegment, Dialog, Group, Heading, Label, Popover
} from "react-aria-components";

it("renders a React Aria DatePicker with the API this plan assumes", () => {
  render(
    <DatePicker value={parseDate("2026-09-01")} granularity="day" aria-label="smoke">
      <Label>Smoke</Label>
      <Group>
        <DateInput>{segment => <DateSegment segment={segment} />}</DateInput>
        <Button>cal</Button>
      </Group>
      <Popover>
        <Dialog>
          <Calendar>
            <header>
              <Button slot="previous">prev</Button>
              <Heading />
              <Button slot="next">next</Button>
            </header>
            <CalendarGrid>{date => <CalendarCell date={date} />}</CalendarGrid>
          </Calendar>
        </Dialog>
      </Popover>
    </DatePicker>
  );
  expect(screen.getByText("Smoke")).toBeInTheDocument();
});
```

- [ ] **Step 4: Run the smoke test**

Run: `npx jest src/plugins/wave-runner/components/aria-smoke --silent`
Expected: PASS.

If it fails on an import or a slot name, the installed version's API differs from this plan. Fix the smoke test until it passes, then **apply the same corrections to Tasks 5 through 8 as you reach them**.

- [ ] **Step 5: Measure the bundle after**

```bash
npm run build
du -sk dist | tee /tmp/clue-669-dist-after.txt
ls -lS dist/*.js | head -10 | tee -a /tmp/clue-669-dist-after.txt
diff /tmp/clue-669-dist-before.txt /tmp/clue-669-dist-after.txt
```

Expected: a measurable delta in kilobytes.

**Decision point.** If the delta is larger than about 300 KB, stop and report the number before continuing. That is the point to reconsider the dependency, not after the styling is built.

- [ ] **Step 6: Delete the smoke test**

```bash
rm src/plugins/wave-runner/components/aria-smoke.test.tsx
```

It has done its job; the real tests follow.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json
git commit -m "CLUE-669: add react-aria-components and @internationalized/date"
```

Include the measured before/after sizes in the commit body.

---

## Task 4: Date conversion helpers

Pure functions, no React, so the fiddly part is testable on its own.

**Files:**
- Create: `src/plugins/wave-runner/components/date-utils.ts`
- Test: `src/plugins/wave-runner/components/date-utils.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/plugins/wave-runner/components/date-utils.test.ts`:

```ts
import { CalendarDate } from "@internationalized/date";
import { fromDateString, toDateString } from "./date-utils";

describe("date-utils", () => {
  it("parses a stored date string", () => {
    const date = fromDateString("2026-09-01");
    expect(date).toEqual(new CalendarDate(2026, 9, 1));
  });

  it("round-trips a stored date string unchanged", () => {
    expect(toDateString(fromDateString("2026-09-01")!)).toBe("2026-09-01");
    expect(toDateString(fromDateString("2026-10-01")!)).toBe("2026-10-01");
  });

  it("zero-pads single-digit months and days", () => {
    expect(toDateString(new CalendarDate(2026, 1, 5))).toBe("2026-01-05");
  });

  it("returns undefined for a malformed or empty string rather than throwing", () => {
    expect(fromDateString("")).toBeUndefined();
    expect(fromDateString("not-a-date")).toBeUndefined();
    expect(fromDateString("2026-13-45")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx jest src/plugins/wave-runner/components/date-utils --silent`
Expected: FAIL — cannot resolve `./date-utils`.

- [ ] **Step 3: Write the implementation**

Create `src/plugins/wave-runner/components/date-utils.ts`:

```ts
import { CalendarDate, parseDate } from "@internationalized/date";

/**
 * The model stores dates as "YYYY-MM-DD" strings. CalendarDate carries no timezone, so this
 * conversion cannot shift a date — which is what lets the picker be swapped in without touching
 * the model or the range logic.
 */
export function fromDateString(value: string): CalendarDate | undefined {
  try {
    return parseDate(value);
  } catch {
    // parseDate throws on anything that is not a valid ISO date. A stored value should always be
    // valid, so this guards against a hand-edited document rather than ordinary input.
    return undefined;
  }
}

export function toDateString(date: CalendarDate): string {
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");
  return `${date.year}-${month}-${day}`;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx jest src/plugins/wave-runner/components/date-utils --silent`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/wave-runner/components/date-utils.ts src/plugins/wave-runner/components/date-utils.test.ts
git commit -m "CLUE-669: add date string conversion helpers for the picker boundary"
```

---

## Task 5: DateField renders the field and popover

**Files:**
- Create: `src/plugins/wave-runner/components/date-field.tsx`
- Create: `src/plugins/wave-runner/components/date-field.scss`
- Test: `src/plugins/wave-runner/components/date-field.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/plugins/wave-runner/components/date-field.test.tsx`:

```tsx
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { DateField } from "./date-field";

function renderField(overrides: Partial<React.ComponentProps<typeof DateField>> = {}) {
  const onChange = jest.fn();
  render(
    <DateField
      id="start"
      label="Start Date and Time"
      value="2026-09-01"
      onChange={onChange}
      {...overrides}
    />
  );
  return onChange;
}

describe("DateField", () => {
  it("shows its label", () => {
    renderField();
    expect(screen.getByText("Start Date and Time")).toBeInTheDocument();
  });

  // The time is display only. Rendering it as static text rather than editable segments is what
  // keeps a student from setting a time the model cannot store.
  it("shows a fixed 12:00 AM that is not an editable segment", () => {
    renderField();
    const time = screen.getByText(", 12:00 AM");
    expect(time).toBeInTheDocument();
    expect(time.tagName).toBe("SPAN");
    expect(time).not.toHaveAttribute("contenteditable");
  });

  it("opens the calendar popover from the trigger", () => {
    renderField();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Choose date" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows standard three-letter weekday abbreviations", () => {
    renderField();
    fireEvent.click(screen.getByRole("button", { name: "Choose date" }));
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(day => {
      expect(screen.getByText(day)).toBeInTheDocument();
    });
  });

  it("does not render a time column in the popover", () => {
    renderField();
    fireEvent.click(screen.getByRole("button", { name: "Choose date" }));
    expect(screen.queryByTestId("date-field-time-column")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx jest src/plugins/wave-runner/components/date-field --silent`
Expected: FAIL — cannot resolve `./date-field`.

- [ ] **Step 3: Write the component**

Create `src/plugins/wave-runner/components/date-field.tsx`:

```tsx
import { CalendarDate } from "@internationalized/date";
import React from "react";
import {
  Button, Calendar, CalendarCell, CalendarGrid, DateInput, DatePicker,
  DateSegment, Dialog, Group, Heading, Label, Popover
} from "react-aria-components";

import CalendarIcon from "../assets/calendar-icon.svg";
import { fromDateString, toDateString } from "./date-utils";

import "./date-field.scss";

export interface IDateFieldProps {
  id: string;
  label: string;
  /** "YYYY-MM-DD", exactly as the model stores it. */
  value: string;
  onChange: (value: string) => void;
  minValue?: string;
  maxValue?: string;
  isDisabled?: boolean;
}

export const DateField: React.FC<IDateFieldProps> = function DateField(props) {
  const { id, label, value, onChange, minValue, maxValue, isDisabled } = props;

  const handleChange = (date: CalendarDate | null) => {
    if (date) onChange(toDateString(date));
  };

  return (
    <DatePicker
      className="wave-runner-date-field"
      value={fromDateString(value) ?? null}
      onChange={handleChange}
      minValue={minValue ? fromDateString(minValue) : undefined}
      maxValue={maxValue ? fromDateString(maxValue) : undefined}
      isDisabled={isDisabled}
      granularity="day"
    >
      <Label className="field-label" htmlFor={id}>{label}</Label>
      <Group className="field-group">
        <DateInput className="date-input" id={id}>
          {segment => <DateSegment segment={segment} />}
        </DateInput>
        {/* Display only. The model stores a date, so there is no time to set; rendering this as
            text rather than an editable segment is what keeps it unsettable. */}
        <span className="static-time">, 12:00 AM</span>
        <Button className="calendar-trigger" aria-label="Choose date">
          <CalendarIcon className="calendar-glyph" />
        </Button>
      </Group>
      <Popover className="date-field-popover">
        <Dialog className="date-field-dialog">
          <Calendar className="date-field-calendar">
            <header className="calendar-header">
              <Button slot="previous" className="nav-button" aria-label="Previous month">‹</Button>
              <Heading className="calendar-heading" />
              <Button slot="next" className="nav-button" aria-label="Next month">›</Button>
            </header>
            <CalendarGrid className="calendar-grid">
              {date => <CalendarCell date={date} className="calendar-cell" />}
            </CalendarGrid>
          </Calendar>
        </Dialog>
      </Popover>
    </DatePicker>
  );
};
```

- [ ] **Step 4: Add the calendar icon asset**

SVGs in this repo are imported as React components via SVGR, which is why `CalendarIcon` is used as
a tag rather than a CSS background. No calendar glyph exists in the WaveRunner assets yet, so copy
the one the Data Card tile already uses:

```bash
cp src/plugins/data-card/assets/id-type-date.svg src/plugins/wave-runner/assets/calendar-icon.svg
```

Copying rather than importing across plugins keeps WaveRunner from reaching into Data Card's
assets. If Michael exports the design's own glyph, it replaces this one file and nothing else
changes.

- [ ] **Step 5: Create the stylesheet so the import resolves**

Create `src/plugins/wave-runner/components/date-field.scss`:

```scss
@import "../../../components/vars";
@import "../../../components/mixins";

.wave-runner-date-field {
  display: flex;
  flex-direction: column;
}
```

Task 11 fills this in. It exists now only so the import resolves.

- [ ] **Step 6: Run the test and watch it pass**

Run: `npx jest src/plugins/wave-runner/components/date-field --silent`
Expected: PASS, 5 tests.

If the weekday test fails because React Aria renders two-letter abbreviations, set `weekdayStyle="short"` on `<CalendarGrid>`, which is the prop that selects `Sun`/`Mon` over `Su`/`Mo`.

- [ ] **Step 7: Commit**

```bash
git add src/plugins/wave-runner/assets/calendar-icon.svg src/plugins/wave-runner/components/date-field.tsx src/plugins/wave-runner/components/date-field.scss src/plugins/wave-runner/components/date-field.test.tsx
git commit -m "CLUE-669: add a styled DateField built on React Aria DatePicker"
```

---

## Task 6: Buffer the selection behind Clear, Cancel and OK

Stock React Aria commits the moment a day is clicked. The design has a footer, which means the popover holds a pending selection and only writes it on OK. This is the one place the story writes behavior rather than restyling, so it gets the most tests.

**Files:**
- Modify: `src/plugins/wave-runner/components/date-field.tsx`
- Test: `src/plugins/wave-runner/components/date-field.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `src/plugins/wave-runner/components/date-field.test.tsx`:

```tsx
describe("DateField buffering", () => {
  function openAndPick(day: string, overrides = {}) {
    const onChange = renderField(overrides);
    fireEvent.click(screen.getByRole("button", { name: "Choose date" }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`${day}`) }));
    return onChange;
  }

  it("does not commit a day until OK is pressed", () => {
    const onChange = openAndPick("15");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onChange).toHaveBeenCalledWith("2026-09-15");
  });

  it("discards the pending day on Cancel and closes", () => {
    const onChange = openAndPick("15");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // The model always holds a date, so Clear resets rather than empties.
  it("resets to defaultValue on Clear", () => {
    const onChange = openAndPick("15", { defaultValue: "2026-09-01" });
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onChange).toHaveBeenCalledWith("2026-09-01");
  });

  it("reseeds the pending day from value each time it opens", () => {
    renderField();
    fireEvent.click(screen.getByRole("button", { name: "Choose date" }));
    fireEvent.click(screen.getByRole("button", { name: /15/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose date" }));
    expect(screen.getByRole("button", { name: /1/, pressed: true })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx jest src/plugins/wave-runner/components/date-field --silent -t "buffering"`
Expected: FAIL — no OK, Cancel or Clear button exists.

- [ ] **Step 3: Add buffering and the footer**

In `src/plugins/wave-runner/components/date-field.tsx`, add `defaultValue` to the props interface:

```tsx
export interface IDateFieldProps {
  id: string;
  label: string;
  /** "YYYY-MM-DD", exactly as the model stores it. */
  value: string;
  onChange: (value: string) => void;
  /** What Clear resets to. The model always holds a date, so Clear cannot empty the field. */
  defaultValue?: string;
  minValue?: string;
  maxValue?: string;
  isDisabled?: boolean;
}
```

Replace the component body with:

```tsx
export const DateField: React.FC<IDateFieldProps> = function DateField(props) {
  const { id, label, value, onChange, defaultValue, minValue, maxValue, isDisabled } = props;

  const [isOpen, setIsOpen] = useState(false);
  // The design's OK/Cancel footer means a day click is pending, not committed. This holds the
  // pending day; `value` stays authoritative until OK.
  const [pending, setPending] = useState<CalendarDate | null>(null);

  const handleOpenChange = (open: boolean) => {
    // Reseed from the committed value every time the popover opens, so a cancelled edit does not
    // linger into the next one.
    if (open) setPending(fromDateString(value) ?? null);
    setIsOpen(open);
  };

  const commit = () => {
    if (pending) onChange(toDateString(pending));
    setIsOpen(false);
  };

  const cancel = () => setIsOpen(false);

  const clear = () => setPending(fromDateString(defaultValue ?? value) ?? null);

  return (
    <DatePicker
      className="wave-runner-date-field"
      value={pending ?? fromDateString(value) ?? null}
      onChange={setPending}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      minValue={minValue ? fromDateString(minValue) : undefined}
      maxValue={maxValue ? fromDateString(maxValue) : undefined}
      isDisabled={isDisabled}
      granularity="day"
    >
      <Label className="field-label" htmlFor={id}>{label}</Label>
      <Group className="field-group">
        <DateInput className="date-input" id={id}>
          {segment => <DateSegment segment={segment} />}
        </DateInput>
        {/* Display only. The model stores a date, so there is no time to set; rendering this as
            text rather than an editable segment is what keeps it unsettable. */}
        <span className="static-time">, 12:00 AM</span>
        <Button className="calendar-trigger" aria-label="Choose date">
          <span aria-hidden="true" className="calendar-glyph" />
        </Button>
      </Group>
      <Popover className="date-field-popover">
        <Dialog className="date-field-dialog">
          <Calendar className="date-field-calendar">
            <header className="calendar-header">
              <Button slot="previous" className="nav-button" aria-label="Previous month">‹</Button>
              <Heading className="calendar-heading" />
              <Button slot="next" className="nav-button" aria-label="Next month">›</Button>
            </header>
            <CalendarGrid className="calendar-grid" weekdayStyle="short">
              {date => <CalendarCell date={date} className="calendar-cell" />}
            </CalendarGrid>
          </Calendar>
          <footer className="date-field-footer">
            <button type="button" className="footer-button clear" onClick={clear}>Clear</button>
            <button type="button" className="footer-button cancel" onClick={cancel}>Cancel</button>
            <button type="button" className="footer-button ok" onClick={commit}>OK</button>
          </footer>
        </Dialog>
      </Popover>
    </DatePicker>
  );
};
```

Change the React import to `import React, { useState } from "react";`.

- [ ] **Step 4: Run and watch it pass**

Run: `npx jest src/plugins/wave-runner/components/date-field --silent`
Expected: PASS, 9 tests.

- [ ] **Step 5: Mutation-check the buffering**

Temporarily change `onChange={setPending}` to `onChange={d => d && onChange(toDateString(d))}`, which is the un-buffered behavior.

Run: `npx jest src/plugins/wave-runner/components/date-field --silent -t "buffering"`
Expected: FAIL on "does not commit a day until OK is pressed". Restore the line afterwards.

This proves the tests pin buffering rather than passing regardless.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/wave-runner/components/date-field.tsx src/plugins/wave-runner/components/date-field.test.tsx
git commit -m "CLUE-669: buffer the picker selection behind Clear, Cancel and OK"
```

---

## Task 7: Make an out-of-order range unselectable

**Files:**
- Test: `src/plugins/wave-runner/components/date-field.test.tsx`

`minValue` and `maxValue` are already wired in Task 5. This task proves they work, because the acceptance criterion depends on it.

- [ ] **Step 1: Write the failing test**

Add to `src/plugins/wave-runner/components/date-field.test.tsx`:

```tsx
describe("DateField range limits", () => {
  it("disables days before minValue", () => {
    renderField({ id: "end", label: "End Date and Time", value: "2026-09-20", minValue: "2026-09-15" });
    fireEvent.click(screen.getByRole("button", { name: "Choose date" }));
    expect(screen.getByRole("button", { name: /10/ })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: /20/ })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("disables days after maxValue", () => {
    renderField({ value: "2026-09-01", maxValue: "2026-09-10" });
    fireEvent.click(screen.getByRole("button", { name: "Choose date" }));
    expect(screen.getByRole("button", { name: /20/ })).toHaveAttribute("aria-disabled", "true");
  });
});
```

- [ ] **Step 2: Run and confirm**

Run: `npx jest src/plugins/wave-runner/components/date-field --silent -t "range limits"`
Expected: PASS. If a disabled cell exposes a different attribute in the installed version, read the rendered markup with `screen.debug()` and assert on what React Aria actually emits.

- [ ] **Step 3: Mutation-check**

Temporarily remove the `minValue` prop from the `<DatePicker>` element.
Run the same command. Expected: FAIL on "disables days before minValue". Restore it.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/wave-runner/components/date-field.test.tsx
git commit -m "CLUE-669: pin that minValue and maxValue make out-of-order dates unselectable"
```

---

## Task 8: Month and year dropdown in the calendar header

The design's header is a dropdown reading "September 2026", not static text. React Aria's `Heading` renders text, so this replaces it.

**Files:**
- Modify: `src/plugins/wave-runner/components/date-field.tsx`
- Test: `src/plugins/wave-runner/components/date-field.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/plugins/wave-runner/components/date-field.test.tsx`:

```tsx
describe("DateField month navigation", () => {
  it("offers a month-and-year dropdown showing the focused month", () => {
    renderField();
    fireEvent.click(screen.getByRole("button", { name: "Choose date" }));
    const monthSelect = screen.getByRole("combobox", { name: "Month and year" });
    expect(monthSelect).toHaveValue("2026-09");
  });

  it("moves the calendar when a different month is chosen", () => {
    renderField();
    fireEvent.click(screen.getByRole("button", { name: "Choose date" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Month and year" }), {
      target: { value: "2026-11" }
    });
    expect(screen.getByRole("combobox", { name: "Month and year" })).toHaveValue("2026-11");
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx jest src/plugins/wave-runner/components/date-field --silent -t "month navigation"`
Expected: FAIL — no combobox found.

- [ ] **Step 3: Implement the dropdown**

In `date-field.tsx`, add to the imports:

```tsx
import { CalendarDate, parseDate } from "@internationalized/date";
```

Add above the component:

```tsx
const kMonthNames = ["January", "February", "March", "April", "May", "June",
                     "July", "August", "September", "October", "November", "December"];

/**
 * Twelve months either side of the focused month. A fixed window keeps the list short; the prev
 * and next buttons still reach anything outside it.
 */
function monthOptions(focused: CalendarDate) {
  const options: { value: string; label: string }[] = [];
  for (let offset = -12; offset <= 12; offset++) {
    const date = focused.add({ months: offset });
    const month = String(date.month).padStart(2, "0");
    options.push({
      value: `${date.year}-${month}`,
      label: `${kMonthNames[date.month - 1]} ${date.year}`
    });
  }
  return options;
}
```

Inside the component, add focused-month state below the `pending` state:

```tsx
  const [focused, setFocused] = useState<CalendarDate>(
    () => fromDateString(value) ?? new CalendarDate(2026, 9, 1)
  );
```

Add to `handleOpenChange`, inside the `if (open)` branch:

```tsx
    if (open) {
      const seed = fromDateString(value) ?? null;
      setPending(seed);
      if (seed) setFocused(seed);
    }
```

Replace `<Calendar className="date-field-calendar">` with:

```tsx
          <Calendar
            className="date-field-calendar"
            focusedValue={focused}
            onFocusChange={setFocused}
          >
```

Replace the `<Heading className="calendar-heading" />` line with:

```tsx
              <select
                className="calendar-heading"
                aria-label="Month and year"
                value={`${focused.year}-${String(focused.month).padStart(2, "0")}`}
                onChange={e => setFocused(parseDate(`${e.target.value}-01`))}
              >
                {monthOptions(focused).map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
```

- [ ] **Step 4: Run and watch it pass**

Run: `npx jest src/plugins/wave-runner/components/date-field --silent`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/wave-runner/components/date-field.tsx src/plugins/wave-runner/components/date-field.test.tsx
git commit -m "CLUE-669: replace the calendar heading with a month and year dropdown"
```

---

## Task 9: Use DateField in Data Setup

**Files:**
- Modify: `src/plugins/wave-runner/components/data-setup.tsx:128-151`
- Create: `src/plugins/wave-runner/components/data-setup.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/plugins/wave-runner/components/data-setup.test.tsx`:

```tsx
jest.mock("uplot", () => jest.fn().mockImplementation(() => ({
  setData: jest.fn(), setSize: jest.fn(), destroy: jest.fn()
})));

import React from "react";
import { render, screen } from "@testing-library/react";
import { Provider } from "mobx-react";

import { specStores } from "../../../models/stores/spec-stores";
import { specAppConfig } from "../../../models/stores/spec-app-config";
import { TileModel } from "../../../models/tiles/tile-model";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { defaultWaveRunnerContent, WaveRunnerContentModelType } from "../models/wave-runner-content";
import { DataSetup } from "./data-setup";

import "../wave-runner-registration";

const stores = specStores({
  appConfig: specAppConfig({
    config: {
      settings: {
        "wave-runner": {
          stations: [
            { network: "AK", station: "K204", channel: "HNZ", label: "Anchorage Airport" },
            { network: "AK", station: "DDM", location: "01", channel: "HNZ", label: "Dexter Display Mine" }
          ],
          defaultStation: 0,
          models: [
            { label: "Compact Model", metadataUrl: "https://models.example.com/v1/compact-v2/metadata.json" }
          ],
          defaultModel: 0
        }
      }
    }
  })
});

// useWaveRunnerContent reads TileModelContext and throws unless the model's content is
// WaveRunner content, so the tile model is the provider here - there is no content context.
function renderSetup(content: WaveRunnerContentModelType = defaultWaveRunnerContent()) {
  const model = TileModel.create({ content });
  const utils = render(
    <Provider stores={stores}>
      <TileModelContext.Provider value={model}>
        <DataSetup />
      </TileModelContext.Provider>
    </Provider>
  );
  return { content, container: utils.container };
}

describe("DataSetup date fields", () => {
  it("shows the stored dates", () => {
    renderSetup();
    expect(screen.getByText("Start Date and Time")).toBeInTheDocument();
    expect(screen.getByText("End Date and Time")).toBeInTheDocument();
  });

  // This is the acceptance criterion: an out-of-order range must not be selectable, which is done
  // by handing each picker the other's date as its limit.
  it("bounds each picker by the other date", () => {
    const { content } = renderSetup();
    expect(content.startDate).toBe("2026-09-01");
    expect(content.endDate).toBe("2026-10-01");
    const triggers = screen.getAllByRole("button", { name: "Choose date" });
    expect(triggers).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx jest src/plugins/wave-runner/components/data-setup --silent`
Expected: FAIL — no "Choose date" buttons, because the native inputs are still in place.

- [ ] **Step 3: Replace the native date inputs**

In `src/plugins/wave-runner/components/data-setup.tsx`, add to the imports:

```tsx
import { DateField } from "./date-field";
```

Replace the entire second `<div className="field-row">` block with:

```tsx
      <div className="field-row">
        <div className="field">
          <DateField
            id="wave-runner-start-date"
            label="Start Date and Time"
            value={content.startDate}
            defaultValue="2026-09-01"
            maxValue={content.endDate}
            onChange={date => content.setStartDate(date)}
            isDisabled={content.isRunning || content.isLoadingData}
          />
        </div>
        <div className="field">
          <DateField
            id="wave-runner-end-date"
            label="End Date and Time"
            value={content.endDate}
            defaultValue="2026-10-01"
            minValue={content.startDate}
            onChange={date => content.setEndDate(date)}
            isDisabled={content.isRunning || content.isLoadingData}
          />
        </div>
      </div>
```

- [ ] **Step 4: Run and watch it pass**

Run: `npx jest src/plugins/wave-runner/components/data-setup --silent`
Expected: PASS.

- [ ] **Step 5: Run the whole WaveRunner suite**

Run: `npx jest src/plugins/wave-runner --silent`
Expected: no failures. If `wave-runner-tile.test.tsx` asserted on the old `datetime-local` inputs, update those assertions.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/wave-runner/components/data-setup.tsx src/plugins/wave-runner/components/data-setup.test.tsx
git commit -m "CLUE-669: use DateField for the start and end dates"
```

---

## Task 10: Move the dropdowns to CustomSelect

**Files:**
- Modify: `src/plugins/wave-runner/components/data-setup.tsx:88-127`
- Test: `src/plugins/wave-runner/components/data-setup.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/plugins/wave-runner/components/data-setup.test.tsx`:

```tsx
Add `fireEvent` to the existing `@testing-library/react` import at the top of the file.

```tsx
describe("DataSetup dropdowns", () => {
  it("lists the configured stations", () => {
    renderSetup();
    expect(screen.getByText("Anchorage Airport")).toBeInTheDocument();
  });

  it("sets the station when one is chosen", () => {
    const { content } = renderSetup();
    fireEvent.click(screen.getByText("Dexter Display Mine"));
    expect(content.station?.station).toBe("DDM");
  });

  it("lists the configured models", () => {
    renderSetup();
    expect(screen.getByText("Compact Model")).toBeInTheDocument();
  });

  it("renders no native select for station or model", () => {
    const { container } = renderSetup();
    // The month-and-year dropdown inside each picker is a native select and is expected; the
    // station and model dropdowns must not be.
    expect(container.querySelectorAll("select.dropdown")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx jest src/plugins/wave-runner/components/data-setup --silent -t "dropdowns"`
Expected: FAIL on the native-select assertion.

- [ ] **Step 3: Replace the selects**

In `src/plugins/wave-runner/components/data-setup.tsx`, add to the imports:

```tsx
import { CustomSelect, ICustomDropdownItem } from "../../../clue/components/custom-select";
```

Replace `handleStationChange` and `handleModelChange` with item builders:

```tsx
  const stationItems: ICustomDropdownItem[] = dropdownOptions.map(opt => ({
    id: opt.id,
    text: opt.config.label,
    selected: opt.id === currentStationId,
    onClick: () => {
      const { network, station, channel, label } = opt.config;
      const location = opt.config.location ?? "";
      content.setStation({ network, station, location, channel, label });
    }
  }));

  const modelItems: ICustomDropdownItem[] = (modelConfigs ?? []).map(model => ({
    id: model.metadataUrl,
    text: model.label,
    selected: model.metadataUrl === content.selectedModelUrl,
    onClick: () => content.ensureModelMetadata(model.metadataUrl)
  }));
```

Replace the first `<div className="field-row">` block with:

```tsx
      <div className="field-row">
        <div className="field">
          <label className="field-label">Station</label>
          <CustomSelect
            className="wave-runner-dropdown"
            dataTestId="wave-runner-station"
            items={stationItems}
            title={hasStations ? "Choose a station" : "No stations configured"}
            isDisabled={!hasStations || content.isRunning || content.isLoadingData}
          />
        </div>
        <div className="field">
          <label className="field-label">Model</label>
          <CustomSelect
            className="wave-runner-dropdown"
            dataTestId="wave-runner-model"
            items={modelItems}
            title="Choose a model"
            isDisabled={content.isRunning}
          />
        </div>
      </div>
```

- [ ] **Step 4: Run and watch it pass**

Run: `npx jest src/plugins/wave-runner/components/data-setup --silent`
Expected: PASS.

- [ ] **Step 5: Run the whole suite and lint**

Run: `npx jest --silent && npx tsc --noEmit -p . && npm run lint:build`
Expected: no test failures, no type errors, zero lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/wave-runner/components/data-setup.tsx src/plugins/wave-runner/components/data-setup.test.tsx
git commit -m "CLUE-669: move the station and model dropdowns to CustomSelect"
```

---

## Task 11: Styling

Colors come from `src/components/vars.scss`. Do not introduce a hex value.

**Files:**
- Modify: `src/plugins/wave-runner/components/date-field.scss`
- Modify: `src/plugins/wave-runner/components/data-setup.scss`

- [ ] **Step 1: Style the picker**

Replace `src/plugins/wave-runner/components/date-field.scss` with:

```scss
@import "../../../components/vars";
@import "../../../components/mixins";

.wave-runner-date-field {
  display: flex;
  flex-direction: column;

  .field-label {
    margin-left: 8px;
    margin-bottom: 5px;
  }

  .field-group {
    display: flex;
    flex-direction: row;
    align-items: center;
    height: 40px;
    box-sizing: border-box;
    border-radius: 5px;
    border: solid 1.5px $charcoal-light-1;
    background-color: white;
    font-size: 13px;
    color: $charcoal-dark-2;
    padding: 0 8px;
    cursor: pointer;

    &:hover {
      background-color: $workspace-teal-light-5;
    }

    &[data-focus-within] {
      background-color: $workspace-teal-light-5;
      border-color: $workspace-teal;
    }

    @include focus-ring;
  }

  .static-time {
    color: $charcoal-dark-2;
  }

  .calendar-trigger {
    margin-left: auto;
    border: none;
    background: none;
    cursor: pointer;

    .calendar-glyph {
      display: block;
      width: 20px;
      height: 20px;
      fill: $workspace-teal-dark-1;
    }
  }

  &[data-disabled] .field-group {
    opacity: 0.35;
    pointer-events: none;
  }
}

.date-field-popover {
  background-color: white;
  border-radius: 5px;
  box-shadow: 0 0 5px 0 rgba(0, 0, 0, 0.5);
  z-index: 11;

  .date-field-dialog {
    padding: 12px;
    outline: none;
  }

  .calendar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    gap: 8px;
  }

  .nav-button,
  .calendar-heading {
    height: 32px;
    border-radius: 5px;
    border: solid 1.5px $workspace-teal;
    background-color: white;
    color: $charcoal-dark-2;
    font-size: 13px;
    cursor: pointer;

    &:hover {
      background-color: $workspace-teal-light-5;
    }

    @include focus-ring;
  }

  .nav-button {
    width: 32px;
  }

  .calendar-heading {
    flex-grow: 1;
    padding: 0 8px;
  }

  .calendar-grid {
    border-collapse: collapse;

    th {
      font-size: 13px;
      color: $charcoal-dark-2;
      font-weight: normal;
      padding: 4px;
    }
  }

  .calendar-cell {
    width: 32px;
    height: 32px;
    text-align: center;
    vertical-align: middle;
    border-radius: 5px;
    font-size: 13px;
    color: $charcoal-dark-2;
    cursor: pointer;

    &[data-outside-month] {
      color: $charcoal-light-1;
    }

    &[data-today] {
      border: solid 1.5px $workspace-teal;
    }

    &[data-selected] {
      background-color: $workspace-teal-dark-1;
      color: white;
    }

    &[data-disabled] {
      color: $charcoal-light-2;
      cursor: default;
    }

    &:hover:not([data-disabled]):not([data-selected]) {
      background-color: $workspace-teal-light-3;
    }

    @include focus-ring;
  }

  .date-field-footer {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-top: 12px;
  }

  .footer-button {
    height: 32px;
    min-width: 72px;
    border-radius: 5px;
    border: solid 1.5px $charcoal-light-1;
    background-color: white;
    font-size: 13px;
    color: $charcoal-dark-2;
    cursor: pointer;

    &:hover {
      background-color: $workspace-teal-light-5;
    }

    &.ok {
      background-color: $workspace-teal-light-4;
      border-color: $workspace-teal;
    }

    @include focus-ring;
  }
}
```

- [ ] **Step 2: Confirm the icon takes the fill**

Run: `grep -n "fill=" src/plugins/wave-runner/assets/calendar-icon.svg`

If the SVG hard-codes a `fill` on its paths, the SCSS `fill` will not win. Remove the hard-coded
attribute from the copied file so the colour comes from the stylesheet token.

- [ ] **Step 3: Scope the dropdown styling**

Add to `src/plugins/wave-runner/components/data-setup.scss`, inside the `.wave-runner-tile` block, replacing the `.dropdown, .datetime` rule:

```scss
  .wave-runner-dropdown {
    width: 100%;

    .header {
      min-width: 0;
      max-width: none;
      width: 100%;
    }

    .list {
      width: 100%;
    }
  }
```

`CustomSelect` ships a `min-width: 300px` and `max-width: 400px` header, which does not fit this tile's two-column row. Overriding it here keeps the shared component untouched, as the spec requires.

- [ ] **Step 4: Verify the build and lint**

Run: `npx tsc --noEmit -p . && npm run lint:build && npx jest src/plugins/wave-runner --silent`
Expected: clean.

- [ ] **Step 5: Check it by hand**

```bash
npm start
```

Open `http://localhost:8080`, add a WaveRunner tile and compare against the design image for: field resting, hover and open states; the popover surface; today outlined; adjacent-month days greyed; a selected day filled; the footer buttons; both dropdowns' resting, hover, open and disabled states.

**This step cannot be skipped.** jsdom renders no layout and no color, so nothing above this point has verified appearance.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/wave-runner/components/date-field.scss src/plugins/wave-runner/components/data-setup.scss
git commit -m "CLUE-669: style the date pickers and dropdowns from CLUE's tokens"
```

---

## Task 12: Final verification

- [ ] **Step 1: Full suite, types and lint**

```bash
npx jest --silent
npx tsc --noEmit -p .
npm run lint:build
```

Expected: no test failures, no type errors, zero lint errors.

- [ ] **Step 2: Confirm no stray hex values**

Run: `grep -nE "#[0-9a-fA-F]{3,6}" src/plugins/wave-runner/components/date-field.scss src/plugins/wave-runner/components/data-setup.scss`
Expected: no output other than `rgba(0, 0, 0, 0.5)` in the popover shadow, which matches `custom-select.scss`.

- [ ] **Step 3: Confirm the native controls are gone**

Run: `grep -n "datetime-local\|select className=\"dropdown\"" src/plugins/wave-runner/components/data-setup.tsx`
Expected: no output.

- [ ] **Step 4: Re-measure the bundle**

```bash
npm run build && du -sk dist
```

Compare against `/tmp/clue-669-dist-before.txt` from Task 3 and record the final delta in the PR description.

- [ ] **Step 5: Self-review the branch**

Run the `code-self-review` skill over `git diff origin/master...HEAD` and apply its MUST items.

- [ ] **Step 6: Report before pushing**

Do not push or open a PR without explicit approval. Report: the bundle delta, anything in the design that was approximated rather than measured, and the hand-check results from Task 11.
