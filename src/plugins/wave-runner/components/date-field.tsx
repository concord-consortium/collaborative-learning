import { CalendarDate, parseDate } from "@internationalized/date";
import React, { useEffect, useRef, useState } from "react";
import {
  Button, Calendar, CalendarCell, CalendarGrid, DateInput, DatePicker,
  DateSegment, Dialog, Group, Label, Popover
} from "react-aria-components";

import CalendarIcon from "../assets/calendar-icon.svg";
import { CustomSelect, ICustomDropdownItem } from "../../../clue/components/custom-select";
import { kDefaultStartDate } from "../models/wave-runner-content";
import { clampDate, fromDateString, toDateString } from "./date-utils";

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
function monthOptions(focused: CalendarDate, earliest?: CalendarDate, latest?: CalendarDate) {
  const options: { value: string; label: string }[] = [];
  for (let offset = -12; offset <= 12; offset++) {
    const date = focused.add({ months: offset });
    // A month entirely past the last selectable date holds nothing that can be chosen, so it is
    // left out rather than offered and then refused. The loop runs in increasing date order, so
    // every month from here on is past it too.
    if (latest && (date.year > latest.year
        || (date.year === latest.year && date.month > latest.month))) break;
    // A month entirely before the first selectable date is left out the same way, but only
    // skipped rather than breaking out of the loop: at this point in the loop it is the months
    // after it, not before, that are still to come.
    if (earliest && (date.year < earliest.year
        || (date.year === earliest.year && date.month < earliest.month))) continue;
    const month = String(date.month).padStart(2, "0");
    options.push({
      value: `${date.year}-${month}`,
      label: `${kMonthNames[date.month - 1]} ${date.year}`
    });
  }
  return options;
}

// No static `title`: it would mask the focused month the same way it would mask a chosen station
// or model (see data-setup.tsx). Unlike Station/Model, there is no separate field name to announce
// here, so the focused month is left as both the visible label and the accessible name.
function monthDropdownItems(
  focused: CalendarDate, setFocused: (date: CalendarDate) => void,
  earliest?: CalendarDate, latest?: CalendarDate
): ICustomDropdownItem[] {
  const focusedValue = `${focused.year}-${String(focused.month).padStart(2, "0")}`;
  return monthOptions(focused, earliest, latest).map(option => ({
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
    // kDefaultStartDate is a valid literal, so this can only be undefined if the picker is ever
    // given a non-date default of its own - the assertion is the trade-off for not duplicating it
    // as a second hardcoded fallback here.
    () => fromDateString(value) ?? fromDateString(kDefaultStartDate)!
  );
  // What the field is showing while it is being typed into, so a half-typed entry has somewhere to
  // live: the segments the student has not touched yet keep their last known value here instead of
  // falling back to their mm/dd placeholders.
  const [draft, setDraft] = useState<CalendarDate | null>(() => fromDateString(value) ?? null);
  // Clearing a segment to empty does not reach `draft`: react-aria's onChange only fires for an
  // edit that is complete and valid, so the segment just displays its own mm/dd/yyyy placeholder
  // locally and draft keeps whatever complete value it last heard about. commitTyped reads this
  // ref directly to catch that case rather than trusting draft alone.
  const groupRef = useRef<HTMLDivElement>(null);

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

  // A change with the popover closed can only have come from typing. It is kept in draft only -
  // not committed to the model - until commitTyped runs on blur or Enter. Committing on every
  // keystroke (the previous behavior) could send the model a malformed intermediate value (typing
  // "2024" into the year commits year "2" on the first keystroke) and bypassed minValue/maxValue
  // entirely, since those bounds are validation-only for react-aria and the model setters do not
  // validate.
  const handlePickerChange = (date: CalendarDate | null) => {
    if (isOpen) {
      setPending(date);
      return;
    }
    setDraft(date);
  };

  // Validates the typed draft before it can reach the model. A draft that is incomplete (either
  // draft itself is null, or a segment still shows its placeholder - see groupRef above), invalid,
  // or outside minValue/maxValue is discarded in favor of the model's own value rather than
  // committed - so the field and the model can never be left disagreeing, and the model can never
  // see an out-of-bounds or malformed date.
  const commitTyped = () => {
    const committed = fromDateString(value) ?? null;
    const min = minValue ? fromDateString(minValue) : undefined;
    const max = maxValue ? fromDateString(maxValue) : undefined;
    // See the comment on groupRef above: a segment showing its placeholder means the date is
    // incomplete even though draft itself still looks like a full date.
    const isIncomplete = !!groupRef.current?.querySelector("[data-placeholder]");
    const inBounds = !isIncomplete && !!draft
      && (!min || draft.compare(min) >= 0) && (!max || draft.compare(max) <= 0);

    if (draft && inBounds) {
      if (!committed || draft.compare(committed) !== 0) onChange(toDateString(draft));
    } else {
      setDraft(committed);
    }
  };

  // Blur commits a typed edit; Enter does too, without waiting for focus to leave. Both are
  // no-ops while the calendar is open, since in that state the Group's contents are not what is
  // being typed into - typing is why focus was inside the Group when it last mattered.
  //
  // react-aria swaps a DateSegment for a fresh node on some keystrokes, which blurs and
  // synchronously re-focuses a segment with no relatedTarget to compare against - indistinguishable
  // from a real blur if checked immediately. Deferring to a microtask lets that re-focus land
  // first, so an internal focus shuffle between segments is not mistaken for the student tabbing
  // or clicking away.
  const handleGroupBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (isOpen) return;
    const group = event.currentTarget;
    queueMicrotask(() => {
      if (!group.contains(document.activeElement)) commitTyped();
    });
  };

  const handleGroupKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen && event.key === "Enter") commitTyped();
  };

  const commit = () => {
    if (pending) onChange(toDateString(pending));
    setIsOpen(false);
  };

  const cancel = () => setIsOpen(false);

  // defaultValue is a fixed constant (see kDefaultStartDate/kDefaultEndDate) with no knowledge of
  // the other field's current value, so it can land outside this field's live minValue/maxValue -
  // e.g. clearing the end field after the start field has moved past the default end date. Staging
  // it unclamped would let OK commit a date the calendar itself would have refused to let you pick.
  const clear = () => {
    const next = fromDateString(defaultValue ?? value) ?? null;
    const min = minValue ? fromDateString(minValue) : undefined;
    const max = maxValue ? fromDateString(maxValue) : undefined;
    // See clampDate's own comment for why the clamp order matters.
    setPending(next ? clampDate(next, min, max) : next);
  };

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
      <Group
        id={id}
        ref={groupRef}
        className="field-group"
        onBlur={handleGroupBlur}
        onKeyDown={handleGroupKeyDown}
      >
        <Button className="calendar-trigger" aria-label="Choose date">
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
                items={monthDropdownItems(
                  focused, setFocused,
                  minValue ? fromDateString(minValue) : undefined,
                  maxValue ? fromDateString(maxValue) : undefined
                )}
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
