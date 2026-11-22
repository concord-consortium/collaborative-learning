import { getRevealScrollBehavior, getRevealScrollTop, kRevealMarginPx } from "./playback-reveal-scroll";

describe("getRevealScrollTop", () => {
  const area = { scrollTop: 1000, visibleTop: 0, visibleBottom: 251 };
  const reveal = (tileTop: number, tileBottom: number, overrides = {}) =>
    getRevealScrollTop({ ...area, tileTop, tileBottom, ...overrides });

  it("leaves a tile that is already visible alone", () => {
    expect(reveal(10, 100)).toBeUndefined();
  });

  it("brings a tile below the area up until its bottom clears the area's bottom by the margin", () => {
    expect(reveal(1000, 1100)).toBe(1000 + 1100 - 251 + kRevealMarginPx);
  });

  it("brings a tile above the area down until its top clears the area's top by the margin", () => {
    expect(reveal(-300, -200)).toBe(1000 - 300 - kRevealMarginPx);
  });

  it("shrinks the margin for a tile that nearly fills the area, so it ends fully visible", () => {
    const top = reveal(500, 745)!;
    expect(top).toBe(1000 + 745 - 251 + 3);
    const shift = top - area.scrollTop;
    expect(reveal(500 - shift, 745 - shift, { scrollTop: top })).toBeUndefined();
  });

  describe("a tile taller than the area", () => {
    it("is left alone when it already fills the area", () => {
      expect(reveal(-200, 600)).toBeUndefined();
    });

    it("is brought up until its top meets the area's top when its top is inside the area", () => {
      expect(reveal(100, 700)).toBe(1100);
    });

    it("is brought down until its bottom meets the area's bottom when its bottom is inside the area", () => {
      expect(reveal(-500, 100)).toBe(1000 + 100 - 251);
    });
  });

  it("never asks for a negative scroll position", () => {
    expect(reveal(-300, -200, { scrollTop: 10 })).toBe(0);
  });

  it("counts a tile behind the playback bar as out of view", () => {
    expect(reveal(200, 240)).toBeUndefined();
    expect(reveal(200, 240, { visibleBottom: 220 })).toBe(1000 + 240 - 220 + kRevealMarginPx);
  });
});

describe("getRevealScrollBehavior", () => {
  it("scrolls smoothly within one visible height in either direction", () => {
    expect(getRevealScrollBehavior(300, 300, false)).toBe("smooth");
    expect(getRevealScrollBehavior(-300, 300, false)).toBe("smooth");
    expect(getRevealScrollBehavior(10, 300, false)).toBe("smooth");
  });

  it("jumps beyond one visible height", () => {
    expect(getRevealScrollBehavior(301, 300, false)).toBe("instant");
    expect(getRevealScrollBehavior(-301, 300, false)).toBe("instant");
  });

  it("jumps for a reader who asked for reduced motion", () => {
    expect(getRevealScrollBehavior(10, 300, true)).toBe("instant");
  });
});
