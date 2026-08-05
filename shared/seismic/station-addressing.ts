import type { StationData, StationId } from "./seismic-types";

// Station/channel path segments, shared by every storage layer that addresses data by
// station: envelope tile keys, event doc ids, and the OPFS raw-data cache.

/**
 * Constructs the path prefix for a given station.
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
 * Constructs the path prefix for a given station, location, and channel.
 * Format: {network}_{station}/{location}/{channel}
 */
export function getStationChannelPrefix(stationData: StationData): string {
  const { channel, location } = stationData;
  return `${getStationPrefix(stationData)}/${encodeLocation(location)}/${channel}`;
}

export function getLevelPrefix(stationData: StationData): string {
  return `${getStationChannelPrefix(stationData)}/L`;
}

export function getLevelPath(stationData: StationData, level: number): string {
  return `${getLevelPrefix(stationData)}${level}`;
}
