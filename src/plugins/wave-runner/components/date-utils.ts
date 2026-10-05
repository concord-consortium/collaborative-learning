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
