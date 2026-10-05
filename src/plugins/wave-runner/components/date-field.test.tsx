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
