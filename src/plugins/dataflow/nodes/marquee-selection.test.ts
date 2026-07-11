import { rectsIntersect, Rect } from "./marquee-selection";

const r = (left: number, top: number, right: number, bottom: number): Rect => ({ left, top, right, bottom });

describe("rectsIntersect (CLUE-568 marquee selection)", () => {
  it("returns true for overlapping rectangles", () => {
    expect(rectsIntersect(r(0, 0, 10, 10), r(5, 5, 15, 15))).toBe(true);
  });

  it("returns true when one rectangle contains the other", () => {
    expect(rectsIntersect(r(0, 0, 100, 100), r(40, 40, 60, 60))).toBe(true);
  });

  it("returns false for separated rectangles", () => {
    expect(rectsIntersect(r(0, 0, 10, 10), r(20, 20, 30, 30))).toBe(false);
  });

  it("treats edge-only contact as non-overlapping", () => {
    // b starts exactly where a ends on x.
    expect(rectsIntersect(r(0, 0, 10, 10), r(10, 0, 20, 10))).toBe(false);
  });

  it("detects overlap on one axis only as non-overlapping", () => {
    // x ranges overlap but y ranges don't.
    expect(rectsIntersect(r(0, 0, 10, 10), r(5, 20, 15, 30))).toBe(false);
  });
});
