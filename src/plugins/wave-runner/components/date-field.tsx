import { CalendarDate, parseDate } from "@internationalized/date";
import React, { useState } from "react";
import {
  Button, Calendar, CalendarCell, CalendarGrid, DateInput, DatePicker,
  DateSegment, Dialog, Group, Label, Popover
} from "react-aria-components";

import CalendarIcon from "../assets/calendar-icon.svg";
import { fromDateString, toDateString } from "./date-utils";

import "./date-field.scss";

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
      // The footer's OK button is what should close the popover on selection, not the library's
      // own post-select auto-close.
      shouldCloseOnSelect={false}
      minValue={minValue ? fromDateString(minValue) : undefined}
      maxValue={maxValue ? fromDateString(maxValue) : undefined}
      isDisabled={isDisabled}
      granularity="day"
    >
      <Label className="field-label" htmlFor={id}>{label}</Label>
      <Group id={id} className="field-group">
        <DateInput className="date-input">
          {segment => <DateSegment segment={segment} />}
        </DateInput>
        {/* Display only. The model stores a date, so there is no time to set; rendering this as
            text rather than an editable segment is what keeps it unsettable. */}
        <span className="static-time">, 12:00 AM</span>
        <Button className="calendar-trigger" aria-label="Choose date">
          {/* The copied icon's group carries fill="none", so a fill set on the svg root will not
              reach the shapes; the stylesheet has to target the paths directly. */}
          <CalendarIcon className="calendar-glyph" />
        </Button>
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
