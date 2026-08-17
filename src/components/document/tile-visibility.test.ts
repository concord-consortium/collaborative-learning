import {
  buildVisibilityLogParams,
  computeVisibleTiles,
  type ITileExtent,
  type IViewportBounds
} from "./tile-visibility";

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

  it("keeps a barely-visible tile at 1% instead of rounding it away", () => {
    // tile 97..1097 (height 1000); viewport bottom 100 => 3px of 1000 = 0.3% => clamped up to 1
    const result = computeVisibleTiles(viewport, [extent({ top: 97, bottom: 1097, height: 1000 })]);
    expect(result[0].percentVisible).toBe(1);
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

describe("buildVisibilityLogParams", () => {
  const tiles = [{ tileId: "t1", tileType: "Text", tileTitle: "A", percentVisible: 100 }];

  it("includes the core fields and no cause-specific fields for scroll", () => {
    const p = buildVisibilityLogParams("scroll", { documentId: "doc1" }, 640, 3, tiles);
    expect(p).toEqual({
      cause: "scroll", documentId: "doc1", viewportHeight: 640, tileCount: 3, visibleTiles: tiles
    });
  });

  it("spreads full document context (type/title/owner) into the params", () => {
    const ctx = { documentId: "k1", documentType: "problem", documentTitle: "P1", documentOwner: "u9" };
    const p = buildVisibilityLogParams("scroll", ctx, 640, 3, tiles);
    expect(p).toEqual({
      cause: "scroll", documentId: "k1", documentType: "problem", documentTitle: "P1",
      documentOwner: "u9", viewportHeight: 640, tileCount: 3, visibleTiles: tiles
    });
  });

  it("adds dividerPosition only for dividerResize", () => {
    const p = buildVisibilityLogParams(
      "dividerResize", { documentId: "doc1" }, 640, 3, tiles, { dividerPosition: 100 }
    );
    expect(p.dividerPosition).toBe(100);
    expect(p.resizedRowId).toBeUndefined();
  });

  it("adds resizedRowId only for tileResize", () => {
    const p = buildVisibilityLogParams(
      "tileResize", { documentId: "doc1" }, 640, 3, tiles, { resizedRowId: "row9" }
    );
    expect(p.resizedRowId).toBe("row9");
    expect(p.dividerPosition).toBeUndefined();
  });

  it("ignores cause-specific extras that do not match the cause", () => {
    const p = buildVisibilityLogParams(
      "scroll", { documentId: "doc1" }, 640, 3, tiles, { dividerPosition: 50, resizedRowId: "r" }
    );
    expect(p.dividerPosition).toBeUndefined();
    expect(p.resizedRowId).toBeUndefined();
  });

  it("passes a documentChange cause through with only core fields", () => {
    const p = buildVisibilityLogParams("documentChange", { documentId: "d" }, 100, 1, tiles);
    expect(p).toEqual({
      cause: "documentChange", documentId: "d", viewportHeight: 100, tileCount: 1, visibleTiles: tiles
    });
  });
});
