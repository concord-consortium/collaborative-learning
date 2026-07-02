import {
  SECONDS_PER_DAY, utcDay, dayIndex, dayToYearDoy, dayToISORange, daysInRange, lastDayIndex,
} from "./seismic-day";

describe("seismic-day", () => {
  it("converts a UTC calendar date to unix seconds", () => {
    expect(utcDay(1970, 1, 1)).toBe(0);
    expect(utcDay(2026, 1, 30)).toBe(Date.UTC(2026, 0, 30) / 1000);
  });

  it("computes the UTC day index from unix seconds", () => {
    expect(dayIndex(utcDay(1970, 1, 1))).toBe(0);
    expect(dayIndex(utcDay(1970, 1, 2))).toBe(1);
    expect(dayIndex(utcDay(2026, 1, 30))).toBe(Math.floor(utcDay(2026, 1, 30) / SECONDS_PER_DAY));
    // Any instant within a day maps to the same index
    expect(dayIndex(utcDay(2026, 1, 30) + 3600)).toBe(dayIndex(utcDay(2026, 1, 30)));
  });

  it("last day index is exclusive", () => {
    expect(lastDayIndex(utcDay(1970, 1, 2))).toBe(0);
  });

  it("converts a day index to UTC year and day-of-year", () => {
    expect(dayToYearDoy(dayIndex(utcDay(2026, 1, 1)))).toEqual({ year: 2026, doy: 1 });
    expect(dayToYearDoy(dayIndex(utcDay(2026, 2, 1)))).toEqual({ year: 2026, doy: 32 });
    expect(dayToYearDoy(dayIndex(utcDay(2024, 12, 31)))).toEqual({ year: 2024, doy: 366 }); // leap year
  });

  it("produces a day-aligned ISO range for a day index", () => {
    const { startISO, endISO } = dayToISORange(dayIndex(utcDay(2026, 1, 30)));
    expect(startISO).toBe("2026-01-30T00:00:00.000Z");
    expect(endISO).toBe("2026-01-31T00:00:00.000Z");
  });

  it("lists the day indices overlapping a [startSec, endSec) range", () => {
    const start = utcDay(2026, 1, 30);
    const end = utcDay(2026, 2, 2); // exclusive
    expect(daysInRange(start, end)).toEqual([
      dayIndex(utcDay(2026, 1, 30)), dayIndex(utcDay(2026, 1, 31)), dayIndex(utcDay(2026, 2, 1)),
    ]);
    // Partial start and end days are included
    expect(daysInRange(start + 7200, end - 1).length).toBe(3);
  });
});
