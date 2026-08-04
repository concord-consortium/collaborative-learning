import { ChannelMetadata, StationChannel } from "./seismic-types";

/**
 * Finds the metadata entry matching the station's channel and location (blank and undefined
 * location are equivalent) covering timeSec. Falls back to the last matching entry when no
 * epoch covers timeSec; returns undefined when the channel/location has no entries at all.
 */
export function getMetadataForChannel(
  metadata: ChannelMetadata[], station: StationChannel, timeSec: number
): ChannelMetadata | undefined {
  const location = station.location ?? "";
  const matching = metadata.filter(m => m.channel === station.channel && (m.location ?? "") === location);
  for (const m of matching) {
    const start = new Date(m.startTime).getTime() / 1000;
    const end = m.endTime === "" ? Infinity : new Date(m.endTime).getTime() / 1000;
    if (timeSec >= start && timeSec < end) return m;
  }
  // When no time matches, return the last metadata (or undefined if there aren't any)
  return matching[matching.length - 1];
}
