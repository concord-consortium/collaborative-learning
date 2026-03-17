// shared/seismic/tile-addressing.ts
import { LEVEL_SPACINGS, POINTS_PER_TILE } from "./envelope-config";
import type { TimeRange } from "./seismic-types";

/** Duration of one tile in seconds at the given level. */
export function getTileDuration(level: number): number {
  return LEVEL_SPACINGS[level] * POINTS_PER_TILE[level];
}

/**
 * Returns the tile index that contains the given timestamp (seconds since Unix epoch).
 */
export function getTileIndex(timestamp: number, level: number): number {
  return Math.floor(timestamp / getTileDuration(level));
}

/**
 * Returns the time range [start, end) in seconds for a given tile.
 */
export function getTileTimeRange(level: number, tileIndex: number): TimeRange {
  const duration = getTileDuration(level);
  return {
    start: tileIndex * duration,
    end: (tileIndex + 1) * duration,
  };
}

/**
 * Returns all tile indices that overlap the viewport [startTime, endTime).
 * Returns an empty array if startTime >= endTime.
 */
export function getTileIndicesForViewport(startTime: number, endTime: number, level: number): number[] {
  if (startTime >= endTime) return [];
  const firstTile = getTileIndex(startTime, level);
  // endTime is exclusive — subtract a tiny epsilon so we don't include the next tile
  // if endTime falls exactly on a tile boundary.
  const lastTile = getTileIndex(endTime - 1e-9, level);
  const indices: number[] = [];
  for (let i = firstTile; i <= lastTile; i++) {
    indices.push(i);
  }
  return indices;
}

/**
 * Constructs the S3 object key for a tile.
 * Format: {station}/{channel}/L{level}/{tileIndex}
 */
export function getTileS3Key(station: string, channel: string, level: number, tileIndex: number): string {
  return `${station}/${channel}/L${level}/${tileIndex}`;
}
