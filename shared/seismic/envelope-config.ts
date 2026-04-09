// shared/seismic/envelope-config.ts

/**
 * Envelope tile cache level configuration.
 *
 * Level spacings must satisfy the integer multiple constraint:
 * each level's spacing must be an exact integer multiple of the next finer level.
 *
 * Starting configuration: L0 targets ~6 months, K = 100.
 * See docs/seismic/envelope-tile-cache-design.md for rationale.
 */

/** Layout version -- update this when other constants change */
export const ENVELOPE_LAYOUT_VERSION = 1;

/** ~6 months */
export const L0_SPACING = 15750;

/** Scale factor between adjacent levels. */
export const K_FACTOR = 100;

/** Point spacing in seconds for each level, coarsest (L0) to finest (L2). */
export const LEVEL_SPACINGS = [L0_SPACING, L0_SPACING / K_FACTOR, L0_SPACING / (K_FACTOR ** 2)];

/** Number of envelope points per tile for L0 and L1. */
export const BASE_POINTS_PER_TILE = 1000;

/** L2 uses more points per tile to reduce total tile count. */
export const L2_TILE_MULTIPLIER = 20;

/**
 * Number of envelope points per tile, indexed by level.
 * L0/L1: 1000 points, L2: 20000 points.
 */
export const POINTS_PER_TILE = [
  BASE_POINTS_PER_TILE, BASE_POINTS_PER_TILE, BASE_POINTS_PER_TILE * L2_TILE_MULTIPLIER
];

/** Number of stored envelope levels. */
export const NUM_LEVELS = LEVEL_SPACINGS.length;

/**
 * Fixed amplitude range per instrument type (second char of SEED channel code).
 * Physical units: H/L = m/s (velocity), N = m/s² (acceleration).
 */
export const AMPLITUDE_RANGES: Record<string, number> = {
  H: 0.05,  // High-gain seismometer, ±0.05 m/s
  L: 0.05,  // Low-gain seismometer, ±0.05 m/s
  N: 40,    // Accelerometer, ±40 m/s²
};

/** Sentinel value for "no data" in Int16 envelope arrays. */
export const NO_DATA_SENTINEL = -32768;

/** S3 bucket where envelope tiles are stored. */
export const S3_BUCKET = "models-resources";

/** S3 key prefix for envelope tiles. */
export const S3_PREFIX = "collaborative-learning/envelopes/";

/** Duration of each raw data fetch chunk in seconds. */
export const RAW_CHUNK_DURATION = 7200; // 2 hours
