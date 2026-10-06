import { CalendarDate } from "@internationalized/date";
import { fromDateString, todayDateString, toDateString } from "./date-utils";

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

  it("returns undefined for a malformed or empty string rather than throwing", () => {
    expect(fromDateString("")).toBeUndefined();
    expect(fromDateString("not-a-date")).toBeUndefined();
    expect(fromDateString("2026-13-45")).toBeUndefined();
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
