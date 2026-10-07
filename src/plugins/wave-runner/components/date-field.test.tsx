import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

    await user.keyboard("11");
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

  it("does not render a time column in the popover", () => {
    renderField();
    openCalendar();
    expect(screen.queryByTestId("date-field-time-column")).not.toBeInTheDocument();
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

  // A real click sequence (not a bare change event) is what would expose CustomSelect's own
  // outside-click handling fighting with React Aria's popover dismissal, since both watch pointer
  // events rather than "change".
  // There is no data for a month that has not happened, so it is not offered at all.
  it("offers no month beyond the last selectable date", async () => {
    const user = userEvent.setup();
    renderField({ value: "2026-09-01", maxValue: "2026-10-06" });
    openCalendar();
    await user.click(screen.getByRole("button", { name: "September 2026" }));

    expect(screen.getByRole("option", { name: "October 2026" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "November 2026" })).not.toBeInTheDocument();
  });

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
  it("keeps the popover open and the pending selection intact when the month changes", async () => {
    const user = userEvent.setup();
    const onChange = renderField();
    openCalendar();
    await user.click(screen.getByRole("button", { name: "September 2026" }));
    await user.click(screen.getByRole("option", { name: "November 2026" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
