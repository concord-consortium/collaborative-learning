import { formatTimeZoneOffset } from "./js-utils";

describe("formatTimeZoneOffset", () => {
  it("should work as expected", () => {
    expect(formatTimeZoneOffset(0)).toBe("+0000");
    expect(formatTimeZoneOffset(30)).toBe("-0030");
    expect(formatTimeZoneOffset(-60)).toBe("+0100");
    expect(formatTimeZoneOffset(480)).toBe("-0800");
  });
});
