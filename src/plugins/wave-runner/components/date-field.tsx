import { CalendarDate, parseDate } from "@internationalized/date";
import React, { useEffect, useState } from "react";
import {
  Button, Calendar, CalendarCell, CalendarGrid, DateInput, DatePicker,
  DateSegment, Dialog, Group, Label, Popover
} from "react-aria-components";

import CalendarIcon from "../assets/calendar-icon.svg";
import { CustomSelect, ICustomDropdownItem } from "../../../clue/components/custom-select";
import { fromDateString, toDateString } from "./date-utils";

import "./date-field.scss";

// Month and day render unpadded, so the field's width shifts as the date changes. Padding them
// holds it steady and matches the mm/dd placeholder.
function paddedSegmentText(segment: { type: string; text: string }) {
  return segment.type === "month" || segment.type === "day"
    ? segment.text.padStart(2, "0")
    : segment.text;
}

const kMonthNames = ["January", "February", "March", "April", "May", "June",
                     "July", "August", "September", "October", "November", "December"];

/**
 * Twelve months either side of the focused month. A fixed window keeps the list short; the prev
 * and next buttons still reach anything outside it.
 */
function monthOptions(focused: CalendarDate, latest?: CalendarDate) {
  const options: { value: string; label: string }[] = [];
  for (let offset = -12; offset <= 12; offset++) {
    const date = focused.add({ months: offset });
    // A month entirely past the last selectable date holds nothing that can be chosen, so it is
    // left out rather than offered and then refused.
    if (latest && (date.year > latest.year
        || (date.year === latest.year && date.month > latest.month))) break;
    const month = String(date.month).padStart(2, "0");
    options.push({
      value: `${date.year}-${month}`,
      label: `${kMonthNames[date.month - 1]} ${date.year}`
    });
  }
  return options;
}

// No static `title` is passed to CustomSelect: it would permanently mask the focused month per
// `titleText = title || selectedItem?.text`. The trigger's visible label is the focused month
// itself, which also doubles as its accessible name - the same pattern the Station and Model
// fields already rely on in this tile, since CustomSelect has no separate aria-label prop.
function monthDropdownItems(
  focused: CalendarDate, setFocused: (date: CalendarDate) => void, latest?: CalendarDate
): ICustomDropdownItem[] {
  const focusedValue = `${focused.year}-${String(focused.month).padStart(2, "0")}`;
  return monthOptions(focused, latest).map(option => ({
    id: option.value,
    text: option.label,
    selected: option.value === focusedValue,
    onClick: () => setFocused(parseDate(`${option.value}-01`))
  }));
}

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

export const DateField: React.FC<IDateFieldProps> = function DateField(props) {
  const { id, label, value, onChange, defaultValue, minValue, maxValue, isDisabled } = props;

  const [isOpen, setIsOpen] = useState(false);
  // The design's OK/Cancel footer means a day click is pending, not committed. `value` stays
  // authoritative until OK.
  const [pending, setPending] = useState<CalendarDate | null>(null);
  const [focused, setFocused] = useState<CalendarDate>(
    () => fromDateString(value) ?? new CalendarDate(2026, 9, 1)
  );
  // What the field is showing while it is being typed into. Handing the picker only the committed
  // date meant a half-typed entry had nowhere to live, so the segments the student had not touched
  // fell back to their mm/dd placeholders.
  const [draft, setDraft] = useState<CalendarDate | null>(() => fromDateString(value) ?? null);

  useEffect(() => {
    setDraft(fromDateString(value) ?? null);
  }, [value]);

  const handleOpenChange = (open: boolean) => {
    // Reseed from the committed value every time the popover opens, so a cancelled edit does not
    // linger into the next one.
    if (open) {
      const seed = fromDateString(value) ?? null;
      setPending(seed);
      if (seed) setFocused(seed);
    }
    setIsOpen(open);
  };

  // Only the calendar's selections are staged for OK. A change with the popover closed can only
  // have come from typing, and there is no OK button to reach once the calendar is shut, so it
  // shows immediately and commits as soon as it is a whole date.
  const handlePickerChange = (date: CalendarDate | null) => {
    if (isOpen) {
      setPending(date);
      return;
    }
    setDraft(date);
    if (date) onChange(toDateString(date));
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
      value={isOpen ? (pending ?? fromDateString(value) ?? null) : draft}
      onChange={handlePickerChange}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      // The footer's OK button is what should close the popover on selection, not the library's
      // own post-select auto-close.
      shouldCloseOnSelect={false}
      minValue={minValue ? fromDateString(minValue) : undefined}
      maxValue={maxValue ? fromDateString(maxValue) : undefined}
      isDisabled={isDisabled}
      granularity="day"
    >
      <Label className="field-label" htmlFor={id}>{label}</Label>
      {/* The field itself is for typing; only the glyph opens the calendar. Opening it from the
          whole field moved focus into the popover before a key could land. */}
      <Group id={id} className="field-group">
        <Button className="calendar-trigger" aria-label="Choose date">
          {/* The copied icon's group carries fill="none", so a fill set on the svg root will not
              reach the shapes; the stylesheet has to target the paths directly. */}
          <CalendarIcon className="calendar-glyph" />
        </Button>
        <DateInput className="date-input">
          {segment => <DateSegment segment={segment}>{paddedSegmentText(segment)}</DateSegment>}
        </DateInput>
        {/* Display only. The model stores a date, so there is no time to set; rendering this as
            text rather than an editable segment is what keeps it unsettable. */}
        <span className="static-time">, 12:00 AM</span>
      </Group>
      <Popover className="date-field-popover">
        <Dialog className="date-field-dialog">
          <Calendar
            className="date-field-calendar"
            focusedValue={focused}
            onFocusChange={setFocused}
          >
            <header className="calendar-header">
              <Button slot="previous" className="nav-button" aria-label="Previous month">‹</Button>
              <CustomSelect
                className="month-dropdown"
                dataTestId="date-field-month"
                items={monthDropdownItems(focused, setFocused, maxValue ? fromDateString(maxValue) : undefined)}
              />
              <Button slot="next" className="nav-button" aria-label="Next month">›</Button>
            </header>
            <CalendarGrid className="calendar-grid" weekdayStyle="short">
              {date => (
                <CalendarCell date={date} className="calendar-cell">
                  {/* A selected day is an outlined cell around a filled swatch, so the number
                      needs its own element to carry the fill. */}
                  {({ formattedDate }) => <span className="cell-fill">{formattedDate}</span>}
                </CalendarCell>
              )}
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
