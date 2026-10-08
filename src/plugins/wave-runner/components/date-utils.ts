import { CalendarDate, parseDate, today } from "@internationalized/date";

/**
 * The model stores dates as "YYYY-MM-DD" strings. CalendarDate carries no timezone, so converting
 * between the two can never shift a date by a day.
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

/**
 * Clamps `value` into [min, max]. Clamped to max first, then to min: if the two bounds are
 * themselves out of order - minValue and maxValue are computed from two independent fields (see
 * data-setup.tsx) and can transiently disagree - this order guarantees the result still respects
 * min rather than landing below it.
 */
export function clampDate(value: CalendarDate, min?: CalendarDate, max?: CalendarDate): CalendarDate {
  let result = value;
  if (max && result.compare(max) > 0) result = max;
  if (min && result.compare(min) < 0) result = min;
  return result;
}

export function toDateString(date: CalendarDate): string {
  // The year must be padded too, not just month and day: an unpadded single-digit year (e.g. the
  // "2" a student has typed so far while entering "2024") produced a string like "2-09-15" that
  // fromDateString cannot parse, which is what let a malformed intermediate commit reach the model.
  const year = String(date.year).padStart(4, "0");
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Today as a stored date string. UTC rather than the local zone because the model's dates are UTC
 * days and the seismic data they request is in UTC - using the local zone would let a student east
 * of UTC pick a day the archive has no data for yet.
 */
export function todayDateString(): string {
  return toDateString(today("UTC"));
}
