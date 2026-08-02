# Envelope Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign `scripts/seismic/generate-envelopes.ts` to stream-process ROVER files one at a time and support a `--local-only` flag, as specified in [envelope-pipeline-design.md](2026-03-19-envelope-pipeline-design.md).

**Architecture:** Extract pipeline state management (accumulators, incremental tile filling, flushing) into a testable module at `shared/seismic/envelope-pipeline.ts`. The script becomes a thin orchestrator: parse args, iterate files, feed data into the pipeline, and call a flush callback for I/O. A `FlushTileFn` callback decouples pipeline logic from S3/filesystem concerns.

**Tech Stack:** TypeScript, MobX State Tree patterns (Int16Array buffers), Jest for testing, seisplotjs for miniSEED parsing, @aws-sdk/client-s3 for uploads.

---

## Task 1: Add `--local-only` flag to `parseArgs`

**Files:**
- Modify: `scripts/seismic/generate-envelopes.ts`

**Step 1: Add `localOnly` to `ScriptConfig` and update `parseArgs`**

Add the field to the interface:

```typescript
interface ScriptConfig {
  // ... existing fields ...
  /** When true, skip all S3 operations. --output-dir is required. */
  localOnly: boolean;
}
```

Update the `parseArgs` function to handle `--local-only` as a boolean flag (no value). The current loop advances by 2 for every arg (`i += 2`). Change it to advance by 1 for `--local-only`:

```typescript
function parseArgs(): ScriptConfig {
  const args = process.argv.slice(2);
  const config: Partial<ScriptConfig> = {
    s3Bucket: DEFAULT_S3_BUCKET,
    s3Prefix: DEFAULT_S3_PREFIX,
    awsRegion: DEFAULT_AWS_REGION,
    localOnly: false,
  };

  let i = 0;
  while (i < args.length) {
    const key = args[i];
    switch (key) {
      case "--local-only":
        config.localOnly = true;
        i += 1;
        break;
      case "--input-dir": config.inputDir = args[i + 1]; i += 2; break;
      case "--network": config.network = args[i + 1]; i += 2; break;
      case "--station": config.station = args[i + 1]; i += 2; break;
      case "--channel": config.channel = args[i + 1]; i += 2; break;
      case "--output-dir": config.outputDir = args[i + 1]; i += 2; break;
      case "--s3-bucket": config.s3Bucket = args[i + 1]; i += 2; break;
      case "--s3-prefix": config.s3Prefix = args[i + 1]; i += 2; break;
      case "--aws-region": config.awsRegion = args[i + 1]; i += 2; break;
      default:
        console.error(`Unknown argument: ${key}`);
        process.exit(1);
    }
  }

  if (!config.inputDir || !config.network || !config.station) {
    console.error("Usage: npx tsx scripts/seismic/generate-envelopes.ts \\");
    console.error("  --input-dir <path> --network <net> --station <sta> \\");
    console.error("  [--channel <chan>] [--output-dir <path>] [--local-only]");
    console.error("  [--s3-bucket <bucket>] [--s3-prefix <prefix>] [--aws-region <region>]");
    process.exit(1);
  }

  if (config.localOnly && !config.outputDir) {
    console.error("--output-dir is required when --local-only is set");
    process.exit(1);
  }

  return config as ScriptConfig;
}
```

**Step 2: Commit**

```bash
git add scripts/seismic/generate-envelopes.ts
git commit -m "feat: add --local-only flag to parseArgs in generate-envelopes"
```

---

## Task 2: Sort ROVER files numerically by date

**Files:**
- Modify: `scripts/seismic/generate-envelopes.ts`

The current `findRoverFiles` iterates directory entries from `readdirSync`, which does not guarantee numeric order. The pipeline requires files in chronological order so that L2 points arrive in monotonically increasing time.

**Step 1: Add numeric sorting to `findRoverFiles`**

Sort the year and day-of-year directory entries numerically during iteration:

```typescript
function findRoverFiles(dataRoot: string, network: string, station: string): string[] {
  const networkDir = join(dataRoot, network);
  const files: string[] = [];

  const years = readdirSync(networkDir).sort((a, b) => Number(a) - Number(b));
  for (const year of years) {
    const yearDir = join(networkDir, year);
    if (!statSync(yearDir).isDirectory()) continue;
    const days = readdirSync(yearDir).sort((a, b) => Number(a) - Number(b));
    for (const day of days) {
      const dayDir = join(yearDir, day);
      if (!statSync(dayDir).isDirectory()) continue;
      const expected = `${station}.${network}.${year}.${day}`;
      const filePath = join(dayDir, expected);
      try {
        statSync(filePath);
        files.push(filePath);
      } catch {
        // File doesn't exist for this day — skip
      }
    }
  }

  return files;
}
```

**Step 2: Commit**

```bash
git add scripts/seismic/generate-envelopes.ts
git commit -m "feat: sort ROVER files numerically by year and day-of-year"
```

---

## Task 3: Create pipeline module with types and `createPipelineState`

**Files:**
- Create: `shared/seismic/envelope-pipeline.ts`
- Create: `shared/seismic/envelope-pipeline.test.ts`

**Step 1: Write the failing test**

```typescript
// shared/seismic/envelope-pipeline.test.ts
import { createPipelineState } from "./envelope-pipeline";
import { NUM_LEVELS } from "./envelope-config";

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
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest --no-watchman shared/seismic/envelope-pipeline.test.ts`
Expected: FAIL — module does not exist.

**Step 3: Write minimal implementation**

```typescript
// shared/seismic/envelope-pipeline.ts
import { NUM_LEVELS } from "./envelope-config";
import type { EnvelopeTileData } from "./seismic-types";

/** Running min/max accumulator for a single coarser-level point. Values are quantized Int16. */
export interface AccumulatorEntry {
  min: number;
  max: number;
}

/** Mutable pipeline state for incremental envelope tile generation. */
export interface PipelineState {
  /** Open (partially filled) tiles, one Map<tileIndex, tileData> per level. */
  openTiles: Map<number, EnvelopeTileData>[];
  /** L1 point accumulators, keyed by global L1 point index. */
  l1Accumulators: Map<number, AccumulatorEntry>;
  /** L0 point accumulators, keyed by global L0 point index. */
  l0Accumulators: Map<number, AccumulatorEntry>;
  /** Global L2 point index of the most recently processed L2 point. */
  highestL2GlobalIndex: number;
}

/** Callback invoked when a tile is complete and ready for output (disk/S3). */
export type FlushTileFn = (level: number, tileIndex: number, tileData: EnvelopeTileData) => void;

export function createPipelineState(): PipelineState {
  const openTiles: Map<number, EnvelopeTileData>[] = [];
  for (let i = 0; i < NUM_LEVELS; i++) {
    openTiles.push(new Map());
  }
  return {
    openTiles,
    l1Accumulators: new Map(),
    l0Accumulators: new Map(),
    highestL2GlobalIndex: -1,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest --no-watchman shared/seismic/envelope-pipeline.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add shared/seismic/envelope-pipeline.ts shared/seismic/envelope-pipeline.test.ts
git commit -m "feat: add pipeline state types and createPipelineState"
```

---

## Task 4: Implement `placePointInTile`

**Files:**
- Modify: `shared/seismic/envelope-pipeline.ts`
- Modify: `shared/seismic/envelope-pipeline.test.ts`

This helper places a single quantized envelope point into the correct open tile, creating the tile if it doesn't exist yet.

**Step 1: Write the failing test**

```typescript
import { createPipelineState, placePointInTile } from "./envelope-pipeline";
import { LEVEL_SPACINGS, POINTS_PER_TILE, NO_DATA_SENTINEL } from "./envelope-config";
import { getTileIndex, getTileTimeRange, getPointIndexInTile } from "./tile-addressing";

describe("placePointInTile", () => {
  it("creates a new tile and places a point at the correct offset", () => {
    const tiles = new Map();
    const level = 2;
    // Use a time that falls in tile 0
    const time = 100; // 100 seconds from epoch
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

    // Check that a different position is still sentinel
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
```

**Step 2: Run test to verify it fails**

Run: `npx jest --no-watchman shared/seismic/envelope-pipeline.test.ts`
Expected: FAIL — `placePointInTile` is not exported.

**Step 3: Write minimal implementation**

Add to `shared/seismic/envelope-pipeline.ts`:

```typescript
import { POINTS_PER_TILE, NO_DATA_SENTINEL } from "./envelope-config";
import { getTileIndex, getPointIndexInTile } from "./tile-addressing";

/**
 * Place a single quantized envelope point into the correct open tile.
 * Creates the tile (filled with NO_DATA_SENTINEL) if it doesn't exist.
 */
export function placePointInTile(
  tiles: Map<number, EnvelopeTileData>,
  level: number,
  time: number,
  qMin: number,
  qMax: number,
): void {
  const tileIdx = getTileIndex(time, level);
  if (!tiles.has(tileIdx)) {
    const pointsPerTile = POINTS_PER_TILE[level];
    const mins = new Int16Array(pointsPerTile).fill(NO_DATA_SENTINEL);
    const maxs = new Int16Array(pointsPerTile).fill(NO_DATA_SENTINEL);
    tiles.set(tileIdx, { mins, maxs });
  }
  const tile = tiles.get(tileIdx)!;
  const pointIndex = getPointIndexInTile(time, level, tileIdx);
  if (pointIndex >= 0 && pointIndex < POINTS_PER_TILE[level]) {
    tile.mins[pointIndex] = qMin;
    tile.maxs[pointIndex] = qMax;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest --no-watchman shared/seismic/envelope-pipeline.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add shared/seismic/envelope-pipeline.ts shared/seismic/envelope-pipeline.test.ts
git commit -m "feat: add placePointInTile helper for incremental tile filling"
```

---

## Task 5: Implement `processL2Point`

**Files:**
- Modify: `shared/seismic/envelope-pipeline.ts`
- Modify: `shared/seismic/envelope-pipeline.test.ts`

This is the core per-point function. For each L2 envelope point it: places it into the L2 tile, updates `highestL2GlobalIndex`, and updates the L1 accumulator.

**Step 1: Write the failing test**

```typescript
import { createPipelineState, processL2Point } from "./envelope-pipeline";
import { LEVEL_SPACINGS, K_FACTOR } from "./envelope-config";
import { getTileIndex, getTileTimeRange } from "./tile-addressing";

describe("processL2Point", () => {
  it("places point in L2 tile and updates highestL2GlobalIndex", () => {
    const state = createPipelineState();
    const time = 1000;
    processL2Point(state, time, -500, 500);

    const expectedL2Global = Math.floor(time / LEVEL_SPACINGS[2]);
    expect(state.highestL2GlobalIndex).toBe(expectedL2Global);

    // L2 tile should exist with the point
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
    // Two L2 points that map to the same L1 point
    const time1 = 0;
    const time2 = LEVEL_SPACINGS[2]; // next L2 point, still same L1 window
    processL2Point(state, time1, -200, 300);
    processL2Point(state, time2, -500, 100);

    const l2Global = Math.floor(time1 / LEVEL_SPACINGS[2]);
    const l1Global = Math.floor(l2Global / K_FACTOR);
    const acc = state.l1Accumulators.get(l1Global)!;
    expect(acc.min).toBe(-500); // min of -200, -500
    expect(acc.max).toBe(300);  // max of 300, 100
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest --no-watchman shared/seismic/envelope-pipeline.test.ts`
Expected: FAIL — `processL2Point` is not exported.

**Step 3: Write minimal implementation**

Add to `shared/seismic/envelope-pipeline.ts`:

```typescript
import { K_FACTOR } from "./envelope-config";

/**
 * Process a single quantized L2 envelope point:
 * 1. Place into the L2 open tile
 * 2. Update highestL2GlobalIndex
 * 3. Update the L1 accumulator for the corresponding L1 point
 */
export function processL2Point(
  state: PipelineState,
  time: number,
  qMin: number,
  qMax: number,
): void {
  // 1. Place into L2 tile
  placePointInTile(state.openTiles[2], 2, time, qMin, qMax);

  // 2. Update highest index
  const l2GlobalIndex = Math.floor(time / LEVEL_SPACINGS[2]);
  if (l2GlobalIndex > state.highestL2GlobalIndex) {
    state.highestL2GlobalIndex = l2GlobalIndex;
  }

  // 3. Update L1 accumulator
  const l1GlobalIndex = Math.floor(l2GlobalIndex / K_FACTOR);
  const existing = state.l1Accumulators.get(l1GlobalIndex);
  if (existing) {
    if (qMin < existing.min) existing.min = qMin;
    if (qMax > existing.max) existing.max = qMax;
  } else {
    state.l1Accumulators.set(l1GlobalIndex, { min: qMin, max: qMax });
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest --no-watchman shared/seismic/envelope-pipeline.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add shared/seismic/envelope-pipeline.ts shared/seismic/envelope-pipeline.test.ts
git commit -m "feat: add processL2Point for incremental L2→L1 accumulation"
```

---

## Task 6: Implement `flushTiles`

**Files:**
- Modify: `shared/seismic/envelope-pipeline.ts`
- Modify: `shared/seismic/envelope-pipeline.test.ts`

A single `flushTiles` function handles both incremental flushing (after each file) and final flushing (after all files). When `force` is false (default), only completed state is flushed — accumulators and tiles whose index is strictly less than the current index. When `force` is true, all remaining accumulators are finalized and all open tiles are flushed.

**Step 1: Write the failing tests**

```typescript
import {
  createPipelineState, processL2Point, flushTiles
} from "./envelope-pipeline";
import { LEVEL_SPACINGS, K_FACTOR, POINTS_PER_TILE, NO_DATA_SENTINEL } from "./envelope-config";
import { getTileIndex } from "./tile-addressing";
import type { EnvelopeTileData } from "./seismic-types";

describe("flushTiles", () => {
  describe("incremental (force = false)", () => {
    it("flushes completed L1 accumulators into L1 tiles and creates L0 accumulators", () => {
      const state = createPipelineState();
      const flushedTiles: Array<{ level: number; tileIndex: number }> = [];
      const flushTile = (level: number, tileIndex: number) => {
        flushedTiles.push({ level, tileIndex });
      };

      // Feed enough L2 points to complete at least one L1 point.
      // One L1 point = K_FACTOR (100) consecutive L2 points.
      // We need to advance past the first L1 point, so feed K_FACTOR + 1 L2 points.
      const l2Spacing = LEVEL_SPACINGS[2];
      for (let i = 0; i <= K_FACTOR; i++) {
        processL2Point(state, i * l2Spacing, -100, 100);
      }

      // Before flush: L1 accumulators should exist
      expect(state.l1Accumulators.size).toBeGreaterThanOrEqual(1);

      flushTiles(state, flushTile);

      // The first L1 accumulator (index 0) should be flushed → placed into L1 tile
      // and an L0 accumulator should be created
      expect(state.l1Accumulators.has(0)).toBe(false);
      expect(state.l0Accumulators.size).toBeGreaterThanOrEqual(1);

      // The L1 tile should have data at position 0
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

      // Feed enough L2 points to fill an entire L2 tile and advance to the next.
      // L2 tile has POINTS_PER_TILE[2] points. We need to go one point past.
      const l2Spacing = LEVEL_SPACINGS[2];
      const l2PointsPerTile = POINTS_PER_TILE[2];
      for (let i = 0; i <= l2PointsPerTile; i++) {
        processL2Point(state, i * l2Spacing, -100, 100);
      }

      flushTiles(state, flushTile);

      // The first L2 tile (index 0) should have been flushed
      const l2Flushes = flushedTiles.filter(t => t.level === 2);
      expect(l2Flushes.length).toBe(1);
      expect(l2Flushes[0].tileIndex).toBe(0);

      // And removed from open tiles
      expect(state.openTiles[2].has(0)).toBe(false);
    });

    it("does not flush the current (in-progress) tile or accumulator", () => {
      const state = createPipelineState();
      const flushedTiles: Array<{ level: number; tileIndex: number }> = [];
      const flushTile = (level: number, tileIndex: number) => {
        flushedTiles.push({ level, tileIndex });
      };

      // Feed just a few points — nothing should be complete
      const l2Spacing = LEVEL_SPACINGS[2];
      for (let i = 0; i < 5; i++) {
        processL2Point(state, i * l2Spacing, -100, 100);
      }

      flushTiles(state, flushTile);

      // Nothing should be flushed — we're still in the first L1 window and first tiles
      expect(flushedTiles.length).toBe(0);
      expect(state.l1Accumulators.size).toBe(1); // still accumulating
    });
  });

  describe("final (force = true)", () => {
    it("finalizes all accumulators and flushes all remaining tiles", () => {
      const state = createPipelineState();
      const flushedTiles: Array<{ level: number; tileIndex: number; tileData: EnvelopeTileData }> = [];
      const flushTile = (level: number, tileIndex: number, tileData: EnvelopeTileData) => {
        flushedTiles.push({ level, tileIndex, tileData });
      };

      // Feed a handful of L2 points — not enough to complete any L1 point
      const l2Spacing = LEVEL_SPACINGS[2];
      for (let i = 0; i < 5; i++) {
        processL2Point(state, i * l2Spacing, -300, 300);
      }

      flushTiles(state, flushTile, true);

      // All accumulators should be cleared
      expect(state.l1Accumulators.size).toBe(0);
      expect(state.l0Accumulators.size).toBe(0);

      // All open tiles should be cleared
      for (let level = 0; level < 3; level++) {
        expect(state.openTiles[level].size).toBe(0);
      }

      // Should have flushed tiles at all 3 levels (L2, L1, L0)
      const levels = new Set(flushedTiles.map(t => t.level));
      expect(levels.has(0)).toBe(true);
      expect(levels.has(1)).toBe(true);
      expect(levels.has(2)).toBe(true);

      // Flushed tiles should contain real data (not all sentinels)
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

      // Feed exactly K_FACTOR L2 points to form one complete L1 point
      const l2Spacing = LEVEL_SPACINGS[2];
      for (let i = 0; i < K_FACTOR; i++) {
        // Vary the values so min/max accumulation is exercised
        const qMin = -(i + 1) * 10;
        const qMax = (i + 1) * 10;
        processL2Point(state, i * l2Spacing, qMin, qMax);
      }

      flushTiles(state, flushTile, true);

      // Find the L1 tile
      const l1Tile = flushedTiles.find(t => t.level === 1);
      expect(l1Tile).toBeDefined();

      // The L1 point should have min = most negative, max = most positive
      const l1Data = l1Tile!.tileData;
      const firstNonSentinel = l1Data.mins.findIndex(v => v !== NO_DATA_SENTINEL);
      expect(firstNonSentinel).toBeGreaterThanOrEqual(0);
      expect(l1Data.mins[firstNonSentinel]).toBe(-K_FACTOR * 10);
      expect(l1Data.maxs[firstNonSentinel]).toBe(K_FACTOR * 10);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest --no-watchman shared/seismic/envelope-pipeline.test.ts`
Expected: FAIL — `flushTiles` is not exported.

**Step 3: Write minimal implementation**

Add to `shared/seismic/envelope-pipeline.ts`:

```typescript
/**
 * Flush pipeline state — accumulators into coarser tiles, then completed tiles via callback.
 *
 * When `force` is false (default), only flush state that is strictly behind the current
 * processing position — the current accumulator and tile remain open.
 *
 * When `force` is true, finalize ALL remaining accumulators and flush ALL open tiles.
 * Use this after all files have been processed.
 */
export function flushTiles(state: PipelineState, flushTile: FlushTileFn, force = false): void {
  const currentL1Index = Math.floor(state.highestL2GlobalIndex / K_FACTOR);
  const currentL0Index = Math.floor(currentL1Index / K_FACTOR);

  // 1. Flush L1 accumulators → L1 tiles, update L0 accumulators
  for (const [l1Index, acc] of state.l1Accumulators) {
    if (force || l1Index < currentL1Index) {
      const l1Time = l1Index * LEVEL_SPACINGS[1];
      placePointInTile(state.openTiles[1], 1, l1Time, acc.min, acc.max);

      const l0Index = Math.floor(l1Index / K_FACTOR);
      const l0Acc = state.l0Accumulators.get(l0Index);
      if (l0Acc) {
        if (acc.min < l0Acc.min) l0Acc.min = acc.min;
        if (acc.max > l0Acc.max) l0Acc.max = acc.max;
      } else {
        state.l0Accumulators.set(l0Index, { min: acc.min, max: acc.max });
      }

      state.l1Accumulators.delete(l1Index);
    }
  }

  // 2. Flush L0 accumulators → L0 tiles
  for (const [l0Index, acc] of state.l0Accumulators) {
    if (force || l0Index < currentL0Index) {
      const l0Time = l0Index * LEVEL_SPACINGS[0];
      placePointInTile(state.openTiles[0], 0, l0Time, acc.min, acc.max);
      state.l0Accumulators.delete(l0Index);
    }
  }

  // 3. Flush completed (or all) tiles at each level
  const currentTileIndex = [
    getTileIndex(currentL0Index * LEVEL_SPACINGS[0], 0),
    getTileIndex(currentL1Index * LEVEL_SPACINGS[1], 1),
    getTileIndex(state.highestL2GlobalIndex * LEVEL_SPACINGS[2], 2),
  ];
  for (let level = 0; level < NUM_LEVELS; level++) {
    for (const [tileIdx, tileData] of state.openTiles[level]) {
      if (force || tileIdx < currentTileIndex[level]) {
        flushTile(level, tileIdx, tileData);
        state.openTiles[level].delete(tileIdx);
      }
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest --no-watchman shared/seismic/envelope-pipeline.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add shared/seismic/envelope-pipeline.ts shared/seismic/envelope-pipeline.test.ts
git commit -m "feat: add flushTiles for incremental and final pipeline state flushing"
```

---

## Task 7: Rewrite `main()` with pipeline architecture

**Files:**
- Modify: `scripts/seismic/generate-envelopes.ts`

This task rewires the script's `main()` to use the pipeline. The batch approach (load all → assemble all → upload all) is replaced with file-at-a-time streaming.

**Step 1: Add a `flushTile` function to the script**

This handles the I/O side — encoding and writing to disk and/or S3:

```typescript
function makeFlushTile(
  config: ScriptConfig,
  s3: S3Client | null,
): FlushTileFn {
  let flushedCount = 0;
  return (level: number, tileIndex: number, tileData: EnvelopeTileData) => {
    const tileKey = getTileS3Key(config.station, channel, level, tileIndex);
    const body = encodeEnvelopeTile(tileData.mins, tileData.maxs);
    const bodyBytes = new Uint8Array(body);

    if (config.outputDir) {
      const filePath = join(config.outputDir, tileKey);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, bodyBytes);
    }

    if (s3) {
      // S3 upload is async but we're in a sync callback — collect promises
      // (handled below via an async wrapper)
    }

    flushedCount++;
    if (flushedCount % 100 === 0) {
      console.log(`  Flushed ${flushedCount} tile(s)...`);
    }
  };
}
```

Since the `FlushTileFn` type is synchronous but S3 uploads are async, use one of these approaches:
- **Option A (simpler):** Collect S3 upload promises in an array, await them in batches after each `flushTiles` call.
- **Option B:** Make `FlushTileFn` async and await each call.

Use Option A to avoid changing the pipeline module's type signature. The flush callback pushes upload promises into a `pendingUploads` array. After each `flushTiles` call, the script awaits all pending uploads.

```typescript
// In the script, outside the pipeline module:
const pendingUploads: Promise<void>[] = [];

function makeFlushTile(
  station: string,
  channel: string,
  config: ScriptConfig,
  s3: S3Client | null,
  pendingUploads: Promise<void>[],
): FlushTileFn {
  let flushedCount = 0;
  return (level: number, tileIndex: number, tileData: EnvelopeTileData) => {
    const tileKey = getTileS3Key(station, channel, level, tileIndex);
    const body = encodeEnvelopeTile(tileData.mins, tileData.maxs);
    const bodyBytes = new Uint8Array(body);

    if (config.outputDir) {
      const filePath = join(config.outputDir, tileKey);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, bodyBytes);
    }

    if (s3) {
      pendingUploads.push(
        s3.send(new PutObjectCommand({
          Bucket: config.s3Bucket,
          Key: `${config.s3Prefix}${tileKey}`,
          Body: bodyBytes,
          ContentType: "application/octet-stream",
          ContentEncoding: "gzip",
        }))
      );
    }

    flushedCount++;
    if (flushedCount % 100 === 0) {
      console.log(`  Flushed ${flushedCount} tile(s)...`);
    }
  };
}
```

**Step 2: Add per-file loading function**

Replace `loadMiniSeedFiles` (which loads ALL files) with a function that loads one file:

```typescript
function loadMiniSeedFile(filePath: string): RawTrace[] {
  const buffer = readFileSync(filePath);
  const arrayBuf = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const records = miniseed.parseDataRecords(arrayBuf);
  const seismograms = miniseed.seismogramPerChannel(records);

  const traces: RawTrace[] = [];
  for (const seis of seismograms) {
    for (const seg of seis.segments) {
      traces.push({
        channel: seis.channelCode,
        sampleRate: seg.sampleRate,
        startTime: seg.startTime.toSeconds(),
        samples: new Float64Array(seg.y),
      });
    }
  }
  return traces;
}
```

**Step 3: Rewrite `main()` to use the pipeline**

```typescript
async function main() {
  const config = parseArgs();

  // 1. Find and sort ROVER files
  console.log(`Finding ROVER files in ${config.inputDir} for ${config.network}.${config.station}...`);
  const files = findRoverFiles(config.inputDir, config.network, config.station);
  if (files.length === 0) {
    throw new Error(`No ROVER files found for ${config.network}.${config.station} in ${config.inputDir}`);
  }
  console.log(`Found ${files.length} ROVER file(s)`);

  // 2. Fetch station metadata
  console.log(`Fetching station metadata for ${config.network}.${config.station}...`);
  const metadata = await fetchStationMetadata(config.network, config.station);
  console.log(`  Found ${metadata.length} channel(s)`);

  // 3. First pass: determine which channels are present
  // Load the first file to discover channels
  const firstFileTraces = loadMiniSeedFile(files[0]);
  const channelsFound = new Set(firstFileTraces.map(t => t.channel));
  const channelsToProcess = config.channel
    ? [config.channel]
    : [...channelsFound];

  // 4. Set up S3 (if not --local-only)
  const s3 = config.localOnly ? null : new S3Client({ region: config.awsRegion });

  // 5. Process each channel
  for (const channel of channelsToProcess) {
    console.log(`\nProcessing channel ${channel}...`);

    // Determine instrument type and amplitude range
    const firstTrace = firstFileTraces.find(t => t.channel === channel);
    if (!firstTrace) {
      console.warn(`No traces for channel ${channel}, skipping`);
      continue;
    }
    const { instrumentCode } = findSensitivity(metadata, channel, firstTrace.startTime);
    const rangeMax = AMPLITUDE_RANGES[instrumentCode];
    if (!rangeMax) {
      console.warn(`Unknown instrument code "${instrumentCode}" for channel ${channel}, skipping`);
      continue;
    }
    console.log(`  Instrument: ${instrumentCode}, range: ±${rangeMax}`);

    // Wipe existing tiles (S3 mode only)
    if (s3) {
      await wipeExistingTiles(s3, config.s3Bucket, config.s3Prefix, config.station, channel);
    }

    // Initialize pipeline state
    const state = createPipelineState();
    const pendingUploads: Promise<void>[] = [];
    const flushTile = makeFlushTile(config.station, channel, config, s3, pendingUploads);
    const finestLevel = NUM_LEVELS - 1;

    // Stream-process each file
    for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
      const filePath = files[fileIdx];
      console.log(`  Processing file ${fileIdx + 1}/${files.length}: ${filePath}`);
      const traces = loadMiniSeedFile(filePath);

      // Filter to target channel and sort by start time
      const channelTraces = traces
        .filter(t => t.channel === channel)
        .sort((a, b) => a.startTime - b.startTime);

      for (const trace of channelTraces) {
        const { scale } = findSensitivity(metadata, channel, trace.startTime);
        const physicalSamples = new Float64Array(trace.samples.length);
        for (let i = 0; i < trace.samples.length; i++) {
          physicalSamples[i] = trace.samples[i] / scale;
        }

        const { mins, maxs } = computeEnvelopesFromRaw(
          physicalSamples, trace.sampleRate, LEVEL_SPACINGS[finestLevel]
        );

        for (let i = 0; i < mins.length; i++) {
          const time = trace.startTime + i * LEVEL_SPACINGS[finestLevel];
          const qMin = quantize(mins[i], rangeMax);
          const qMax = quantize(maxs[i], rangeMax);
          processL2Point(state, time, qMin, qMax);
        }
      }

      // Flush completed state after each file
      flushTiles(state, flushTile);
      if (pendingUploads.length > 0) {
        await Promise.all(pendingUploads);
        pendingUploads.length = 0;
      }
      // traces go out of scope here — memory released
    }

    // Final flush
    flushTiles(state, flushTile, true);
    if (pendingUploads.length > 0) {
      await Promise.all(pendingUploads);
    }

    console.log(`  Channel ${channel} complete.`);
  }

  console.log("\nDone!");
}
```

**Step 4: Update imports**

Add imports for the pipeline module at the top of the script:

```typescript
import {
  createPipelineState, processL2Point, flushTiles
} from "../../shared/seismic/envelope-pipeline.js";
import type { FlushTileFn } from "../../shared/seismic/envelope-pipeline.js";
```

**Step 5: Run all seismic tests to verify nothing is broken**

Run: `npx jest --no-watchman shared/seismic/`
Expected: All tests PASS.

**Step 6: Commit**

```bash
git add scripts/seismic/generate-envelopes.ts
git commit -m "feat: rewrite main() to stream-process ROVER files through pipeline"
```

---

## Task 8: Remove dead code

**Files:**
- Modify: `scripts/seismic/generate-envelopes.ts`

The following functions are no longer used after the pipeline rewrite:

- `loadMiniSeedFiles` — replaced by `loadMiniSeedFile` (single file) + `findRoverFiles`
- `assembleTiles` — replaced by `placePointInTile` in the pipeline module
- `uploadTiles` — replaced by `makeFlushTile`

Also remove the now-unused `rollUpEnvelopes` import (the pipeline accumulators replace it).

**Step 1: Delete the three functions and update imports**

Remove `loadMiniSeedFiles`, `assembleTiles`, and `uploadTiles` function definitions. Remove `rollUpEnvelopes` from the import of `envelope-compute.js`. Remove `EnvelopePoint` from the type import if no longer referenced.

**Step 2: Run all seismic tests**

Run: `npx jest --no-watchman shared/seismic/`
Expected: All tests PASS.

**Step 3: Run TypeScript type check on the script**

Run: `npx tsc --noEmit scripts/seismic/generate-envelopes.ts --esModuleInterop --moduleResolution node --target es2020 --module es2020`

If this doesn't work due to project tsconfig, alternatively: `npx tsx --eval "import './scripts/seismic/generate-envelopes.js'"` to verify the script at least parses without errors. Or rely on the existing `npm run check:types`.

Expected: No type errors.

**Step 4: Commit**

```bash
git add scripts/seismic/generate-envelopes.ts
git commit -m "chore: remove dead code replaced by pipeline architecture"
```

---

## Task 9: Manual integration verification

**Files:** None (verification only)

**Step 1: Run the script in `--local-only` mode with test data**

If ROVER test data is available locally:

```bash
npx tsx scripts/seismic/generate-envelopes.ts \
  --input-dir /path/to/rover/data \
  --network AK --station K204 --channel HNZ \
  --output-dir /tmp/envelope-test \
  --local-only
```

Verify:
- Script completes without error
- Output directory contains tile files organized as `K204/HNZ/L0/`, `K204/HNZ/L1/`, `K204/HNZ/L2/`
- L2 has the most tiles, L0 has 1–2
- Tile files are non-empty binary (gzipped)

**Step 2: Compare output with previous script (if old tiles exist)**

If tiles were previously generated with the old batch script, compare tile counts and spot-check a few tile contents using a quick script or hex dump. The pipeline should produce identical output.

**Step 3: Verify `--local-only` skips S3**

Run without AWS credentials configured. With `--local-only`, the script should succeed. Without `--local-only`, it should fail trying to create the S3 client.

**Step 4: Commit any final adjustments**

```bash
git add -A
git commit -m "chore: final adjustments from integration verification"
```
