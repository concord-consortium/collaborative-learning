// shared/seismic/earthscope-client.ts
import { ChannelMetadata } from "./seismic-types";

const STATION_SERVICE_URL = "https://service.earthscope.org/fdsnws/station/1/query";

/**
 * Fetch channel metadata (including sensitivity) for a station from EarthScope.
 * Returns one entry per channel, each with its own Scale, time range, and sample rate.
 */
export async function fetchStationMetadata(network: string, station: string): Promise<ChannelMetadata[]> {
  const url = `${STATION_SERVICE_URL}?net=${network}&sta=${station}&level=channel&format=text`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`EarthScope station query failed: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  return parseStationText(text);
}

/**
 * Parse the pipe-delimited text response from EarthScope FDSN Station service.
 */
function parseStationText(text: string): ChannelMetadata[] {
  const lines = text.trim().split("\n");
  const channels: ChannelMetadata[] = [];

  for (const line of lines) {
    if (line.startsWith("#")) continue;
    const fields = line.split("|");
    if (fields.length < 17) continue;

    const channel = fields[3];
    channels.push({
      network: fields[0],
      station: fields[1],
      location: fields[2],
      channel,
      scale: parseFloat(fields[11]),
      scaleFreq: parseFloat(fields[12]),
      scaleUnits: fields[13],
      sampleRate: parseFloat(fields[14]),
      startTime: fields[15],
      endTime: fields[16],
      instrumentCode: channel.charAt(1),
    });
  }

  return channels;
}
