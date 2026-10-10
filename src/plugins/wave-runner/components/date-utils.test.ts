import { CalendarDate } from "@internationalized/date";
import { clampDate, fromDateString, todayDateString, toDateString } from "./date-utils";

describe("date-utils", () => {
  it("parses a stored date string", () => {
    const date = fromDateString("2026-09-01");
    expect(date).toEqual(new CalendarDate(2026, 9, 1));
  });

  it("round-trips a stored date string unchanged", () => {
    expect(toDateString(fromDateString("2026-09-01")!)).toBe("2026-09-01");
    expect(toDateString(fromDateString("2026-10-01")!)).toBe("2026-10-01");
  });

  it("zero-pads single-digit months and days", () => {
    expect(toDateString(new CalendarDate(2026, 1, 5))).toBe("2026-01-05");
  });

  // A single-digit year - exactly what a year segment holds after its first typed keystroke -
  // must still pad out to 4 digits, or the resulting string fails to round-trip through
  // fromDateString, which is what let a malformed intermediate value reach the model.
  it("zero-pads a single-digit year", () => {
    expect(toDateString(new CalendarDate(2, 9, 15))).toBe("0002-09-15");
  });

  it("returns undefined for a malformed or empty string rather than throwing", () => {
    expect(fromDateString("")).toBeUndefined();
    expect(fromDateString("not-a-date")).toBeUndefined();
    expect(fromDateString("2026-13-45")).toBeUndefined();
  });
});

describe("clampDate", () => {
  it("leaves a value already inside the bounds unchanged", () => {
    const value = new CalendarDate(2026, 9, 15);
    expect(clampDate(value, new CalendarDate(2026, 9, 1), new CalendarDate(2026, 9, 30))).toEqual(value);
  });

  it("clamps up to min", () => {
    expect(clampDate(new CalendarDate(2026, 9, 1), new CalendarDate(2026, 9, 15)))
      .toEqual(new CalendarDate(2026, 9, 15));
  });

  it("clamps down to max", () => {
    expect(clampDate(new CalendarDate(2026, 9, 30), undefined, new CalendarDate(2026, 9, 15)))
      .toEqual(new CalendarDate(2026, 9, 15));
  });

  // The DateField popover's own Calendar cannot even render with minValue past maxValue - its
  // underlying react-aria components hang - so this contradictory-bounds case (minValue tracks
  // the other field - see data-setup.tsx - and can transiently land past maxValue) can only be
  // exercised at this level, not through the rendered field.
  it("clamps to min, not max, when the bounds are themselves out of order", () => {
    const min = new CalendarDate(2026, 10, 5);
    const max = new CalendarDate(2026, 9, 15);
    expect(clampDate(new CalendarDate(2026, 10, 1), min, max)).toEqual(min);
    expect(clampDate(new CalendarDate(2026, 9, 1), min, max)).toEqual(min);
  });
});

describe("todayDateString", () => {
  afterEach(() => jest.useRealTimers());

  // UTC, not the local zone: a student east of UTC would otherwise be offered a day the seismic
  // archive has no data for yet.
  it("reports today in UTC regardless of the local zone", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-06T23:30:00Z"));
    expect(todayDateString()).toBe("2026-10-06");
  });
});
