import { ChannelMetadata } from "./seismic-types.js";

/**
 * Low-level fetchers for EarthScope's FDSN web services.
 *
 * By default returns pre-staged miniSEED files from S3 (mock data).
 * When the URL parameter `seismicProxy` is present, fetches live data from
 * the Concord CloudFront proxy instead.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const STATION_SERVICE_URL = "https://service.earthscope.org/fdsnws/station/1/query";
const CLOUDFRONT_PROXY_URL = "https://seismic-data.concord.org";
const S3_BASE = "https://models-resources.s3.amazonaws.com/collaborative-learning/datasets";

function isProxyEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("seismicProxy");
}

interface MockFile {
  url: string;
  /** Inclusive start, seconds since epoch */
  startSec: number;
  /** Exclusive end, seconds since epoch */
  endSec: number;
}

function utcDay(y: number, m: number, d: number): number {
  return Date.UTC(y, m - 1, d) / 1000;
}

const MOCK_FILES: MockFile[] = [
  { url: `${S3_BASE}/2026_01_30_00_00_00-2026_01_31_00_00_00_anchorage_airport.mseed`,
    startSec: utcDay(2026, 1, 30), endSec: utcDay(2026, 1, 31) },
  { url: `${S3_BASE}/2026_01_31_00_00_00-2026_02_01_00_00_00_anchorage_airport.mseed`,
    startSec: utcDay(2026, 1, 31), endSec: utcDay(2026, 2, 1) },
  { url: `${S3_BASE}/2026_02_01_00_00_00-2026_02_02_00_00_00_anchorage_airport.mseed`,
    startSec: utcDay(2026, 2, 1), endSec: utcDay(2026, 2, 2) },
  { url: `${S3_BASE}/2026_02_02_00_00_00-2026_02_03_00_00_00_anchorage_airport.mseed`,
    startSec: utcDay(2026, 2, 2), endSec: utcDay(2026, 2, 3) },
  { url: `${S3_BASE}/2026_02_03_00_00_00-2026_02_04_00_00_00_anchorage_airport.mseed`,
    startSec: utcDay(2026, 2, 3), endSec: utcDay(2026, 2, 4) },
  { url: `${S3_BASE}/2026_02_04_00_00_00-2026_02_05_00_00_00_anchorage_airport.mseed`,
    startSec: utcDay(2026, 2, 4), endSec: utcDay(2026, 2, 5) },
  { url: `${S3_BASE}/2026_02_05_00_00_00-2026_02_06_00_00_00_anchorage_airport.mseed`,
    startSec: utcDay(2026, 2, 5), endSec: utcDay(2026, 2, 6) },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch raw seismic waveform data for a single station/channel/time range.
 *
 * **Current behaviour (mock):** Ignores network/station/channel and returns
 * the first mock file whose time range overlaps the request. Only one file is
 * returned per call — callers needing multiple days should make multiple calls
 * with day-aligned ranges.
 *
 * **Future behaviour:** Will construct an FDSN dataselect URL and fetch from
 * EarthScope's API (via CloudFront proxy).
 *
 * @returns The fetch `Response`. Callers choose how to consume it —
 *   `.arrayBuffer()`, streaming via `.body`, etc.
 * @throws On network errors or non-2xx responses (other than 404 from mock).
 */
export async function fetchRawSeismicData(
  network: string,
  station: string,
  channel: string,
  startTime: string,
  endTime: string,
  options?: {
    baseUrl?: string;
    signal?: AbortSignal;
  }
): Promise<Response> {
  if (isProxyEnabled()) {
    return fetchFromProxy(network, station, channel, startTime, endTime, options);
  }
  return fetchFromMock(startTime, endTime, options);
}

async function fetchFromProxy(
  network: string,
  station: string,
  channel: string,
  startTime: string,
  endTime: string,
  options?: { baseUrl?: string; signal?: AbortSignal }
): Promise<Response> {
  const base = options?.baseUrl ?? CLOUDFRONT_PROXY_URL;
  const params = new URLSearchParams({
    net: network, sta: station, cha: channel, loc: "--",
    start: startTime, end: endTime,
  });
  const url = `${base}/earthscope/cached/dataselect/1/query?${params}`;
  const response = await fetch(url, { signal: options?.signal });
  if (!response.ok) {
    throw new Error(`dataselect ${response.status}: ${response.statusText}`);
  }
  return response;
}

async function fetchFromMock(
  startTime: string,
  endTime: string,
  options?: { signal?: AbortSignal }
): Promise<Response> {
  const startSec = new Date(startTime).getTime() / 1000;
  const endSec = new Date(endTime).getTime() / 1000;

  const match = MOCK_FILES.find(f => f.startSec < endSec && f.endSec > startSec);
  if (!match) {
    throw new Error(
      `No mock data available for ${startTime}–${endTime}. ` +
      `Mock data covers 2026-01-30 to 2026-02-06.`
    );
  }

  const response = await fetch(match.url, { signal: options?.signal });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch mock seismic data: ${response.status} ${response.statusText}`
    );
  }
  return response;
}

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
