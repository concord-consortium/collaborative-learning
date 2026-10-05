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
        </Dialog>
      </Popover>
    </DatePicker>
  );
};
