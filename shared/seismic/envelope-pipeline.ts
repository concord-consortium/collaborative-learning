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
