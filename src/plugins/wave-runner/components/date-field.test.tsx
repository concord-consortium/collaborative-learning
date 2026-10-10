import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DateField, IDateFieldProps } from "./date-field";

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

// The field's own tab order never leaves its Group (the calendar-trigger button and the three
// segments are the only tabbable things in these isolated renders, so Tab just cycles among them),
// so leaving the field - the thing that actually fires its commit-on-blur - has to be simulated
// directly. This is what a real page gives for free: tabbing out of the last segment lands on
// whatever the page renders next (the other date field, a dropdown, and so on).
async function blurAway() {
  await act(async () => {
    (document.activeElement as HTMLElement | null)?.blur();
    // Lets the commit's queued microtask (see date-field.tsx's handleGroupBlur) run before this
    // resolves, so the assertion right after sees its result.
    await Promise.resolve();
  });
}

// React Aria composes the trigger's accessible name as "Choose date <field label>" so that two
// pickers side by side are distinguishable. Match on the stable part.
function openCalendar() {
  fireEvent.click(screen.getByRole("button", { name: /Choose date/ }));
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
    expect(time.tagName).toBe("SPAN");
    expect(time).not.toHaveAttribute("contenteditable");
  });

  // Unpadded month and day change the field's width as the date changes, which jitters the row.
  it("pads month and day to two digits", () => {
    renderField({ value: "2026-09-01" });
    expect(screen.getByRole("group", { name: "Start Date and Time" }))
      .toHaveTextContent("09/01/2026");
  });

  // The segments are typed into, so a press on them must not open the calendar and steal focus.
  it("types into a date segment rather than opening the calendar", async () => {
    const user = userEvent.setup();
    const onChange = renderField({ value: "2026-09-01" });
    const month = screen.getAllByRole("spinbutton")[0];

    await user.click(month);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Typing does not commit by itself - see "DateField typed commit (controlled)" below for why
    // this matters and cannot be seen with a fixed `value`.
    await user.keyboard("11");
    expect(onChange).not.toHaveBeenCalled();

    await blurAway();
    expect(onChange).toHaveBeenCalledWith("2026-11-01");
  });

  // Typing one segment must not reset the others to their placeholders.
  it("keeps the untouched segments while one is being typed", async () => {
    const user = userEvent.setup();
    renderField({ value: "2026-09-15", maxValue: "2026-12-31" });
    const [month, day, year] = screen.getAllByRole("spinbutton");

    await user.click(year);
    await user.keyboard("2024");

    expect(month).toHaveTextContent("09");
    expect(day).toHaveTextContent("15");
    expect(year).toHaveTextContent("2024");
  });

  it("opens the calendar popover from the trigger", () => {
    renderField();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    openCalendar();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows standard three-letter weekday abbreviations", () => {
    renderField();
    openCalendar();
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(day => {
      expect(screen.getByText(day)).toBeInTheDocument();
    });
  });

  // There is genuinely no time column to render - granularity="day" means the popover is only
  // ever a day grid - so the real assertion is the absence of any time-editing control there,
  // not a made-up test id this component has never produced.
  it("renders no time-editing controls in the popover, only the day grid and footer", () => {
    renderField();
    openCalendar();
    expect(within(screen.getByRole("dialog")).queryAllByRole("spinbutton")).toHaveLength(0);
  });

  // Two pickers sit side by side in Data Setup. A screen-reader user must be able to tell which
  // field a calendar trigger belongs to, so the field's label is part of the trigger's name.
  it("names the trigger after the field it belongs to", () => {
    renderField({ label: "End Date and Time" });
    expect(screen.getByRole("button", { name: "Choose date End Date and Time" })).toBeInTheDocument();
  });
});

describe("DateField buffering", () => {
  it("does not commit a day until OK is pressed", () => {
    const onChange = renderField();
    openCalendar();
    fireEvent.click(screen.getByRole("button", { name: /September 15, 2026/ }));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onChange).toHaveBeenCalledWith("2026-09-15");
  });

  it("discards the pending day on Cancel and closes", () => {
    const onChange = renderField();
    openCalendar();
    fireEvent.click(screen.getByRole("button", { name: /September 15, 2026/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // The model always holds a date, so Clear resets to the field's default rather than emptying it.
  // Starting from a value that differs from the default is what makes this test able to fail.
  it("resets to defaultValue on Clear rather than to the current value", () => {
    const onChange = renderField({ value: "2026-09-20", defaultValue: "2026-09-01" });
    openCalendar();
    fireEvent.click(screen.getByRole("button", { name: /September 15, 2026/ }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.click(screen.getByRole("button", { name: "OK" }));

    expect(onChange).toHaveBeenCalledWith("2026-09-01");
  });

  // See clear()'s own comment in date-field.tsx for why defaultValue can land outside the field's
  // live bounds and must be clamped. (clampDate's own comment, in date-utils.ts, covers what
  // happens when the two bounds themselves disagree - see date-utils.test.ts for that case.)
  it("clamps Clear to minValue when the default falls before it", () => {
    const onChange = renderField({
      id: "end", label: "End Date and Time", value: "2026-10-06",
      defaultValue: "2026-10-01", minValue: "2026-10-05"
    });
    openCalendar();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.click(screen.getByRole("button", { name: "OK" }));

    expect(onChange).toHaveBeenCalledWith("2026-10-05");
  });

  // Symmetric case on the other bound, so a defaultValue past maxValue cannot be staged either.
  it("clamps Clear to maxValue when the default falls after it", () => {
    const onChange = renderField({
      value: "2026-09-10", defaultValue: "2026-09-20", maxValue: "2026-09-15"
    });
    openCalendar();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.click(screen.getByRole("button", { name: "OK" }));

    expect(onChange).toHaveBeenCalledWith("2026-09-15");
  });

  // A cancelled edit must not linger into the next opening.
  it("reseeds the pending day from value each time it opens", () => {
    const onChange = renderField();
    openCalendar();
    fireEvent.click(screen.getByRole("button", { name: /September 15, 2026/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    openCalendar();
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onChange).toHaveBeenCalledWith("2026-09-01");
  });
});

// The acceptance criterion is prevention, not an error after the fact: an out-of-order range must
// not be selectable in the calendar at all.
describe("DateField range limits", () => {
  it("disables days before minValue", () => {
    renderField({ id: "end", label: "End Date and Time", value: "2026-09-20", minValue: "2026-09-15" });
    openCalendar();
    expect(screen.getByRole("button", { name: /September 10, 2026/ }))
      .toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: /September 20, 2026/ }))
      .not.toHaveAttribute("aria-disabled", "true");
  });

  it("disables days after maxValue", () => {
    renderField({ value: "2026-09-01", maxValue: "2026-09-10" });
    openCalendar();
    expect(screen.getByRole("button", { name: /September 20, 2026/ }))
      .toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: /September 1, 2026/ }))
      .not.toHaveAttribute("aria-disabled", "true");
  });
});

describe("DateField month navigation", () => {
  // CustomSelect is not a native select: its trigger is a role="button" div whose text content
  // is the focused month, since a static `title` would permanently mask it (see date-field.tsx).
  it("offers a month dropdown showing the focused month", () => {
    renderField();
    openCalendar();
    expect(screen.getByRole("button", { name: "September 2026" })).toBeInTheDocument();
  });

  // There is no data for a month that has not happened, so it is not offered at all.
  it("offers no month beyond the last selectable date", async () => {
    const user = userEvent.setup();
    renderField({ value: "2026-09-01", maxValue: "2026-10-06" });
    openCalendar();
    await user.click(screen.getByRole("button", { name: "September 2026" }));

    expect(screen.getByRole("option", { name: "October 2026" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "November 2026" })).not.toBeInTheDocument();
  });

  // Symmetric case on the other bound: the end field's minValue tracks the start field (see
  // data-setup.tsx), so without this a student could pick a month entirely before the start date,
  // which the calendar would then refuse to let them select a day in.
  it("offers no month before the first selectable date", async () => {
    const user = userEvent.setup();
    renderField({ id: "end", label: "End Date and Time", value: "2026-09-20", minValue: "2026-08-06" });
    openCalendar();
    await user.click(screen.getByRole("button", { name: "September 2026" }));

    expect(screen.getByRole("option", { name: "August 2026" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "July 2026" })).not.toBeInTheDocument();
  });

  // A real click sequence (not a bare change event) is what would expose CustomSelect's own
  // outside-click handling fighting with React Aria's popover dismissal, since both watch pointer
  // events rather than "change".
  it("moves the calendar to the chosen month", async () => {
    const user = userEvent.setup();
    renderField();
    openCalendar();
    await user.click(screen.getByRole("button", { name: "September 2026" }));
    await user.click(screen.getByRole("option", { name: "November 2026" }));

    expect(screen.getByRole("button", { name: "November 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /November 15, 2026/ })).toBeInTheDocument();
  });

  // Changing the month must not disturb the popover's open/close state machine, which the
  // Clear/Cancel/OK footer depends on - this is the proof that the two dropdowns do not fight.
  // A day is picked before the month changes so there is a pending selection for the test to
  // lose: without that, the dialog staying open proves nothing about the pick surviving.
  it("keeps the popover open and the pending selection intact when the month changes", async () => {
    const user = userEvent.setup();
    const onChange = renderField();
    openCalendar();
    fireEvent.click(screen.getByRole("button", { name: /September 15, 2026/ }));

    await user.click(screen.getByRole("button", { name: "September 2026" }));
    await user.click(screen.getByRole("option", { name: "November 2026" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    // Proof the pick survived the month change, not just that the dialog is still open: OK
    // commits the day chosen before navigating, even though November is now showing.
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onChange).toHaveBeenCalledWith("2026-09-15");
  });
});

// Every test above passes a FIXED `value` prop: `onChange` is a bare jest.fn() and the component
// never re-renders with its own committed output. That is exactly backwards from how DataSetup
// uses this component - `onChange={date => content.setStartDate(date)}` writes into the model, and
// the next render reads `value={content.startDate}` back out of it - and it hides any bug that only
// shows up once a commit round-trips back into `value`. A per-keystroke commit of a malformed
// intermediate date, for instance, cannot be observed against a fixed value: there is nothing for
// the bad commit to feed back into, so the segments never go on to blank themselves out. This
// wrapper closes that gap by feeding `onChange` back into `value`, exactly as the model does.
function ControlledDateField(
  props: Omit<IDateFieldProps, "value" | "onChange"> & { initialValue: string; onCommit: jest.Mock }
) {
  const { initialValue, onCommit, ...rest } = props;
  const [value, setValue] = React.useState(initialValue);
  return (
    <DateField
      {...rest}
      value={value}
      onChange={next => {
        setValue(next);
        onCommit(next);
      }}
    />
  );
}

function renderControlled(
  overrides: Partial<Omit<IDateFieldProps, "value" | "onChange">> & { initialValue?: string } = {}
) {
  const onCommit = jest.fn();
  const { initialValue = "2026-09-15", ...rest } = overrides;
  render(
    <ControlledDateField
      id="start"
      label="Start Date and Time"
      initialValue={initialValue}
      onCommit={onCommit}
      {...rest}
    />
  );
  return onCommit;
}

describe("DateField typed commit (controlled)", () => {
  // Reproduces the reported bug exactly: with a controlled value, a per-keystroke commit of year
  // "2" produced the unparsable string "2-09-15" (toDateString did not pad the year), which nulled
  // draft and blanked month/day back to their placeholders on the very next render.
  it("commits a typed year once, on blur, leaving month and day untouched", async () => {
    const user = userEvent.setup();
    const onCommit = renderControlled();
    const [month, day, year] = screen.getAllByRole("spinbutton");

    await user.click(year);
    await user.keyboard("2024");
    expect(onCommit).not.toHaveBeenCalled();
    expect(month).toHaveTextContent("09");
    expect(day).toHaveTextContent("15");

    await blurAway();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("2024-09-15");
  });

  // minValue/maxValue are validation-only for react-aria; it never refuses the onChange itself.
  // Without this check in commitTyped, this typed edit would reach the model silently - no field
  // styling, no status message - even though the same date is unselectable in the calendar.
  it("does not commit a typed month beyond maxValue, and reverts the field", async () => {
    const user = userEvent.setup();
    const onCommit = renderControlled({ maxValue: "2026-10-08" });
    const [month] = screen.getAllByRole("spinbutton");

    await user.click(month);
    await user.keyboard("12");
    await blurAway();

    expect(onCommit).not.toHaveBeenCalled();
    expect(month).toHaveTextContent("09");
  });

  // Reproduces finding 3: backspacing a segment empty and tabbing away previously left the field
  // showing the cleared segment while the model still held its old value. draft must be restored
  // from value on blur rather than left null.
  it("reverts a cleared segment to match the model on blur instead of leaving them disagree", async () => {
    const user = userEvent.setup();
    const onCommit = renderControlled();
    const [, day] = screen.getAllByRole("spinbutton");

    await user.click(day);
    await user.keyboard("{Backspace}{Backspace}");
    await blurAway();

    expect(onCommit).not.toHaveBeenCalled();
    expect(day).toHaveTextContent("15");
  });
});
