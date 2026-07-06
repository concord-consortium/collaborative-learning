import { utcDay } from "./seismic-day";
import { ChannelMetadata, StationId, StationISOTimeRange, TimeRange } from "./seismic-types";

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

function getUrlParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

export function isProxyEnabled(): boolean {
  return getUrlParam("seismicProxy") !== null;
}

export function getLocalBaseUrl(): string | null {
  return getUrlParam("seismicLocal");
}

export interface EarthscopeOptions {
  baseUrl?: string | null;
  proxy?: boolean;
  signal?: AbortSignal;
}

interface MockFile {
  url: string;
  /** Inclusive start, seconds since epoch */
  startSec: number;
  /** Exclusive end, seconds since epoch */
  endSec: number;
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
 * @throws On network errors, when no matching mock file is found, or when the
 *   underlying fetch returns a non-2xx HTTP response.
 */
export async function fetchRawSeismicData(
  query: StationISOTimeRange,
  options?: EarthscopeOptions
): Promise<Response> {
  const localBase = options?.baseUrl ?? getLocalBaseUrl();
  if (localBase) {
    return fetchFromLocal(localBase, query, options);
  }
  const proxy = options?.proxy ?? isProxyEnabled();
  if (proxy) {
    return fetchFromProxy(query, options);
  }
  return fetchFromMock(query.startTime, query.endTime, options);
}

/**
 * Fetch from a local static server that mirrors the ROVER directory layout:
 *   {baseUrl}/data/{network}/{year}/{doy}/{station}.{network}.{year}.{doy}
 * Expects day-aligned requests (one day per call).
 */
async function fetchFromLocal(
  baseUrl: string,
  query: StationISOTimeRange,
  options?: EarthscopeOptions
): Promise<Response> {
  const { network, startTime, station } = query;
  const startDate = new Date(startTime);
  const year = startDate.getUTCFullYear();
  const startOfYear = Date.UTC(year, 0, 1);
  const doy = String(Math.floor((startDate.getTime() - startOfYear) / 86400000) + 1).padStart(3, "0");

  const url = `${baseUrl}/data/${network}/${year}/${doy}/${station}.${network}.${year}.${doy}`;
  const response = await fetch(url, { signal: options?.signal });
  if (!response.ok) {
    throw new Error(`Local data fetch failed: ${url} → ${response.status}`);
  }
  return response;
}

async function fetchFromProxy(
  query: StationISOTimeRange,
  options?: EarthscopeOptions
): Promise<Response> {
  const { channel, endTime, location, network, startTime, station } = query;
  const base = options?.baseUrl ?? CLOUDFRONT_PROXY_URL;
  const params = new URLSearchParams({
    net: network, sta: station, cha: channel, loc: location || "--",
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
  options?: EarthscopeOptions
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
export async function fetchStationMetadata(stationId: StationId): Promise<ChannelMetadata[]> {
  const { network, station } = stationId;
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

const AVAILABILITY_PATH = "/earthscope/cached/availability/1/query";

/**
 * Fetch the time ranges for which data actually exists for a station/channel.
 *
 * Proxy mode (`?seismicProxy`): queries the FDSN availability service through
 * CloudFront and parses its pipe-delimited text response.
 *
 * Mock/local mode: the availability service is not mocked, so we assume the
 * entire requested range is available (one range). Callers then attempt every
 * day; the mock dataselect returns "no data" for days it doesn't cover.
 */
export async function fetchAvailability(
  query: StationISOTimeRange,
  options?: EarthscopeOptions
): Promise<TimeRange[]> {
  const { network, station, location, channel, startTime, endTime } = query;
  const proxy = options?.proxy ?? isProxyEnabled();
  if (!proxy) {
    return [{
      start: new Date(startTime).getTime() / 1000,
      end: new Date(endTime).getTime() / 1000,
    }];
  }
  const base = options?.baseUrl ?? CLOUDFRONT_PROXY_URL;
  const params = new URLSearchParams({
    net: network, sta: station, cha: channel, loc: location || "--",
    start: startTime, end: endTime, format: "text",
  });
  const response = await fetch(`${base}${AVAILABILITY_PATH}?${params}`, { signal: options?.signal });
  if (!response.ok) {
    throw new Error(`availability ${response.status}: ${response.statusText}`);
  }

  // Parse the whitespace-delimited FDSN availability text into [start, end) ranges.
  // Columns: Network Station Location Channel Quality SampleRate Earliest Latest
  const text = await response.text();
  const ranges: TimeRange[] = [];
  for (const line of text.trim().split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const fields = line.trim().split(/\s+/);
    if (fields.length < 8) continue;
    const start = new Date(fields[6]).getTime() / 1000;
    const end = new Date(fields[7]).getTime() / 1000;
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      ranges.push({ start, end });
    }
  }
  return ranges;
}
