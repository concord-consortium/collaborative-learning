// shared/seismic/envelope-pipeline.test.ts
import { createPipelineState, placePointInTile, processL2Point } from "./envelope-pipeline";
import { LEVEL_SPACINGS, K_FACTOR, NUM_LEVELS, NO_DATA_SENTINEL } from "./envelope-config";
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

  describe("processL2Point", () => {
    it("places point in L2 tile and updates highestL2GlobalIndex", () => {
      const state = createPipelineState();
      const time = 1000;
      processL2Point(state, time, -500, 500);

      const expectedL2Global = Math.floor(time / LEVEL_SPACINGS[2]);
      expect(state.highestL2GlobalIndex).toBe(expectedL2Global);

      const tileIdx = getTileIndex(time, 2);
      expect(state.openTiles[2].has(tileIdx)).toBe(true);
    });

    it("creates an L1 accumulator for the corresponding L1 point", () => {
      const state = createPipelineState();
      const time = 1000;
      processL2Point(state, time, -500, 500);

      const l2Global = Math.floor(time / LEVEL_SPACINGS[2]);
      const l1Global = Math.floor(l2Global / K_FACTOR);
      expect(state.l1Accumulators.has(l1Global)).toBe(true);
      expect(state.l1Accumulators.get(l1Global)!.min).toBe(-500);
      expect(state.l1Accumulators.get(l1Global)!.max).toBe(500);
    });

    it("accumulates min/max across multiple L2 points in the same L1 window", () => {
      const state = createPipelineState();
      const time1 = 0;
      const time2 = LEVEL_SPACINGS[2];
      processL2Point(state, time1, -200, 300);
      processL2Point(state, time2, -500, 100);

      const l2Global = Math.floor(time1 / LEVEL_SPACINGS[2]);
      const l1Global = Math.floor(l2Global / K_FACTOR);
      const acc = state.l1Accumulators.get(l1Global)!;
      expect(acc.min).toBe(-500);
      expect(acc.max).toBe(300);
    });
  });
});
