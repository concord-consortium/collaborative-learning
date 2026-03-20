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
