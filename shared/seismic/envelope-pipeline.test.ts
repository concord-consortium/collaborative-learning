// shared/seismic/envelope-pipeline.test.ts
import { createPipelineState, placePointInTile, processL2Point, flushTiles } from "./envelope-pipeline";
import { LEVEL_SPACINGS, K_FACTOR, POINTS_PER_TILE, NUM_LEVELS, NO_DATA_SENTINEL } from "./envelope-config";
import { getTileIndex, getTileTimeRange, getPointIndexInTile } from "./tile-addressing";
import type { EnvelopeTileData } from "./seismic-types";

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

  describe("flushTiles", () => {
    describe("incremental (force = false)", () => {
      it("flushes completed L1 accumulators into L1 tiles and creates L0 accumulators", () => {
        const state = createPipelineState();
        const flushedTiles: Array<{ level: number; tileIndex: number }> = [];
        const flushTile = (level: number, tileIndex: number) => {
          flushedTiles.push({ level, tileIndex });
        };

        const l2Spacing = LEVEL_SPACINGS[2];
        for (let i = 0; i <= K_FACTOR; i++) {
          processL2Point(state, i * l2Spacing, -100, 100);
        }

        expect(state.l1Accumulators.size).toBeGreaterThanOrEqual(1);

        flushTiles(state, flushTile);

        expect(state.l1Accumulators.has(0)).toBe(false);
        expect(state.l0Accumulators.size).toBeGreaterThanOrEqual(1);

        const l1TileIdx = getTileIndex(0, 1);
        const l1Tile = state.openTiles[1].get(l1TileIdx);
        expect(l1Tile).toBeDefined();
        expect(l1Tile!.mins[0]).not.toBe(NO_DATA_SENTINEL);
      });

      it("flushes completed tiles via the callback", () => {
        const state = createPipelineState();
        const flushedTiles: Array<{ level: number; tileIndex: number }> = [];
        const flushTile = (level: number, tileIndex: number) => {
          flushedTiles.push({ level, tileIndex });
        };

        const l2Spacing = LEVEL_SPACINGS[2];
        const l2PointsPerTile = POINTS_PER_TILE[2];
        for (let i = 0; i <= l2PointsPerTile; i++) {
          processL2Point(state, i * l2Spacing, -100, 100);
        }

        flushTiles(state, flushTile);

        const l2Flushes = flushedTiles.filter(t => t.level === 2);
        expect(l2Flushes.length).toBe(1);
        expect(l2Flushes[0].tileIndex).toBe(0);

        expect(state.openTiles[2].has(0)).toBe(false);
      });

      it("does not flush the current (in-progress) tile or accumulator", () => {
        const state = createPipelineState();
        const flushedTiles: Array<{ level: number; tileIndex: number }> = [];
        const flushTile = (level: number, tileIndex: number) => {
          flushedTiles.push({ level, tileIndex });
        };

        const l2Spacing = LEVEL_SPACINGS[2];
        for (let i = 0; i < 5; i++) {
          processL2Point(state, i * l2Spacing, -100, 100);
        }

        flushTiles(state, flushTile);

        expect(flushedTiles.length).toBe(0);
        expect(state.l1Accumulators.size).toBe(1);
      });
    });

    describe("final (force = true)", () => {
      it("finalizes all accumulators and flushes all remaining tiles", () => {
        const state = createPipelineState();
        const flushedTiles: Array<{ level: number; tileIndex: number; tileData: EnvelopeTileData }> = [];
        const flushTile = (level: number, tileIndex: number, tileData: EnvelopeTileData) => {
          flushedTiles.push({ level, tileIndex, tileData });
        };

        const l2Spacing = LEVEL_SPACINGS[2];
        for (let i = 0; i < 5; i++) {
          processL2Point(state, i * l2Spacing, -300, 300);
        }

        flushTiles(state, flushTile, true);

        expect(state.l1Accumulators.size).toBe(0);
        expect(state.l0Accumulators.size).toBe(0);

        for (let level = 0; level < 3; level++) {
          expect(state.openTiles[level].size).toBe(0);
        }

        const levels = new Set(flushedTiles.map(t => t.level));
        expect(levels.has(0)).toBe(true);
        expect(levels.has(1)).toBe(true);
        expect(levels.has(2)).toBe(true);

        for (const { tileData } of flushedTiles) {
          const hasData = tileData.mins.some(v => v !== NO_DATA_SENTINEL);
          expect(hasData).toBe(true);
        }
      });

      it("produces correct L1 values from accumulated L2 points", () => {
        const state = createPipelineState();
        const flushedTiles: Array<{ level: number; tileIndex: number; tileData: EnvelopeTileData }> = [];
        const flushTile = (level: number, tileIndex: number, tileData: EnvelopeTileData) => {
          flushedTiles.push({ level, tileIndex, tileData });
        };

        const l2Spacing = LEVEL_SPACINGS[2];
        for (let i = 0; i < K_FACTOR; i++) {
          const qMin = -(i + 1) * 10;
          const qMax = (i + 1) * 10;
          processL2Point(state, i * l2Spacing, qMin, qMax);
        }

        flushTiles(state, flushTile, true);

        const l1Tile = flushedTiles.find(t => t.level === 1);
        expect(l1Tile).toBeDefined();

        const l1Data = l1Tile!.tileData;
        const firstNonSentinel = l1Data.mins.findIndex(v => v !== NO_DATA_SENTINEL);
        expect(firstNonSentinel).toBeGreaterThanOrEqual(0);
        expect(l1Data.mins[firstNonSentinel]).toBe(-K_FACTOR * 10);
        expect(l1Data.maxs[firstNonSentinel]).toBe(K_FACTOR * 10);
      });
    });
  });
});
