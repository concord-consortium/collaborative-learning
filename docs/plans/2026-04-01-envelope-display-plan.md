# Envelope Tile Display Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Display precomputed envelope tiles and raw seismic data in the Timeline tile using uPlot, replacing the seisplotjs Seismograph renderer.

**Architecture:** A stateless envelope tile fetcher (shared/seismic) feeds a reactive query service (on stores) that assembles uPlot-ready arrays. WaveformPanel receives a SharedSeismogram and viewport params, calls the query service, and renders with uPlot. The query service manages a MobX observable cache with level selection, multi-level fallback, and viewport-scoped cancellation.

**Tech Stack:** uPlot (canvas charting), MobX (reactive cache), Luxon (DateTime), pako (gzip decode), seisplotjs (raw miniSEED parsing)

---

### Task 1: Install uPlot

**Files:**
- Modify: `package.json`

**Step 1: Install uPlot**

Run: `npm install uplot`

**Step 2: Verify installation**

Run: `node -e "require('uplot')"`
Expected: No error

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add uplot dependency for seismic waveform rendering"
```

---

### Task 2: Add types and constants

**Files:**
- Modify: `shared/seismic/seismic-types.ts`
- Modify: `shared/seismic/envelope-config.ts`

**Step 1: Add new types to `seismic-types.ts`**

Add the following to the end of `shared/seismic/seismic-types.ts`:

```ts
/** A raw seismic data segment parsed from miniSEED. */
export interface RawSegment {
  startTime: number;   // Unix seconds
  sampleRate: number;
  samples: Float64Array;
}

/** Parameters for fetching a single envelope tile. */
export interface FetchEnvelopeTileParams {
  network: string;
  station: string;
  channel: string;
  level: number;
  tileIndex: number;
  s3BaseUrl?: string;
  signal?: AbortSignal;
}

/** Viewport parameters for seismic data queries. */
export interface SeismicViewportParams {
  network: string;
  station: string;
  location: string;
  channel: string;
  startTime: DateTime;
  endTime: DateTime;
  pixelWidth: number;
}

/** Result of a seismic query for a viewport. */
export interface ViewportQueryResult {
  level: number | "raw";
  /** uPlot data: [timestamps, mins, maxs] for envelopes; [timestamps, values] for raw */
  data: (number | null)[][];
  /** Amplitude range for y-axis scaling */
  amplitudeRange: number;
  /** True if any data is still loading */
  isLoading: boolean;
}
```

Note: `SeismicViewportParams` uses Luxon `DateTime` so add the import at the top:

```ts
import { DateTime } from "luxon";
```

**Step 2: Add constants to `envelope-config.ts`**

Add to the end of `shared/seismic/envelope-config.ts`:

```ts
/** S3 bucket where envelope tiles are stored. */
export const S3_BUCKET = "models-resources";

/** S3 key prefix for envelope tiles. */
export const S3_PREFIX = "collaborative-learning/envelopes/";

/** Duration of each raw data fetch chunk in seconds. */
export const RAW_CHUNK_DURATION = 7200; // 2 hours
```

**Step 3: Run type check**

Run: `npx tsc --noEmit --project shared/seismic/tsconfig.json 2>&1 | head -20`

If there is no tsconfig for shared/seismic, run: `npx tsc --noEmit 2>&1 | head -20`

Note: Type errors in unrelated files are fine. Just verify the new types don't have syntax errors.

**Step 4: Commit**

```bash
git add shared/seismic/seismic-types.ts shared/seismic/envelope-config.ts
git commit -m "feat: add seismic viewport types and raw chunk duration constant"
```

---

### Task 3: Envelope tile fetcher — tests

**Files:**
- Create: `shared/seismic/envelope-fetcher.test.ts`

**Step 1: Write failing tests**

Create `shared/seismic/envelope-fetcher.test.ts`:

```ts
import { fetchEnvelopeTile } from "./envelope-fetcher";
import { encodeEnvelopeTile } from "./envelope-codec";
import { FetchEnvelopeTileParams } from "./seismic-types";

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

const baseParams: FetchEnvelopeTileParams = {
  network: "AK",
  station: "K204",
  channel: "HNZ",
  level: 1,
  tileIndex: 42,
  s3BaseUrl: "https://test-bucket.s3.amazonaws.com/tiles/",
};

describe("fetchEnvelopeTile", () => {
  afterEach(() => {
    mockFetch.mockReset();
  });

  it("fetches and decodes a tile from S3", async () => {
    const mins = new Int16Array([100, -200, 300]);
    const maxs = new Int16Array([400, -100, 600]);
    const encoded = encodeEnvelopeTile(mins, maxs);

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(encoded),
    });

    const result = await fetchEnvelopeTile(baseParams);
    expect(result).not.toBeNull();
    expect(result!.mins).toEqual(mins);
    expect(result!.maxs).toEqual(maxs);

    // Verify the URL was constructed correctly
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("AK_K204");
    expect(calledUrl).toContain("HNZ");
    expect(calledUrl).toContain("L1");
    expect(calledUrl).toContain("42");
  });

  it("returns null on 404", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    const result = await fetchEnvelopeTile(baseParams);
    expect(result).toBeNull();
  });

  it("throws on non-404 errors", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: "Server Error" });
    await expect(fetchEnvelopeTile(baseParams)).rejects.toThrow("500");
  });

  it("passes signal to fetch", async () => {
    const controller = new AbortController();
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    await fetchEnvelopeTile({ ...baseParams, signal: controller.signal });
    expect(mockFetch.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  it("uses default s3BaseUrl when none provided", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    const { s3BaseUrl, ...paramsWithoutBase } = baseParams;
    await fetchEnvelopeTile(paramsWithoutBase);

    const calledUrl = mockFetch.mock.calls[0][0];
    // Should use some default URL, not undefined
    expect(calledUrl).toMatch(/^https?:\/\//);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest --no-watchman shared/seismic/envelope-fetcher.test.ts 2>&1 | tail -20`
Expected: FAIL — cannot find module `./envelope-fetcher`

**Step 3: Commit**

```bash
git add shared/seismic/envelope-fetcher.test.ts
git commit -m "test: add envelope tile fetcher tests"
```

---

### Task 4: Envelope tile fetcher — implementation

**Files:**
- Create: `shared/seismic/envelope-fetcher.ts`

**Step 1: Implement the fetcher**

Create `shared/seismic/envelope-fetcher.ts`:

```ts
import { decodeEnvelopeTile } from "./envelope-codec";
import { S3_BUCKET, S3_PREFIX } from "./envelope-config";
import { FetchEnvelopeTileParams, EnvelopeTileData } from "./seismic-types";
import { getTileS3Key, getS3Root } from "./tile-addressing";

const DEFAULT_S3_BASE_URL = `https://${S3_BUCKET}.s3.amazonaws.com/${S3_PREFIX}`;

/**
 * Fetch a single precomputed envelope tile from S3 and decode it.
 * Returns null on 404 (tile doesn't exist for that time range).
 * Throws on other HTTP errors.
 */
export async function fetchEnvelopeTile(params: FetchEnvelopeTileParams): Promise<EnvelopeTileData | null> {
  const { network, station, channel, level, tileIndex, signal } = params;
  const s3BaseUrl = params.s3BaseUrl ?? DEFAULT_S3_BASE_URL;

  const combinedStation = `${network}_${station}`;
  const key = getTileS3Key(combinedStation, channel, level, tileIndex);
  const url = `${getS3Root(s3BaseUrl)}${key}`;

  const response = await fetch(url, { signal });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Envelope tile fetch failed: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  return decodeEnvelopeTile(buffer);
}
```

**Note:** Also update `scripts/seismic/generate-envelopes.ts` to import `S3_BUCKET` and `S3_PREFIX` from `shared/seismic/envelope-config.ts` instead of defining its own `DEFAULT_S3_BUCKET` and `DEFAULT_S3_PREFIX` constants.

**Step 2: Run tests to verify they pass**

Run: `npx jest --no-watchman shared/seismic/envelope-fetcher.test.ts 2>&1 | tail -20`
Expected: PASS — all tests green

**Step 3: Commit**

```bash
git add shared/seismic/envelope-fetcher.ts
git commit -m "feat: implement envelope tile fetcher"
```

---

### Task 5: Seismic query service — level selection tests

**Files:**
- Create: `src/models/stores/seismic-query-service.test.ts`

**Step 1: Write level selection tests**

Create `src/models/stores/seismic-query-service.test.ts`:

```ts
import { DateTime } from "luxon";
import { SeismicQueryService, envelopeCacheKey, rawCacheKey } from "./seismic-query-service";

describe("SeismicQueryService", () => {
  describe("selectLevel", () => {
    let service: SeismicQueryService;
    const t0 = DateTime.fromSeconds(0, { zone: "utc" });

    function selectLevelFromSecondsPerPixel(spp: number) {
      return service.selectLevel(t0, DateTime.fromSeconds(spp * 1000, { zone: "utc" }), 1000);
    }

    beforeEach(() => {
      service = new SeismicQueryService();
    });

    it("selects L0 when secondsPerPixel >= L0 spacing (15750)", () => {
      expect(selectLevelFromSecondsPerPixel(15750)).toBe(0);
      expect(selectLevelFromSecondsPerPixel(20000)).toBe(0);
    });

    it("selects L1 when secondsPerPixel >= L1 spacing (157.5)", () => {
      expect(selectLevelFromSecondsPerPixel(157.5)).toBe(1);
      expect(selectLevelFromSecondsPerPixel(1000)).toBe(1);
    });

    it("selects L2 when secondsPerPixel >= L2 spacing (1.575)", () => {
      expect(selectLevelFromSecondsPerPixel(1.575)).toBe(2);
      expect(selectLevelFromSecondsPerPixel(10)).toBe(2);
    });

    it("selects raw when secondsPerPixel < L2 spacing", () => {
      expect(selectLevelFromSecondsPerPixel(1)).toBe("raw");
      expect(selectLevelFromSecondsPerPixel(0.01)).toBe("raw");
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest --no-watchman src/models/stores/seismic-query-service.test.ts 2>&1 | tail -20`
Expected: FAIL — cannot find module

**Step 3: Commit**

```bash
git add src/models/stores/seismic-query-service.test.ts
git commit -m "test: add seismic query service level selection tests"
```

---

### Task 6: Seismic query service — skeleton with level selection

**Files:**
- Create: `src/models/stores/seismic-query-service.ts`

**Step 1: Implement skeleton with level selection**

Create `src/models/stores/seismic-query-service.ts`:

```ts
import { makeAutoObservable, observable, runInAction } from "mobx";
import { DateTime } from "luxon";
import { LEVEL_SPACINGS, AMPLITUDE_RANGES, NO_DATA_SENTINEL, RAW_CHUNK_DURATION } from "../../../shared/seismic/envelope-config";
import { dequantize } from "../../../shared/seismic/envelope-codec";
import { getTileIndicesForViewport, getTileTimeRange, getTileDuration } from "../../../shared/seismic/tile-addressing";
import { fetchEnvelopeTile } from "../../../shared/seismic/envelope-fetcher";
import { fetchRawSeismicData, fetchStationMetadata } from "../../../shared/seismic/earthscope-client";
import { miniseed } from "seisplotjs";
import {
  EnvelopeTileData, ChannelMetadata, SeismicViewportParams, ViewportQueryResult, RawSegment
} from "../../../shared/seismic/seismic-types";

type EnvelopeCacheEntry = EnvelopeTileData | "loading" | "missing";
type RawCacheEntry = RawSegment[] | "loading" | "missing";

export function envelopeCacheKey(network: string, station: string, channel: string, level: number, tileIndex: number) {
  return `${network}_${station}/${channel}/L${level}/${tileIndex}`;
}

export function rawCacheKey(network: string, station: string, channel: string, chunkIndex: number) {
  return `${network}_${station}/${channel}/raw/${chunkIndex}`;
}

export class SeismicQueryService {
  /** Envelope tile cache keyed by "{network}_{station}/{channel}/L{level}/{tileIndex}" */
  envelopeCache: Map<string, EnvelopeCacheEntry> = observable.map();

  /** Raw data cache keyed by "{network}_{station}/{channel}/raw/{chunkIndex}" */
  rawCache: Map<string, RawCacheEntry> = observable.map();

  /** Station metadata cache keyed by "{network}_{station}" */
  metadataCache: Map<string, ChannelMetadata[]> = observable.map();

  /** In-flight AbortControllers keyed by callerId */
  private inflightByCallerId: Map<string, Map<string, AbortController>> = new Map();

  constructor() {
    makeAutoObservable(this, {
      envelopeCache: observable,
      rawCache: observable,
      metadataCache: observable,
    });
  }

  /**
   * Select the appropriate data level for the given seconds per pixel.
   * Returns 0, 1, 2 for envelope levels, or "raw" for raw data.
   */
  selectLevel(startTime: DateTime, endTime: DateTime, pixelWidth: number): number | "raw" {
    const secondsPerPixel = (endTime.toSeconds() - startTime.toSeconds()) / pixelWidth;
    for (let level = 0; level < LEVEL_SPACINGS.length; level++) {
      if (secondsPerPixel >= LEVEL_SPACINGS[level]) return level;
    }
    return "raw";
  }

  /**
   * Returns current best-available data for the viewport.
   * Called from MobX observer components so cache reads are tracked.
   */
  query(params: SeismicViewportParams): ViewportQueryResult {
    const { network, station, channel, startTime, endTime, pixelWidth } = params;
    const level = this.selectLevel(startTime, endTime, pixelWidth);
    const instrumentCode = channel.charAt(1);
    const amplitudeRange = AMPLITUDE_RANGES[instrumentCode] ?? 1;

    if (level === "raw") {
      return this.queryRaw(params, amplitudeRange);
    }
    return this.queryEnvelope(params, level, amplitudeRange);
  }

  /**
   * Triggers fetches for missing data. Cancels stale fetches from previous
   * call with the same callerId.
   */
  loadViewport(callerId: string, params: SeismicViewportParams): void {
    const { startTime, endTime, pixelWidth } = params;
    const level = this.selectLevel(startTime, endTime, pixelWidth);

    if (level === "raw") {
      this.loadRaw(callerId, params);
    } else {
      this.loadEnvelope(callerId, params, level);
    }
  }

  // --- Private helpers (envelope) ---

  private queryEnvelope(params: SeismicViewportParams, level: number, amplitudeRange: number): ViewportQueryResult {
    const { network, station, channel, startTime, endTime } = params;
    const startSec = startTime.toSeconds();
    const endSec = endTime.toSeconds();
    const tileIndices = getTileIndicesForViewport(startSec, endSec, level);
    const spacing = LEVEL_SPACINGS[level];

    const timestamps: (number | null)[] = [];
    const mins: (number | null)[] = [];
    const maxs: (number | null)[] = [];
    let isLoading = false;

    for (const tileIndex of tileIndices) {
      const key = envelopeCacheKey(network, station, channel, level, tileIndex);
      let entry = this.envelopeCache.get(key);

      // Fallback to one level coarser if this level is loading
      if (entry === "loading" || entry === undefined) {
        isLoading = true;
        const fallbackData = this.getFallbackData(level, tileIndex, network, station, channel, startSec, endSec);
        if (fallbackData) {
          timestamps.push(...fallbackData.timestamps);
          mins.push(...fallbackData.mins);
          maxs.push(...fallbackData.maxs);
          continue;
        }
        // No fallback — insert nulls for this tile's time range
        const range = getTileTimeRange(level, tileIndex);
        const tileStart = Math.max(range.start, startSec);
        const tileEnd = Math.min(range.end, endSec);
        for (let t = tileStart; t < tileEnd; t += spacing) {
          timestamps.push(t);
          mins.push(null);
          maxs.push(null);
        }
        continue;
      }

      if (entry === "missing") {
        const range = getTileTimeRange(level, tileIndex);
        const tileStart = Math.max(range.start, startSec);
        const tileEnd = Math.min(range.end, endSec);
        for (let t = tileStart; t < tileEnd; t += spacing) {
          timestamps.push(t);
          mins.push(null);
          maxs.push(null);
        }
        continue;
      }

      // Real data — dequantize and add to arrays
      const range = getTileTimeRange(level, tileIndex);
      for (let i = 0; i < entry.mins.length; i++) {
        const t = range.start + i * spacing;
        if (t < startSec || t >= endSec) continue;
        if (entry.mins[i] === NO_DATA_SENTINEL) {
          timestamps.push(t);
          mins.push(null);
          maxs.push(null);
        } else {
          timestamps.push(t);
          mins.push(dequantize(entry.mins[i], amplitudeRange));
          maxs.push(dequantize(entry.maxs[i], amplitudeRange));
        }
      }
    }

    return { level, data: [timestamps, mins, maxs], amplitudeRange, isLoading };
  }

  private getFallbackData(
    level: number, tileIndex: number, network: string, station: string, channel: string,
    viewStartSec: number, viewEndSec: number
  ): { timestamps: (number | null)[], mins: (number | null)[], maxs: (number | null)[] } | null {
    const fallbackLevel = level - 1;
    if (fallbackLevel < 0) return null;

    const range = getTileTimeRange(level, tileIndex);
    const overlapStart = Math.max(range.start, viewStartSec);
    const overlapEnd = Math.min(range.end, viewEndSec);
    const fallbackSpacing = LEVEL_SPACINGS[fallbackLevel];
    const fallbackIndices = getTileIndicesForViewport(overlapStart, overlapEnd, fallbackLevel);

    const timestamps: (number | null)[] = [];
    const mins: (number | null)[] = [];
    const maxs: (number | null)[] = [];

    for (const fbTileIndex of fallbackIndices) {
      const fbKey = envelopeCacheKey(network, station, channel, fallbackLevel, fbTileIndex);
      const fbEntry = this.envelopeCache.get(fbKey);
      if (!fbEntry || fbEntry === "loading" || fbEntry === "missing") return null;

      const fbRange = getTileTimeRange(fallbackLevel, fbTileIndex);
      for (let i = 0; i < fbEntry.mins.length; i++) {
        const t = fbRange.start + i * fallbackSpacing;
        if (t < overlapStart || t >= overlapEnd) continue;
        if (fbEntry.mins[i] === NO_DATA_SENTINEL) {
          timestamps.push(t);
          mins.push(null);
          maxs.push(null);
        } else {
          const amplitudeRange = AMPLITUDE_RANGES[channel.charAt(1)] ?? 1;
          timestamps.push(t);
          mins.push(dequantize(fbEntry.mins[i], amplitudeRange));
          maxs.push(dequantize(fbEntry.maxs[i], amplitudeRange));
        }
      }
    }

    return timestamps.length > 0 ? { timestamps, mins, maxs } : null;
  }

  private loadEnvelope(callerId: string, params: SeismicViewportParams, level: number): void {
    const { network, station, channel, startTime, endTime } = params;
    const startSec = startTime.toSeconds();
    const endSec = endTime.toSeconds();
    const tileIndices = getTileIndicesForViewport(startSec, endSec, level);

    // Determine which tiles need fetching
    const toFetch: number[] = [];
    const neededKeys = new Set<string>();
    for (const tileIndex of tileIndices) {
      const key = envelopeCacheKey(network, station, channel, level, tileIndex);
      neededKeys.add(key);
      if (!this.envelopeCache.has(key)) {
        toFetch.push(tileIndex);
      }
    }

    // Cancel stale fetches for this caller
    this.cancelStale(callerId, neededKeys);

    // Fetch missing tiles
    for (const tileIndex of toFetch) {
      const key = envelopeCacheKey(network, station, channel, level, tileIndex);
      const controller = new AbortController();
      this.registerInflight(callerId, key, controller);

      runInAction(() => { this.envelopeCache.set(key, "loading"); });

      fetchEnvelopeTile({
        network, station, channel, level, tileIndex,
        signal: controller.signal,
      }).then(data => {
        runInAction(() => {
          this.envelopeCache.set(key, data ?? "missing");
        });
      }).catch(err => {
        if (err.name !== "AbortError") {
          runInAction(() => { this.envelopeCache.set(key, "missing"); });
        }
      }).finally(() => {
        this.removeInflight(callerId, key);
      });
    }
  }

  // --- Private helpers (raw) ---

  private rawChunkIndex(unixSeconds: number): number {
    return Math.floor(unixSeconds / RAW_CHUNK_DURATION);
  }

  private queryRaw(params: SeismicViewportParams, amplitudeRange: number): ViewportQueryResult {
    const { network, station, channel, startTime, endTime } = params;
    const startSec = startTime.toSeconds();
    const endSec = endTime.toSeconds();
    const firstChunk = this.rawChunkIndex(startSec);
    const lastChunk = this.rawChunkIndex(endSec - 1e-9);

    const timestamps: (number | null)[] = [];
    const values: (number | null)[] = [];
    let isLoading = false;

    for (let ci = firstChunk; ci <= lastChunk; ci++) {
      const key = rawCacheKey(network, station, channel, ci);
      const entry = this.rawCache.get(key);

      if (entry === "loading" || entry === undefined) {
        isLoading = true;
        // Attempt fallback to L2 envelope for this chunk's time range
        const chunkStart = ci * RAW_CHUNK_DURATION;
        const chunkEnd = (ci + 1) * RAW_CHUNK_DURATION;
        const fallback = this.getL2FallbackForRaw(
          network, station, channel, Math.max(chunkStart, startSec), Math.min(chunkEnd, endSec), amplitudeRange
        );
        if (fallback) {
          // Envelope fallback — push as interleaved min/max approximation (use midpoint)
          for (let i = 0; i < fallback.timestamps.length; i++) {
            timestamps.push(fallback.timestamps[i]);
            const min = fallback.mins[i];
            const max = fallback.maxs[i];
            values.push(min !== null && max !== null ? (min + max) / 2 : null);
          }
        }
        continue;
      }

      if (entry === "missing") continue;

      // Real segment data
      for (const segment of entry) {
        const segEnd = segment.startTime + segment.samples.length / segment.sampleRate;
        for (let i = 0; i < segment.samples.length; i++) {
          const t = segment.startTime + i / segment.sampleRate;
          if (t < startSec || t >= endSec) continue;
          timestamps.push(t);
          values.push(segment.samples[i]);
        }
      }
    }

    return { level: "raw", data: [timestamps, values], amplitudeRange, isLoading };
  }

  private getL2FallbackForRaw(
    network: string, station: string, channel: string,
    startSec: number, endSec: number, amplitudeRange: number
  ): { timestamps: (number | null)[], mins: (number | null)[], maxs: (number | null)[] } | null {
    const l2Indices = getTileIndicesForViewport(startSec, endSec, 2);
    const spacing = LEVEL_SPACINGS[2];
    const timestamps: (number | null)[] = [];
    const mins: (number | null)[] = [];
    const maxs: (number | null)[] = [];

    for (const tileIndex of l2Indices) {
      const key = envelopeCacheKey(network, station, channel, 2, tileIndex);
      const entry = this.envelopeCache.get(key);
      if (!entry || entry === "loading" || entry === "missing") return null;

      const range = getTileTimeRange(2, tileIndex);
      for (let i = 0; i < entry.mins.length; i++) {
        const t = range.start + i * spacing;
        if (t < startSec || t >= endSec) continue;
        if (entry.mins[i] === NO_DATA_SENTINEL) {
          timestamps.push(t);
          mins.push(null);
          maxs.push(null);
        } else {
          timestamps.push(t);
          mins.push(dequantize(entry.mins[i], amplitudeRange));
          maxs.push(dequantize(entry.maxs[i], amplitudeRange));
        }
      }
    }

    return timestamps.length > 0 ? { timestamps, mins, maxs } : null;
  }

  private loadRaw(callerId: string, params: SeismicViewportParams): void {
    const { network, station, location, channel, startTime, endTime } = params;
    const startSec = startTime.toSeconds();
    const endSec = endTime.toSeconds();
    const firstChunk = this.rawChunkIndex(startSec);
    const lastChunk = this.rawChunkIndex(endSec - 1e-9);

    const neededKeys = new Set<string>();
    const toFetch: number[] = [];
    for (let ci = firstChunk; ci <= lastChunk; ci++) {
      const key = rawCacheKey(network, station, channel, ci);
      neededKeys.add(key);
      if (!this.rawCache.has(key)) {
        toFetch.push(ci);
      }
    }

    this.cancelStale(callerId, neededKeys);

    for (const chunkIndex of toFetch) {
      const key = rawCacheKey(network, station, channel, chunkIndex);
      const controller = new AbortController();
      this.registerInflight(callerId, key, controller);

      runInAction(() => { this.rawCache.set(key, "loading"); });

      const chunkStartSec = chunkIndex * RAW_CHUNK_DURATION;
      const chunkEndSec = (chunkIndex + 1) * RAW_CHUNK_DURATION;
      const chunkStartDT = DateTime.fromSeconds(chunkStartSec, { zone: "utc" });
      const chunkEndDT = DateTime.fromSeconds(chunkEndSec, { zone: "utc" });
      const chunkStartISO = chunkStartDT.toISO();
      const chunkEndISO = chunkEndDT.toISO();
      if (!chunkStartISO || !chunkEndISO) continue;

      this.fetchAndParseRaw(
        network, station, location, channel,
        chunkStartISO, chunkEndISO, controller.signal
      ).then(segments => {
        runInAction(() => {
          this.rawCache.set(key, segments.length > 0 ? segments : "missing");
        });
      }).catch(err => {
        if (err.name !== "AbortError") {
          runInAction(() => { this.rawCache.set(key, "missing"); });
        }
      }).finally(() => {
        this.removeInflight(callerId, key);
      });
    }
  }

  private async fetchAndParseRaw(
    network: string, station: string, location: string, channel: string,
    startISO: string, endISO: string, signal: AbortSignal
  ): Promise<RawSegment[]> {
    const response = await fetchRawSeismicData(
      network, station, location, channel, startISO, endISO, { signal }
    );
    const buffer = await response.arrayBuffer();
    const records = miniseed.parseDataRecords(buffer);
    const seismogram = miniseed.merge(records);

    // Extract raw segments from seisplotjs Seismogram
    // seisplotjs Seismogram has .segments() or is iterable
    const segments: RawSegment[] = [];
    if (seismogram && seismogram.segments) {
      for (const seg of seismogram.segments) {
        const startTime = seg.startTime.toSeconds();
        const sampleRate = seg.sampleRate;
        const y = seg.y;
        const samples = new Float64Array(y.length);
        for (let i = 0; i < y.length; i++) {
          samples[i] = y[i];
        }
        segments.push({ startTime, sampleRate, samples });
      }
    }
    return segments;
  }

  // --- Cancellation helpers ---

  private cancelStale(callerId: string, neededKeys: Set<string>): void {
    const callerInflight = this.inflightByCallerId.get(callerId);
    if (!callerInflight) return;

    for (const [key, controller] of callerInflight) {
      if (!neededKeys.has(key)) {
        controller.abort();
        callerInflight.delete(key);
      }
    }
  }

  private registerInflight(callerId: string, key: string, controller: AbortController): void {
    let callerMap = this.inflightByCallerId.get(callerId);
    if (!callerMap) {
      callerMap = new Map();
      this.inflightByCallerId.set(callerId, callerMap);
    }
    callerMap.set(key, controller);
  }

  private removeInflight(callerId: string, key: string): void {
    const callerMap = this.inflightByCallerId.get(callerId);
    if (callerMap) {
      callerMap.delete(key);
      if (callerMap.size === 0) {
        this.inflightByCallerId.delete(callerId);
      }
    }
  }
}
```

**Step 2: Run tests to verify they pass**

Run: `npx jest --no-watchman src/models/stores/seismic-query-service.test.ts 2>&1 | tail -20`
Expected: PASS

**Step 3: Commit**

```bash
git add src/models/stores/seismic-query-service.ts
git commit -m "feat: implement seismic query service with level selection, caching, and cancellation"
```

---

### Task 7: Seismic query service — query and loadViewport tests

**Files:**
- Modify: `src/models/stores/seismic-query-service.test.ts`

**Step 1: Add query and loadViewport tests**

Append to `src/models/stores/seismic-query-service.test.ts`:

```ts
import { DateTime } from "luxon";
import { encodeEnvelopeTile } from "../../../shared/seismic/envelope-codec";
import { LEVEL_SPACINGS, NO_DATA_SENTINEL } from "../../../shared/seismic/envelope-config";
import { quantize } from "../../../shared/seismic/envelope-codec";
import { getTileIndex, getTileTimeRange } from "../../../shared/seismic/tile-addressing";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock seisplotjs
jest.mock("seisplotjs", () => ({
  miniseed: {
    parseDataRecords: jest.fn(() => []),
    merge: jest.fn(() => null),
  },
}));

describe("SeismicQueryService query", () => {
  let service: SeismicQueryService;

  const viewportParams = (overrides?: Partial<SeismicViewportParams>): SeismicViewportParams => ({
    network: "AK",
    station: "K204",
    location: "",
    channel: "HNZ",
    startTime: DateTime.fromSeconds(0, { zone: "utc" }),
    endTime: DateTime.fromSeconds(LEVEL_SPACINGS[1] * 1000, { zone: "utc" }),
    pixelWidth: 1000,
    ...overrides,
  });

  beforeEach(() => {
    service = new SeismicQueryService();
    mockFetch.mockReset();
  });

  it("returns isLoading true when tiles are not yet cached", () => {
    const result = service.query(viewportParams());
    expect(result.isLoading).toBe(true);
  });

  it("returns envelope data from cached tiles", () => {
    // Manually populate cache with a tile
    const level = 1;
    const tileIndex = 0;
    const mins = new Int16Array([1000, 2000]);
    const maxs = new Int16Array([3000, 4000]);
    const key = envelopeCacheKey("AK", "K204", "HNZ", level, tileIndex);
    service.envelopeCache.set(key, { mins, maxs });

    const range = getTileTimeRange(level, tileIndex);
    const result = service.query(viewportParams({
      startTime: DateTime.fromSeconds(range.start, { zone: "utc" }),
      endTime: DateTime.fromSeconds(range.start + LEVEL_SPACINGS[level] * 2, { zone: "utc" }),
      pixelWidth: 2,
    }));

    expect(result.level).toBe(1);
    expect(result.data[0].length).toBe(2); // 2 timestamps
    expect(result.data[1][0]).not.toBeNull(); // min value dequantized
    expect(result.data[2][0]).not.toBeNull(); // max value dequantized
  });

  it("inserts nulls for missing tiles", () => {
    const level = 1;
    const tileIndex = 0;
    const key = envelopeCacheKey("AK", "K204", "HNZ", level, tileIndex);
    service.envelopeCache.set(key, "missing");

    const range = getTileTimeRange(level, tileIndex);
    const result = service.query(viewportParams({
      startTime: DateTime.fromSeconds(range.start, { zone: "utc" }),
      endTime: DateTime.fromSeconds(range.start + LEVEL_SPACINGS[level] * 2, { zone: "utc" }),
      pixelWidth: 2,
    }));

    expect(result.data[1][0]).toBeNull();
    expect(result.data[2][0]).toBeNull();
  });

  it("handles NO_DATA_SENTINEL as null", () => {
    const level = 1;
    const tileIndex = 0;
    const mins = new Int16Array([NO_DATA_SENTINEL]);
    const maxs = new Int16Array([NO_DATA_SENTINEL]);
    const key = envelopeCacheKey("AK", "K204", "HNZ", level, tileIndex);
    service.envelopeCache.set(key, { mins, maxs });

    const range = getTileTimeRange(level, tileIndex);
    const result = service.query(viewportParams({
      startTime: DateTime.fromSeconds(range.start, { zone: "utc" }),
      endTime: DateTime.fromSeconds(range.start + LEVEL_SPACINGS[level], { zone: "utc" }),
      pixelWidth: 1,
    }));

    expect(result.data[1][0]).toBeNull();
    expect(result.data[2][0]).toBeNull();
  });
});

describe("SeismicQueryService loadViewport", () => {
  let service: SeismicQueryService;

  beforeEach(() => {
    service = new SeismicQueryService();
    mockFetch.mockReset();
  });

  it("fetches missing envelope tiles", () => {
    const encoded = encodeEnvelopeTile(new Int16Array([100]), new Int16Array([200]));
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(encoded),
    });

    const level = 1;
    const range = getTileTimeRange(level, 0);
    service.loadViewport("caller1", {
      network: "AK",
      station: "K204",
      location: "",
      channel: "HNZ",
      startTime: DateTime.fromSeconds(range.start, { zone: "utc" }),
      endTime: DateTime.fromSeconds(range.start + LEVEL_SPACINGS[level], { zone: "utc" }),
      pixelWidth: 1,
    });

    // Should have set cache to "loading"
    expect(service.envelopeCache.get(envelopeCacheKey("AK", "K204", "HNZ", 1, 0))).toBe("loading");
    expect(mockFetch).toHaveBeenCalled();
  });

  it("does not re-fetch tiles already in cache", () => {
    const key = envelopeCacheKey("AK", "K204", "HNZ", 1, 0);
    service.envelopeCache.set(key, { mins: new Int16Array([1]), maxs: new Int16Array([2]) });

    const level = 1;
    const range = getTileTimeRange(level, 0);
    service.loadViewport("caller1", {
      network: "AK",
      station: "K204",
      location: "",
      channel: "HNZ",
      startTime: DateTime.fromSeconds(range.start, { zone: "utc" }),
      endTime: DateTime.fromSeconds(range.start + LEVEL_SPACINGS[level], { zone: "utc" }),
      pixelWidth: 1,
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
```

Note: The imports at the top of the file need to be consolidated with the existing imports from Task 5.

**Step 2: Run tests**

Run: `npx jest --no-watchman src/models/stores/seismic-query-service.test.ts 2>&1 | tail -30`
Expected: PASS — all tests green

**Step 3: Commit**

```bash
git add src/models/stores/seismic-query-service.test.ts
git commit -m "test: add seismic query service query and loadViewport tests"
```

---

### Task 8: Register query service on stores

**Files:**
- Modify: `src/models/stores/stores.ts`
- Modify: `src/hooks/use-stores.ts`

**Step 1: Add seismicQueryService to IStores interface**

In `src/models/stores/stores.ts`, add to the `IStores` interface (around line 40):

```ts
import { SeismicQueryService } from "./seismic-query-service";
```

Add to `IStores`:
```ts
seismicQueryService: SeismicQueryService;
```

**Step 2: Add property to Stores class**

Add to the class properties (around line 98):
```ts
seismicQueryService: SeismicQueryService;
```

Add to the constructor (around line 115):
```ts
this.seismicQueryService = new SeismicQueryService();
```

**Step 3: Add convenience hook**

In `src/hooks/use-stores.ts`, add:

```ts
import { SeismicQueryService } from "../models/stores/seismic-query-service";

export function useSeismicQueryService(): SeismicQueryService {
  return useStores().seismicQueryService;
}
```

**Step 4: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 5: Commit**

```bash
git add src/models/stores/stores.ts src/hooks/use-stores.ts
git commit -m "feat: register SeismicQueryService on stores"
```

---

### Task 9: Update SharedSeismogram model

**Files:**
- Modify: `src/plugins/shared-seismogram/shared-seismogram.ts`
- Modify: `src/plugins/shared-seismogram/shared-seismogram.test.ts`

**Step 1: Update the test file first**

Replace the content of `src/plugins/shared-seismogram/shared-seismogram.test.ts`:

```ts
import { DateTime } from "luxon";
import { SharedSeismogram, kSharedSeismogramType, isSharedSeismogram } from "./shared-seismogram";

describe("SharedSeismogram", () => {
  it("has the correct type", () => {
    const model = SharedSeismogram.create();
    expect(model.type).toBe(kSharedSeismogramType);
  });

  it("starts with no station data", () => {
    const model = SharedSeismogram.create();
    expect(model.network).toBeUndefined();
    expect(model.station).toBeUndefined();
    expect(model.location).toBeUndefined();
    expect(model.channel).toBeUndefined();
    expect(model.startTime).toBeUndefined();
    expect(model.endTime).toBeUndefined();
  });

  it("setStation updates station fields", () => {
    const model = SharedSeismogram.create();
    model.setStation("AK", "K204", "", "HNZ");
    expect(model.network).toBe("AK");
    expect(model.station).toBe("K204");
    expect(model.location).toBe("");
    expect(model.channel).toBe("HNZ");
  });

  it("setTimeRange updates time fields", () => {
    const model = SharedSeismogram.create();
    const start = DateTime.fromISO("2026-01-30T00:00:00.000Z");
    const end = DateTime.fromISO("2026-02-06T00:00:00.000Z");
    model.setTimeRange(start.toISO()!, end.toISO()!);
    expect(model.startTime?.toMillis()).toBe(start.toMillis());
    expect(model.endTime?.toMillis()).toBe(end.toMillis());
  });

  it("isSharedSeismogram returns true for a SharedSeismogram instance", () => {
    const model = SharedSeismogram.create();
    expect(isSharedSeismogram(model)).toBe(true);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest --no-watchman src/plugins/shared-seismogram/shared-seismogram.test.ts 2>&1 | tail -20`
Expected: FAIL — `setStation` is not a function

**Step 3: Update SharedSeismogram model**

Replace the content of `src/plugins/shared-seismogram/shared-seismogram.ts`:

```ts
import { getType, Instance, types } from "mobx-state-tree";
import { DateTime } from "luxon";
import { SharedModel, SharedModelType } from "../../models/shared/shared-model";

export const kSharedSeismogramType = "SharedSeismogram";

export const SharedSeismogram = SharedModel
  .named("SharedSeismogram")
  .props({
    type: types.optional(types.literal(kSharedSeismogramType), kSharedSeismogramType),
    network: types.maybe(types.string),
    station: types.maybe(types.string),
    location: types.maybe(types.string),
    channel: types.maybe(types.string),
    startTimeISO: types.maybe(types.string),
    endTimeISO: types.maybe(types.string),
  })
  .views(self => ({
    get startTime() {
      return self.startTimeISO ? DateTime.fromISO(self.startTimeISO, { zone: "utc" }) : undefined;
    },
    get endTime() {
      return self.endTimeISO ? DateTime.fromISO(self.endTimeISO, { zone: "utc" }) : undefined;
    },
  }))
  .actions(self => ({
    setStation(network: string, station: string, location: string, channel: string) {
      self.network = network;
      self.station = station;
      self.location = location;
      self.channel = channel;
    },
    setTimeRange(startTimeISO: string, endTimeISO: string) {
      self.startTimeISO = startTimeISO;
      self.endTimeISO = endTimeISO;
    },
  }));

export interface SharedSeismogramType extends Instance<typeof SharedSeismogram> {}

export function isSharedSeismogram(model?: SharedModelType): model is SharedSeismogramType {
  return !!model && getType(model) === SharedSeismogram;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx jest --no-watchman src/plugins/shared-seismogram/shared-seismogram.test.ts 2>&1 | tail -20`
Expected: PASS

**Step 5: Commit**

```bash
git add src/plugins/shared-seismogram/shared-seismogram.ts src/plugins/shared-seismogram/shared-seismogram.test.ts
git commit -m "feat: revise SharedSeismogram to thin query-params model"
```

---

### Task 10: Update WaveformPanel to use uPlot

**Files:**
- Modify: `src/plugins/shared-seismogram/components/waveform-panel.tsx`
- Modify: `src/plugins/shared-seismogram/components/waveform-panel.test.tsx`

**Step 1: Update tests**

Replace the content of `src/plugins/shared-seismogram/components/waveform-panel.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import React from "react";
import { DateTime } from "luxon";
import { WaveformPanel } from "./waveform-panel";
import { SharedSeismogram, SharedSeismogramType } from "../shared-seismogram";

// Mock uPlot — canvas won't work in jsdom
jest.mock("uplot", () => {
  return jest.fn().mockImplementation(() => ({
    setData: jest.fn(),
    setSize: jest.fn(),
    destroy: jest.fn(),
  }));
});

// Mock useStores to provide a mock query service
const mockQuery = jest.fn().mockReturnValue({
  level: 1,
  data: [[], [], []],
  amplitudeRange: 0.05,
  isLoading: false,
});
const mockLoadViewport = jest.fn();

jest.mock("../../../hooks/use-stores", () => ({
  useStores: () => ({
    seismicQueryService: {
      query: mockQuery,
      loadViewport: mockLoadViewport,
    },
  }),
}));

const START = DateTime.fromISO("2026-02-01T00:00:00Z");
const END = DateTime.fromISO("2026-02-02T00:00:00Z");

describe("WaveformPanel", () => {
  let sharedSeismogram: SharedSeismogramType;

  beforeEach(() => {
    sharedSeismogram = SharedSeismogram.create();
    sharedSeismogram.setStation("AK", "K204", "", "HNZ");
    mockQuery.mockClear();
    mockLoadViewport.mockClear();
  });

  it("renders the label and container div", () => {
    const { container, getByText } = render(
      <WaveformPanel
        label="1 day"
        sharedSeismogram={sharedSeismogram}
        startTime={START}
        endTime={END}
      />
    );
    expect(getByText("1 day")).toBeInTheDocument();
    expect(container.querySelector(".waveform-panel")).toBeInTheDocument();
    expect(container.querySelector(".waveform-panel-display")).toBeInTheDocument();
  });

  it("calls loadViewport on mount when station data is available", () => {
    render(
      <WaveformPanel
        label="test"
        sharedSeismogram={sharedSeismogram}
        startTime={START}
        endTime={END}
      />
    );
    expect(mockLoadViewport).toHaveBeenCalled();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest --no-watchman src/plugins/shared-seismogram/components/waveform-panel.test.tsx 2>&1 | tail -20`
Expected: FAIL — props don't match

**Step 3: Implement new WaveformPanel**

Replace the content of `src/plugins/shared-seismogram/components/waveform-panel.tsx`:

```tsx
import React, { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { DateTime } from "luxon";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { useStores } from "../../../hooks/use-stores";
import { SharedSeismogramType } from "../shared-seismogram";
import { nanoid } from "nanoid";
import "./waveform-panel.scss";

const LOAD_VIEWPORT_DEBOUNCE_MS = 150;
const DEFAULT_CHART_HEIGHT = 150;

interface WaveformPanelProps {
  label: string;
  sharedSeismogram: SharedSeismogramType;
  startTime: DateTime;
  endTime: DateTime;
}

export const WaveformPanel: React.FC<WaveformPanelProps> = observer(function WaveformPanel({
  label,
  sharedSeismogram,
  startTime,
  endTime,
}) {
  const { seismicQueryService } = useStores();
  const containerRef = useRef<HTMLDivElement>(null);
  const uplotRef = useRef<uPlot | null>(null);
  const callerIdRef = useRef(nanoid());
  const [pixelWidth, setPixelWidth] = useState(0);

  const { network, station, location, channel } = sharedSeismogram;

  // Measure container width
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setPixelWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Debounce loadViewport
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!network || !station || !channel || pixelWidth === 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      seismicQueryService.loadViewport(callerIdRef.current, {
        network,
        station,
        location: location ?? "",
        channel,
        startTime,
        endTime,
        pixelWidth,
      });
    }, LOAD_VIEWPORT_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [network, station, location, channel, startTime, endTime, pixelWidth, seismicQueryService]);

  // Query and render
  const queryResult = (network && station && channel && pixelWidth > 0)
    ? seismicQueryService.query({
        network,
        station,
        location: location ?? "",
        channel,
        startTime,
        endTime,
        pixelWidth,
      })
    : null;

  // Create/update uPlot
  useEffect(() => {
    if (!containerRef.current || !queryResult) return;

    const data = queryResult.data as uPlot.AlignedData;

    if (uplotRef.current) {
      uplotRef.current.setData(data);
      return;
    }

    const isEnvelope = queryResult.level !== "raw";
    const opts: uPlot.Options = {
      width: pixelWidth,
      height: containerRef.current.clientHeight || DEFAULT_CHART_HEIGHT,
      cursor: { show: false },
      legend: { show: false },
      scales: {
        x: { time: true },
        y: {
          range: [-queryResult.amplitudeRange, queryResult.amplitudeRange],
        },
      },
      axes: [
        { show: false },
        { show: false },
      ],
      series: isEnvelope
        ? [
            {},
            { label: "Min", stroke: "white", width: 1 },
            {
              label: "Max",
              stroke: "white",
              width: 1,
              fill: "rgba(255, 255, 255, 0.3)",
              band: true,
            },
          ]
        : [
            {},
            { label: "Value", stroke: "white", width: 1 },
          ],
      bands: isEnvelope
        ? [{ series: [1, 2], fill: "rgba(255, 255, 255, 0.3)" }]
        : undefined,
    };

    uplotRef.current = new uPlot(opts, data, containerRef.current);

    return () => {
      uplotRef.current?.destroy();
      uplotRef.current = null;
    };
  }, [queryResult, pixelWidth]);

  return (
    <div className="waveform-panel">
      <div className="waveform-panel-label">{label}</div>
      <div ref={containerRef} className="waveform-panel-display" />
    </div>
  );
});
```

**Step 4: Run tests to verify they pass**

Run: `npx jest --no-watchman src/plugins/shared-seismogram/components/waveform-panel.test.tsx 2>&1 | tail -20`
Expected: PASS

**Step 5: Commit**

```bash
git add src/plugins/shared-seismogram/components/waveform-panel.tsx src/plugins/shared-seismogram/components/waveform-panel.test.tsx
git commit -m "feat: replace seisplotjs Seismograph with uPlot in WaveformPanel"
```

---

### Task 11: Update Timeline component

**Files:**
- Modify: `src/plugins/timeline/components/timeline.tsx`
- Modify: `src/plugins/timeline/models/timeline-content.ts`
- Modify: `src/plugins/timeline/models/timeline-content.test.ts`

**Step 1: Update TimelineContentModel**

In `src/plugins/timeline/models/timeline-content.ts`, the `seismogram` view (line 42-44) reads `self.sharedSeismogram?.seismogram` — this property no longer exists. Remove it and update to check for station data instead.

Remove:
```ts
get seismogram() {
  return self.sharedSeismogram?.seismogram;
},
```

Add:
```ts
get hasStationData() {
  const ss = self.sharedSeismogram;
  return !!(ss?.network && ss?.station && ss?.channel);
},
```

Update `dataStartTime` and `dataEndTime` to keep working (they already read from `sharedSeismogram.startTime`/`endTime`, which still exist).

**Step 2: Update Timeline component**

Replace the content of `src/plugins/timeline/components/timeline.tsx`:

```tsx
import { observer } from "mobx-react-lite";
import React, { useContext, useEffect } from "react";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { isValidDateTime } from "../../../utilities/luxon-utils";
import { WaveformPanel } from "../../shared-seismogram/components/waveform-panel";
import { isTimelineContentModel } from "../models/timeline-content";

import "./timeline.scss";

export const Timeline = observer(function Timeline() {
  const rawContent = useContext(TileModelContext)?.content;
  const model = isTimelineContentModel(rawContent) ? rawContent : undefined;

  const sharedSeismogram = model?.sharedSeismogram;
  const dataStartTime = model?.dataStartTime;
  const dataEndTime = model?.dataEndTime;
  const startTime = model?.viewStartTime;
  const endTime = model?.viewEndTime;

  // Initialize view range when data becomes available
  useEffect(() => {
    if (!model || !dataStartTime || !dataEndTime) return;
    if (!model.viewStartTime || !model.viewEndTime) {
      model.fitToData();
    } else {
      const viewStart = model.viewStartTime;
      const viewEnd = model.viewEndTime;
      const newStart = viewStart < dataStartTime ? dataStartTime : viewStart;
      const newEnd = viewEnd > dataEndTime ? dataEndTime : viewEnd;
      if (newStart >= newEnd) {
        model.fitToData();
      } else if (newStart !== viewStart || newEnd !== viewEnd) {
        model.setViewRange(newStart, newEnd);
      }
    }
  }, [model, dataStartTime, dataEndTime]);

  return (
    <div className="timeline-area">
      {sharedSeismogram && isValidDateTime(startTime) && isValidDateTime(endTime) ? (
        <WaveformPanel
          label="Full waveform"
          sharedSeismogram={sharedSeismogram}
          startTime={startTime}
          endTime={endTime}
        />
      ) : <div className="waveform" />}
    </div>
  );
});
```

**Step 3: Update timeline-content.test.ts**

In `src/plugins/timeline/models/timeline-content.test.ts`, the mock `sharedSeismogram` (line 28-31) has a `seismogram` property. Replace it to match the new shape:

Replace:
```ts
const mockSharedSeismogram = {
  startTime: dataStart,
  endTime: dataEnd,
  seismogram: {},
};
```

With:
```ts
const mockSharedSeismogram = {
  network: "AK",
  station: "K204",
  location: "",
  channel: "HNZ",
  startTime: dataStart,
  endTime: dataEnd,
};
```

**Step 4: Run tests**

Run: `npx jest --no-watchman src/plugins/timeline/ 2>&1 | tail -20`
Expected: PASS

**Step 5: Commit**

```bash
git add src/plugins/timeline/components/timeline.tsx src/plugins/timeline/models/timeline-content.ts src/plugins/timeline/models/timeline-content.test.ts
git commit -m "feat: update Timeline to pass SharedSeismogram and pixelWidth to WaveformPanel"
```

---

### Task 12: Update Wave Runner component

**Files:**
- Modify: `src/plugins/wave-runner/components/status-and-output.tsx`
- Modify: `src/plugins/wave-runner/models/wave-runner-content.ts`

**Step 1: Update WaveRunnerContentModel**

In `src/plugins/wave-runner/models/wave-runner-content.ts`:

1. Remove `import { miniseed } from "seisplotjs"` (line 2) and `import { fetchRawSeismicData }` (line 3) — these are no longer needed for data loading (the model runner still uses fetchRawSeismicData directly for its own purposes).

   Wait — the model runner's `runModel` action (line 198) still calls `fetchRawSeismicData` and `miniseed` directly for ML processing. Keep those imports. Only remove the data-loading related views.

2. Remove the views that delegate to SharedSeismogram's volatile state (lines 69-77):
```ts
get isLoading() {
  return self.sharedSeismogram?.isLoading ?? false;
},
get loadError() {
  return self.sharedSeismogram?.loadError ?? null;
},
get hasData() {
  return self.sharedSeismogram?.hasData ?? false;
},
```

Replace with:
```ts
get hasStationData() {
  const ss = self.sharedSeismogram;
  return !!(ss?.network && ss?.station && ss?.channel);
},
```

3. Update the `setStartDate` and `setEndDate` actions (lines 81-88) to update SharedSeismogram's time range instead of clearing seismogram:

```ts
setStartDate(date: string) {
  self.startDate = date;
},
setEndDate(date: string) {
  self.endDate = date;
},
```

4. Update the `setStation` action (line 88-91) to also update SharedSeismogram:

```ts
setStation(station: StationSnapshot) {
  self.station = cast(station);
  self.sharedSeismogram?.setStation(
    station.network, station.station, station.location ?? "", station.channel
  );
},
```

5. Update `loadData` action (line 94-111) to update SharedSeismogram's props instead of calling `loadData`:

```ts
async loadData() {
  if (!self.station) return;
  const smm = getSharedModelManager(self);
  if (!smm?.isReady) return;

  let sharedSeismogram = self.sharedSeismogram;
  if (!sharedSeismogram) {
    const newSharedSeismogram = SharedSeismogram.create();
    smm.addTileSharedModel(self, newSharedSeismogram, true);
    sharedSeismogram = self.sharedSeismogram ?? newSharedSeismogram;
  }

  const { network, station, location, channel } = self.station;
  sharedSeismogram.setStation(network, station, location ?? "", channel);
  sharedSeismogram.setTimeRange(
    `${self.startDate}T00:00:00Z`,
    `${self.endDate}T00:00:00Z`
  );
},
```

**Step 2: Update status-and-output.tsx**

Replace the content of `src/plugins/wave-runner/components/status-and-output.tsx`:

```tsx
import React from "react";
import { observer } from "mobx-react";
import { DateTime } from "luxon";
import { useWaveRunnerContent } from "../hooks/use-wave-runner-content";
import { WaveformPanel } from "../../shared-seismogram/components/waveform-panel";
import "./status-and-output.scss";

export const StatusAndOutput: React.FC = observer(function StatusAndOutput() {
  const model = useWaveRunnerContent();
  const sharedSeismogram = model.sharedSeismogram;
  const hasStation = model.hasStationData;

  const startTime = DateTime.fromISO(`${model.startDate}T00:00:00Z`, { zone: "utc" });
  const endTime = DateTime.fromISO(`${model.endDate}T00:00:00Z`, { zone: "utc" });

  return (
    <div className="section status-and-output">
      <div className="section-title">Status and Output</div>
      <div className="waveform-container">
        {sharedSeismogram && hasStation && (
          <WaveformPanel
            key={`${model.startDate}-${model.endDate}`}
            label={`${model.startDate} – ${model.endDate}`}
            sharedSeismogram={sharedSeismogram}
            startTime={startTime}
            endTime={endTime}
          />
        )}
      </div>
      <div className="download-status-container">
        {model.isRunning && <div>Running model...</div>}
        {model.runError && <div className="waveform-error">{model.runError}</div>}
      </div>
      <div className="estimated-time">
        {model.isRunning
          ? `Processing day ${model.chunksProcessed + 1} of ${model.chunksTotal || "?"}...`
          : model.eventsFound
            ? "Run complete."
            : "Estimated time to complete run:"}
      </div>
      <div className="status-counts-row">
        <div className="status-count">
          <label className="status-count-label">Events Identified</label>
          <div className="status-count-box">{model.eventsFound ?? ""}</div>
        </div>
        <div className="status-count">
          <label className="status-count-label">Event Categories</label>
          <div className="status-count-box" />
        </div>
      </div>
    </div>
  );
});
```

**Step 3: Run wave runner tests**

Run: `npx jest --no-watchman src/plugins/wave-runner/ 2>&1 | tail -20`
Expected: PASS (or identify test updates needed)

**Step 4: Commit**

```bash
git add src/plugins/wave-runner/models/wave-runner-content.ts src/plugins/wave-runner/components/status-and-output.tsx
git commit -m "feat: update Wave Runner to use new SharedSeismogram and WaveformPanel props"
```

---

### Task 13: Run full test suite and fix breakages

**Step 1: Run all seismic-related tests**

Run: `npx jest --no-watchman --testPathPattern="(seismic|seismogram|timeline|wave-runner)" 2>&1 | tail -40`

**Step 2: Fix any failing tests**

Common expected breakages:
- Wave runner content tests may reference `isLoading`, `loadError`, `hasData` — update to use `hasStationData`
- Any test referencing `sharedSeismogram.seismogram` or `sharedSeismogram.loadData` needs updating
- Tests mocking seisplotjs for WaveformPanel should now mock uPlot instead

Fix each failure and run again until all pass.

**Step 3: Run type check**

Run: `npx tsc --noEmit 2>&1 | tail -30`

Fix any type errors.

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: resolve test and type errors from seismic refactor"
```

---

### Task 14: Verify end-to-end with dev server

**Step 1: Start the dev server**

Run: `npm start`

**Step 2: Manual verification**

Navigate to a Timeline tile with seismic data. Verify:
- uPlot chart renders in the waveform panel
- Zooming via toolbar updates the chart
- No console errors

If mock data is available, verify envelope tiles load and display.

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```
