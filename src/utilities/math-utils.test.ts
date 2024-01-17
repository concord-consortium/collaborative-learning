import { roundForDisplay } from "./math-utils";

describe("roundForDisplay", () => {
  it("should respect the number of decimal places requested", () => {
    expect(roundForDisplay(Math.PI, 4)).toBe(3.142);
    expect(roundForDisplay(Math.PI, 3)).toBe(3.14);
    expect(roundForDisplay(Math.PI, 2)).toBe(3.1);
    expect(roundForDisplay(Math.PI, 1)).toBe(3);
  });
  it("should handle very small numbers", () => {
    expect(roundForDisplay(.00000039234, 3)).toBe(0.000000392);
    expect(roundForDisplay(.00000039234, 2)).toBe(0.00000039);
    expect(roundForDisplay(.00000039234, 1)).toBe(0.0000004);
  });
  it("should never remove units", () => {
    expect(roundForDisplay(123456.1, 3)).toBe(123456);
    expect(roundForDisplay(123456.1, 2)).toBe(123456);
    expect(roundForDisplay(123456.1, 1)).toBe(123456);
    expect(roundForDisplay(17.6, 1)).toBe(18);
  });
});
