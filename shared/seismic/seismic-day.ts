/** Seconds in a UTC day. Day identity for the bulk cache is the UTC calendar day. */
export const SECONDS_PER_DAY = 86400;
export const MILLISECONDS_PER_DAY = SECONDS_PER_DAY * 1000;

/** UTC calendar date (1-based month) → Unix seconds. */
export function utcDay(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) / 1000;
}

/** Date in string format → Unix seconds. */
export function utcDayFromString(dateString: string): number | undefined {
  const date = new Date(dateString);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  if (isNaN(year) || isNaN(month) || isNaN(day)) return undefined;

  return utcDay(year, month + 1, day);
}

/** Unix seconds → UTC day index (days since the Unix epoch). */
export function dayIndex(unixSec: number): number {
  return Math.floor(unixSec / SECONDS_PER_DAY);
}

/** Unix seconds → UTC day index for the final day in a range. */
export function lastDayIndex(unixSec: number): number {
  return Math.ceil(unixSec / SECONDS_PER_DAY) - 1;
}

/** Day index → UTC calendar year and day-of-year (1-based), for OPFS paths. */
export function dayToYearDoy(day: number): { year: number; doy: number } {
  const startMs = day * MILLISECONDS_PER_DAY;
  const d = new Date(startMs);
  const year = d.getUTCFullYear();
  const yearStartMs = Date.UTC(year, 0, 1);
  const doy = Math.floor((startMs - yearStartMs) / MILLISECONDS_PER_DAY) + 1;
  return { year, doy };
}

/** Day index → day-aligned ISO start/end (end exclusive), for dataselect requests. */
export function dayToISORange(day: number): { startISO: string; endISO: string } {
  const startISO = new Date(day * MILLISECONDS_PER_DAY).toISOString();
  const endISO = new Date((day + 1) * MILLISECONDS_PER_DAY).toISOString();
  return { startISO, endISO };
}

/** All UTC day indices overlapping [startSec, endSec). */
export function daysInRange(startSec: number, endSec: number): number[] {
  const first = dayIndex(startSec);
  const last = lastDayIndex(endSec);
  const days: number[] = [];
  for (let d = first; d <= last; d++) days.push(d);
  return days;
}
