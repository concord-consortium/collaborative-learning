// shared/seismic/envelope-pipeline.ts
import { NUM_LEVELS, POINTS_PER_TILE, NO_DATA_SENTINEL, LEVEL_SPACINGS, K_FACTOR } from "./envelope-config";
import { getTileIndex, getPointIndexInTile } from "./tile-addressing";
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
  placePointInTile(state.openTiles[2], 2, time, qMin, qMax);

  const l2GlobalIndex = Math.floor(time / LEVEL_SPACINGS[2]);
  if (l2GlobalIndex > state.highestL2GlobalIndex) {
    state.highestL2GlobalIndex = l2GlobalIndex;
  }

  const l1GlobalIndex = Math.floor(l2GlobalIndex / K_FACTOR);
  const existing = state.l1Accumulators.get(l1GlobalIndex);
  if (existing) {
    if (qMin < existing.min) existing.min = qMin;
    if (qMax > existing.max) existing.max = qMax;
  } else {
    state.l1Accumulators.set(l1GlobalIndex, { min: qMin, max: qMax });
  }
}

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
