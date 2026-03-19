/**
 * Low-level fetchers for EarthScope's FDSN web services.
 *
 * Currently mocked: returns pre-staged miniSEED files from S3 that cover the
 * requested time range, instead of hitting EarthScope's dataselect endpoint.
 * The public API is the same as the real implementation so callers won't need
 * to change when the mock is replaced.
 */

// ---------------------------------------------------------------------------
// Mock data – day-aligned miniSEED files on S3 for AK.K204.HNZ
// ---------------------------------------------------------------------------

const S3_BASE = "https://models-resources.s3.amazonaws.com/collaborative-learning/datasets";

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
  // --- Mock implementation ---------------------------------------------------
  const startSec = new Date(startTime).getTime() / 1000;
  const endSec = new Date(endTime).getTime() / 1000;

  const match = MOCK_FILES.find(f => f.startSec < endSec && f.endSec > startSec);
  if (!match) {
    throw new Error(
      `No mock data available for ${network}.${station}.${channel} ` +
      `${startTime}–${endTime}. Mock data covers 2026-01-30 to 2026-02-06.`
    );
  }

  const response = await fetch(match.url, { signal: options?.signal });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch mock seismic data: ${response.status} ${response.statusText}`
    );
  }
  return response;

  // --- Future real implementation (sketch) -----------------------------------
  // const base = options?.baseUrl ?? CLOUDFRONT_PROXY_URL;
  // const params = new URLSearchParams({
  //   net: network, sta: station, cha: channel, loc: "--",
  //   starttime: startTime, endtime: endTime,
  // });
  // const url = `${base}/fdsnws/dataselect/1/query?${params}`;
  // const response = await fetch(url, { signal: options?.signal });
  // if (!response.ok) {
  //   throw new Error(`dataselect ${response.status}: ${response.statusText}`);
  // }
  // return response;
}
