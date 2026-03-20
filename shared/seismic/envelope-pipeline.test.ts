// shared/seismic/envelope-pipeline.test.ts
import { createPipelineState, placePointInTile } from "./envelope-pipeline";
import { LEVEL_SPACINGS, NUM_LEVELS, NO_DATA_SENTINEL } from "./envelope-config";
import { getTileIndex, getTileTimeRange, getPointIndexInTile } from "./tile-addressing";

describe("envelope-pipeline", () => {
  describe("createPipelineState", () => {
    it("initializes empty state with correct structure", () => {
      const state = createPipelineState();
      expect(state.openTiles).toHaveLength(NUM_LEVELS);
      for (let i = 0; i < NUM_LEVELS; i++) {
        expect(state.openTiles[i].size).toBe(0);
      }
      expect(state.l1Accumulators.size).toBe(0);
      expect(state.l0Accumulators.size).toBe(0);
      expect(state.highestL2GlobalIndex).toBe(-1);
    });
  });

  describe("placePointInTile", () => {
    it("creates a new tile and places a point at the correct offset", () => {
      const tiles = new Map();
      const level = 2;
      const time = 100;
      const qMin = -500;
      const qMax = 500;

      placePointInTile(tiles, level, time, qMin, qMax);

      const tileIdx = getTileIndex(time, level);
      expect(tiles.has(tileIdx)).toBe(true);

      const tile = tiles.get(tileIdx)!;
      const pointIndex = getPointIndexInTile(time, level, tileIdx);

      expect(tile.mins[pointIndex]).toBe(qMin);
      expect(tile.maxs[pointIndex]).toBe(qMax);
    });

    it("fills unoccupied positions with NO_DATA_SENTINEL", () => {
      const tiles = new Map();
      const level = 1;
      const time = 1000;

      placePointInTile(tiles, level, time, -100, 100);

      const tileIdx = getTileIndex(time, level);
      const tile = tiles.get(tileIdx)!;
      const pointIndex = getPointIndexInTile(time, level, tileIdx);

      const otherIndex = pointIndex === 0 ? 1 : 0;
      expect(tile.mins[otherIndex]).toBe(NO_DATA_SENTINEL);
      expect(tile.maxs[otherIndex]).toBe(NO_DATA_SENTINEL);
    });

    it("places into an existing tile without recreating it", () => {
      const tiles = new Map();
      const level = 2;
      const tileRange = getTileTimeRange(level, 0);
      const time1 = tileRange.start;
      const time2 = tileRange.start + LEVEL_SPACINGS[level];

      placePointInTile(tiles, level, time1, -100, 100);
      placePointInTile(tiles, level, time2, -200, 200);

      expect(tiles.size).toBe(1);
      const tile = tiles.get(0)!;
      expect(tile.mins[0]).toBe(-100);
      expect(tile.mins[1]).toBe(-200);
    });
  });
});
