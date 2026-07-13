import { ENVELOPE_LAYOUT_VERSION, LEVEL_SPACINGS, POINTS_PER_TILE } from "./envelope-config";
import type { StationData, StationId, TimeRange } from "./seismic-types";

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
 * Returns the point index within a tile for a given timestamp.
 */
export function getPointIndexInTile(timestamp: number, level: number, tileIndex: number): number {
  const tileRange = getTileTimeRange(level, tileIndex);
  return Math.floor((timestamp - tileRange.start) / LEVEL_SPACINGS[level]);
}

/**
 * Constructs the S3 key prefix for all tiles of a given station.
 * Format: {network}_{station}
 */
export function getStationPrefix(station: StationId): string {
  return `${station.network}_${station.station}`;
}

/**
 * Inverse of getStationPrefix: "{network}_{station}" → { network, station }.
 */
export function parseStationPrefix(prefix: string): StationId | undefined {
  const sep = prefix.indexOf("_");
  if (sep < 0) return undefined;

  const network = prefix.slice(0, sep);
  const station = prefix.slice(sep + 1);
  if (!network || ! station) return undefined;

  return { network, station };
}

/** Encode a SEED location code as a path segment. Blank (undefined or "") becomes "--". */
export function encodeLocation(location?: string): string {
  return location ? location : "--";
}

/** Inverse of encodeLocation: "--" becomes "". */
export function decodeLocation(segment: string): string {
  return segment === "--" ? "" : segment;
}

/**
 * Constructs the S3 key prefix for all tiles of a given station, location, and channel.
 * Format: {network}_{station}/{location}/{channel}
 */
export function getStationChannelPrefix(stationData: StationData): string {
  const { channel, location } = stationData;
  return `${getStationPrefix(stationData)}/${encodeLocation(location)}/${channel}`;
}

/**
 * Constructs the S3 object key for a tile.
 * Format: {network}_{station}/{location}/{channel}/L{level}/{tileIndex}
 */
export function getTileS3Key(stationData: StationData, level: number, tileIndex: number): string {
  return `${getStationChannelPrefix(stationData)}/L${level}/${tileIndex}`;
}

/**
 * Constructs the S3 root for tile keys, which includes the current layout version.
 */
export function getS3Root(prefix: string) {
  return `${prefix}v${ENVELOPE_LAYOUT_VERSION}/`;
}
