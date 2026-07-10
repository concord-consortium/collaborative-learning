import {
  getTileIndex, getTileTimeRange, getTileIndicesForViewport, getTileS3Key, getTileDuration, getPointIndexInTile
} from "./tile-addressing";
import { LEVEL_SPACINGS, POINTS_PER_TILE } from "./envelope-config";

describe("tile-addressing", () => {
  describe("getTileIndex", () => {
    it("returns 0 for timestamps within the first tile from epoch", () => {
      expect(getTileIndex(0, 0)).toBe(0);
      expect(getTileIndex(1, 2)).toBe(0);
    });

    it("computes correct tile index for a known timestamp", () => {
      // L2 tile duration = 1.575 * 20480 = 32256 seconds
      const tileDuration = getTileDuration(2);
      expect(getTileIndex(tileDuration * 5, 2)).toBe(5);
      expect(getTileIndex(tileDuration * 5 + 1, 2)).toBe(5);
    });

  });

  describe("getTileTimeRange", () => {
    it("returns correct range for tile 0 at each level", () => {
      for (let level = 0; level < LEVEL_SPACINGS.length; level++) {
        const range = getTileTimeRange(level, 0);
        expect(range.start).toBe(0);
        expect(range.end).toBe(getTileDuration(level));
      }
    });

    it("tiles are contiguous (end of tile N = start of tile N+1)", () => {
      const range5 = getTileTimeRange(1, 5);
      const range6 = getTileTimeRange(1, 6);
      expect(range5.end).toBe(range6.start);
    });
  });

  describe("getTileIndicesForViewport", () => {
    it("returns a single tile when viewport fits within one tile", () => {
      const tileDuration = getTileDuration(2);
      const indices = getTileIndicesForViewport(10, tileDuration - 10, 2);
      expect(indices).toEqual([0]);
    });

    it("returns multiple tiles when viewport spans tile boundaries", () => {
      const tileDuration = getTileDuration(2);
      const indices = getTileIndicesForViewport(0, tileDuration * 2.5, 2);
      expect(indices).toEqual([0, 1, 2]);
    });

    it("returns empty array for zero-width viewport", () => {
      const indices = getTileIndicesForViewport(100, 100, 1);
      expect(indices).toEqual([]);
    });
  });

  describe("getTileDuration", () => {
    it("returns spacing * points per tile for each level", () => {
      for (let level = 0; level < LEVEL_SPACINGS.length; level++) {
        expect(getTileDuration(level)).toBe(LEVEL_SPACINGS[level] * POINTS_PER_TILE[level]);
      }
    });
  });

  describe("getPointIndexInTile", () => {
    it("returns 0 for a timestamp at the start of a tile", () => {
      const range = getTileTimeRange(2, 3);
      expect(getPointIndexInTile(range.start, 2, 3)).toBe(0);
    });

    it("returns the correct offset for a timestamp within a tile", () => {
      const range = getTileTimeRange(1, 0);
      const time = range.start + LEVEL_SPACINGS[1] * 5;
      expect(getPointIndexInTile(time, 1, 0)).toBe(5);
    });
  });

  describe("getTileS3Key", () => {
    it("constructs the expected key format", () => {
      const key = getTileS3Key({ network: "AK", station: "K204", channel: "BHZ" }, 2, 42);
      expect(key).toBe("AK_K204/BHZ/L2/42");
    });
  });
});
