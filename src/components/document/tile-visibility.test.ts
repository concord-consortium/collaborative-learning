import { computeVisibleTiles, type ITileExtent, type IViewportBounds } from "./tile-visibility";

const viewport: IViewportBounds = { top: 0, bottom: 100 };
const extent = (over: Partial<ITileExtent>): ITileExtent => ({
  tileId: "t", tileType: "Text", tileTitle: "T", top: 0, bottom: 50, height: 50, ...over
});

describe("computeVisibleTiles", () => {
  it("reports 100% for a fully-visible tile", () => {
    const result = computeVisibleTiles(viewport, [extent({ top: 10, bottom: 60, height: 50 })]);
    expect(result).toEqual([{ tileId: "t", tileType: "Text", tileTitle: "T", percentVisible: 100 }]);
  });

  it("reports a partial percent when the bottom is clipped", () => {
    // tile 80..180 (height 100); viewport bottom 100 => 20 of 100 visible
    const result = computeVisibleTiles(viewport, [extent({ top: 80, bottom: 180, height: 100 })]);
    expect(result[0].percentVisible).toBe(20);
  });

  it("reports a partial percent when the top is clipped", () => {
    // tile -40..60 (height 100); viewport top 0 => 60 of 100 visible
    const result = computeVisibleTiles(viewport, [extent({ top: -40, bottom: 60, height: 100 })]);
    expect(result[0].percentVisible).toBe(60);
  });

  it("rounds to a whole percent", () => {
    // tile 99..102 (height 3); viewport bottom 100 => 1 of 3 => 33
    const result = computeVisibleTiles(viewport, [extent({ top: 99, bottom: 102, height: 3 })]);
    expect(result[0].percentVisible).toBe(33);
  });

  it("omits tiles scrolled fully above or below, and zero-height tiles", () => {
    const result = computeVisibleTiles(viewport, [
      extent({ tileId: "above", top: -100, bottom: -10, height: 90 }),
      extent({ tileId: "below", top: 120, bottom: 210, height: 90 }),
      extent({ tileId: "zero", top: 10, bottom: 10, height: 0 })
    ]);
    expect(result).toEqual([]);
  });

  it("preserves input order among visible tiles", () => {
    const result = computeVisibleTiles(viewport, [
      extent({ tileId: "a", top: 0, bottom: 40, height: 40 }),
      extent({ tileId: "gone", top: 200, bottom: 240, height: 40 }),
      extent({ tileId: "b", top: 50, bottom: 90, height: 40 })
    ]);
    expect(result.map(t => t.tileId)).toEqual(["a", "b"]);
  });
});
