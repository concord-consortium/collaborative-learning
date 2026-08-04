# Envelope Generation Script Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an offline Node.js script that reads local miniSEED files, computes multi-resolution envelope tiles, and uploads them to S3.

**Architecture:** Shared pure-function modules (`shared/seismic/`) handle configuration, encoding, tile math, and envelope computation. A standalone script (`scripts/seismic/generate-envelopes.ts`) orchestrates: parse miniSEED → fetch sensitivity from EarthScope → compute L2 envelopes from raw → roll up to L1 and L0 → encode as gzipped Int16 → upload to S3 via AWS SDK. Batch mode only — wipe and regenerate.

**Tech Stack:** TypeScript, seisplotjs (miniSEED parsing), pako (gzip), @aws-sdk/client-s3, jest (testing)

**Reference docs:**
- Data format spec: `docs/seismic/envelope-tile-cache-design.md`
- Implementation design: `docs/plans/2026-03-16-envelope-tile-cache-design.md`

---

### Task 1: Seismic Types

Shared type definitions used by multiple modules.

**Files:**
- Create: `shared/seismic/seismic-types.ts`

**Step 1: Write the types**

```typescript
// shared/seismic/seismic-types.ts

/** Channel metadata from EarthScope FDSN Station service. */
export interface ChannelMetadata {
  network: string;
  station: string;
  location: string;
  channel: string;
  startTime: string;
  endTime: string;
  /** Overall sensitivity in counts per physical unit. */
  scale: number;
  scaleFreq: number;
  scaleUnits: string;
  sampleRate: number;
  /** Instrument code: second character of channel code (e.g., "H", "N"). */
  instrumentCode: string;
}

/** A time range [start, end) in seconds since Unix epoch. */
export interface TimeRange {
  start: number;
  end: number;
}

/** A single envelope data point with timestamp. */
export interface EnvelopePoint {
  time: number;
  min: number;
  max: number;
}

/** A decoded envelope tile's data arrays. */
export interface EnvelopeTileData {
  mins: Int16Array;
  maxs: Int16Array;
}
```

**Step 2: Commit**

```bash
git add shared/seismic/seismic-types.ts
git commit -m "feat: add shared seismic type definitions"
```

---

### Task 2: Envelope Config

Constants that define the level structure. Every other module imports from here.

**Files:**
- Create: `shared/seismic/envelope-config.ts`
- Test: `shared/seismic/envelope-config.test.ts`

**Step 1: Write the test**

```typescript
// shared/seismic/envelope-config.test.ts
import {
  LEVEL_SPACINGS, K_FACTOR, POINTS_PER_TILE, AMPLITUDE_RANGES,
  NO_DATA_SENTINEL, NUM_LEVELS
} from "./envelope-config";
import { getTileDuration } from "./tile-addressing";

describe("envelope-config", () => {
  it("has 3 levels", () => {
    expect(LEVEL_SPACINGS).toHaveLength(3);
    expect(POINTS_PER_TILE).toHaveLength(3);
    expect(NUM_LEVELS).toBe(3);
  });

  it("K_FACTOR matches the ratio between adjacent levels", () => {
    for (let i = 0; i < LEVEL_SPACINGS.length - 1; i++) {
      const ratio = LEVEL_SPACINGS[i] / LEVEL_SPACINGS[i + 1];
      expect(ratio).toBe(K_FACTOR);
    }
  });

  it("POINTS_PER_TILE is per-level with L2 having more points", () => {
    expect(POINTS_PER_TILE[0]).toBe(1024);
    expect(POINTS_PER_TILE[1]).toBe(1024);
    expect(POINTS_PER_TILE[2]).toBe(20480);
  });

  it("has amplitude ranges for H, L, and N instrument codes", () => {
    expect(AMPLITUDE_RANGES.H).toBe(0.05);
    expect(AMPLITUDE_RANGES.L).toBe(0.05);
    expect(AMPLITUDE_RANGES.N).toBe(40);
  });

  it("NO_DATA_SENTINEL is Int16 min", () => {
    expect(NO_DATA_SENTINEL).toBe(-32768);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest --no-watchman shared/seismic/envelope-config.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
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

/** ~6 months */
export const L0_SPACING = 15750;

/** Scale factor between adjacent levels. */
export const K_FACTOR = 100;

/** Point spacing in seconds for each level, coarsest (L0) to finest (L2). */
export const LEVEL_SPACINGS = [L0_SPACING, L0_SPACING / K_FACTOR, L0_SPACING / (K_FACTOR ** 2)];

/**
 * Number of envelope points per tile, indexed by level.
 * L2 uses 20x more points per tile to reduce total tile count.
 * L0/L1: 1024 points, L2: 20480 points.
 */
export const POINTS_PER_TILE = [1024, 1024, 20480];

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
```

**Step 4: Run test to verify it passes**

Run: `npx jest --no-watchman shared/seismic/envelope-config.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add shared/seismic/envelope-config.ts shared/seismic/envelope-config.test.ts
git commit -m "feat: add envelope config constants for seismic tile cache"
```

---

### Task 3: Tile Addressing

Pure functions for mapping timestamps to tile indices and constructing S3 keys.

**Files:**
- Create: `shared/seismic/tile-addressing.ts`
- Test: `shared/seismic/tile-addressing.test.ts`

**Step 1: Write the test**

```typescript
// shared/seismic/tile-addressing.test.ts
import { getTileIndex, getTileTimeRange, getTileIndicesForViewport, getTileS3Key, getTileDuration } from "./tile-addressing";
import { LEVEL_SPACINGS, POINTS_PER_TILE } from "./envelope-config";

describe("tile-addressing", () => {
  describe("getTileIndex", () => {
    it("returns 0 for timestamps within the first tile from epoch", () => {
      expect(getTileIndex(0, 0)).toBe(0);
      expect(getTileIndex(1, 2)).toBe(0);
    });

    it("computes correct tile index for a known timestamp", () => {
      // L2 tile duration = 1.575 * 20480 = 32256 seconds
      const tileDuration = getTileDuration(2);
      expect(getTileIndex(tileDuration * 5, 2)).toBe(5);
      expect(getTileIndex(tileDuration * 5 + 1, 2)).toBe(5);
    });

  });

  describe("getTileTimeRange", () => {
    it("returns correct range for tile 0 at each level", () => {
      for (let level = 0; level < LEVEL_SPACINGS.length; level++) {
        const range = getTileTimeRange(level, 0);
        expect(range.start).toBe(0);
        expect(range.end).toBe(getTileDuration(level));
      }
    });

    it("tiles are contiguous (end of tile N = start of tile N+1)", () => {
      const range5 = getTileTimeRange(1, 5);
      const range6 = getTileTimeRange(1, 6);
      expect(range5.end).toBe(range6.start);
    });
  });

  describe("getTileIndicesForViewport", () => {
    it("returns a single tile when viewport fits within one tile", () => {
      const tileDuration = getTileDuration(2);
      const indices = getTileIndicesForViewport(10, tileDuration - 10, 2);
      expect(indices).toEqual([0]);
    });

    it("returns multiple tiles when viewport spans tile boundaries", () => {
      const tileDuration = getTileDuration(2);
      const indices = getTileIndicesForViewport(0, tileDuration * 2.5, 2);
      expect(indices).toEqual([0, 1, 2]);
    });

    it("returns empty array for zero-width viewport", () => {
      const indices = getTileIndicesForViewport(100, 100, 1);
      expect(indices).toEqual([]);
    });
  });

  describe("getTileDuration", () => {
    it("returns spacing * points per tile for each level", () => {
      for (let level = 0; level < LEVEL_SPACINGS.length; level++) {
        expect(getTileDuration(level)).toBe(LEVEL_SPACINGS[level] * POINTS_PER_TILE[level]);
      }
    });
  });

  describe("getTileS3Key", () => {
    it("constructs the expected key format", () => {
      const key = getTileS3Key("K204", "BHZ", 2, 42);
      expect(key).toBe("K204/BHZ/L2/42");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest --no-watchman shared/seismic/tile-addressing.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
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
```

**Step 4: Run test to verify it passes**

Run: `npx jest --no-watchman shared/seismic/tile-addressing.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add shared/seismic/tile-addressing.ts shared/seismic/tile-addressing.test.ts
git commit -m "feat: add tile addressing functions for seismic envelope cache"
```

---

### Task 4: Envelope Codec

Pure functions for binary encoding/decoding of gzipped columnar Int16 tiles, plus quantization. The codec accepts variable-length arrays (tile size varies by level).

**Files:**
- Create: `shared/seismic/envelope-codec.ts`
- Test: `shared/seismic/envelope-codec.test.ts`

**Dependencies to install:** `pako` and `@types/pako`

**Step 1: Install pako**

Run: `npm install --save pako && npm install --save-dev @types/pako`

**Step 2: Write the test**

```typescript
// shared/seismic/envelope-codec.test.ts
import { encodeEnvelopeTile, decodeEnvelopeTile, quantize, dequantize } from "./envelope-codec";
import { NO_DATA_SENTINEL, NUM_LEVELS, POINTS_PER_TILE } from "./envelope-config";

describe("envelope-codec", () => {
  describe("quantize / dequantize", () => {
    it("maps zero to zero", () => {
      expect(quantize(0, 0.05)).toBe(0);
      expect(dequantize(0, 0.05)).toBe(0);
    });

    it("maps rangeMax to 32767", () => {
      expect(quantize(0.05, 0.05)).toBe(32767);
    });

    it("maps -rangeMax to -32767", () => {
      expect(quantize(-0.05, 0.05)).toBe(-32767);
    });

    it("round-trips with acceptable precision", () => {
      const rangeMax = 0.05;
      const original = 0.001; // typical teleseismic signal
      const quantized = quantize(original, rangeMax);
      const restored = dequantize(quantized, rangeMax);
      // Precision: each step = 0.05/32767 ≈ 1.5µm/s
      expect(Math.abs(restored - original)).toBeLessThan(0.000002);
    });

    it("clamps values outside the range", () => {
      expect(quantize(0.1, 0.05)).toBe(32767);
      expect(quantize(-0.1, 0.05)).toBe(-32767);
    });

    it("does not produce the sentinel value for valid inputs", () => {
      // -32768 is reserved for "no data"
      expect(quantize(-0.05, 0.05)).toBe(-32767);
    });
  });

  describe("encodeEnvelopeTile / decodeEnvelopeTile", () => {
    it("round-trips tiles at all levels", () => {
      for (let level = 0; level < NUM_LEVELS; level++) {
        const size = POINTS_PER_TILE[level];
        const mins = new Int16Array(size);
        const maxs = new Int16Array(size);
        for (let i = 0; i < size; i++) {
          mins[i] = -(i % 32767);
          maxs[i] = i % 32767;
        }

        const encoded = encodeEnvelopeTile(mins, maxs);
        expect(encoded).toBeInstanceOf(ArrayBuffer);

        const decoded = decodeEnvelopeTile(encoded);
        expect(decoded.mins).toEqual(mins);
        expect(decoded.maxs).toEqual(maxs);
      }
    });

    it("round-trips a tile with sentinel values", () => {
      const size = POINTS_PER_TILE[0];
      const mins = new Int16Array(size).fill(NO_DATA_SENTINEL);
      const maxs = new Int16Array(size).fill(NO_DATA_SENTINEL);

      const decoded = decodeEnvelopeTile(encodeEnvelopeTile(mins, maxs));
      expect(decoded.mins[0]).toBe(NO_DATA_SENTINEL);
      expect(decoded.maxs[0]).toBe(NO_DATA_SENTINEL);
    });

    it("rejects mismatched array lengths", () => {
      const mins = new Int16Array(100);
      const maxs = new Int16Array(200);
      expect(() => encodeEnvelopeTile(mins, maxs)).toThrow();
    });
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npx jest --no-watchman shared/seismic/envelope-codec.test.ts`
Expected: FAIL — module not found

**Step 4: Write the implementation**

```typescript
// shared/seismic/envelope-codec.ts
import pako from "pako";
import type { EnvelopeTileData } from "./seismic-types";

const MAX_INT16 = 32767;

/**
 * Quantize a physical amplitude value to Int16.
 * Maps [-rangeMax, +rangeMax] → [-32767, +32767].
 * Values outside the range are clamped. Never returns -32768 (sentinel).
 */
export function quantize(physicalValue: number, rangeMax: number): number {
  const scaled = (physicalValue / rangeMax) * MAX_INT16;
  return Math.max(-MAX_INT16, Math.min(MAX_INT16, Math.round(scaled)));
}

/**
 * Dequantize an Int16 value back to physical units.
 */
export function dequantize(int16Value: number, rangeMax: number): number {
  return (int16Value / MAX_INT16) * rangeMax;
}

/**
 * Encode min/max Int16 arrays into a gzipped binary buffer.
 * Layout: [mins (N × 2 bytes)] [maxs (N × 2 bytes)], gzipped.
 * Accepts any array length (tile size varies by level).
 */
export function encodeEnvelopeTile(mins: Int16Array, maxs: Int16Array): ArrayBuffer {
  if (mins.length !== maxs.length) {
    throw new Error(`mins and maxs must have the same length (got ${mins.length} and ${maxs.length})`);
  }
  const pointCount = mins.length;
  const raw = new ArrayBuffer(pointCount * 2 * 2);
  const view = new Int16Array(raw);
  view.set(mins, 0);
  view.set(maxs, pointCount);

  const compressed = pako.gzip(new Uint8Array(raw));
  return compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength);
}

/**
 * Decode a gzipped binary buffer back to min/max Int16 arrays.
 * Infers point count from the decompressed buffer size.
 */
export function decodeEnvelopeTile(buffer: ArrayBuffer): EnvelopeTileData {
  const decompressed = pako.ungzip(new Uint8Array(buffer));
  // Each point has 2 Int16 values (min + max) = 4 bytes
  const pointCount = decompressed.byteLength / 4;
  const view = new Int16Array(decompressed.buffer, decompressed.byteOffset, pointCount * 2);
  return {
    mins: view.slice(0, pointCount),
    maxs: view.slice(pointCount, pointCount * 2),
  };
}
```

**Step 5: Run test to verify it passes**

Run: `npx jest --no-watchman shared/seismic/envelope-codec.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add shared/seismic/envelope-codec.ts shared/seismic/envelope-codec.test.ts
git commit -m "feat: add envelope tile codec with gzip and Int16 quantization"
```

---

---

### Task 5: EarthScope Client

Fetch station metadata (sensitivity) from the EarthScope FDSN Station service. Used by the script to get the `Scale` value needed for amplitude quantization.

**Files:**
- Create: `shared/seismic/earthscope-client.ts`
- Test: `shared/seismic/earthscope-client.test.ts`

**Step 1: Write the test**

The EarthScope service returns pipe-delimited text. We mock `fetch` (jest-fetch-mock is already enabled globally).

```typescript
// shared/seismic/earthscope-client.test.ts
import { fetchStationMetadata } from "./earthscope-client";
import fetchMock from "jest-fetch-mock";

// Example response from EarthScope FDSN Station service (pipe-delimited text)
const MOCK_RESPONSE = `#Network|Station|Location|Channel|Latitude|Longitude|Elevation|Depth|Azimuth|Dip|SensorDescription|Scale|ScaleFreq|ScaleUnits|SampleRate|StartTime|EndTime
AK|K204|--|BHZ|64.9753|-148.158|295.0|0.0|0.0|-90.0|Streckeisen STS-2|213947.0|0.02|M/S**2|50.0|2019-09-17T00:00:00|
AK|K204|--|BNZ|64.9753|-148.158|295.0|0.0|0.0|-90.0|Kinemetrics FBA-23|1677720.0|1.0|M/S**2|50.0|2019-09-17T00:00:00|`;

describe("earthscope-client", () => {
  beforeEach(() => {
    fetchMock.resetMocks();
  });

  it("parses station metadata from text response", async () => {
    fetchMock.mockResponseOnce(MOCK_RESPONSE);

    const channels = await fetchStationMetadata("AK", "K204");
    expect(channels).toHaveLength(2);

    expect(channels[0].channel).toBe("BHZ");
    expect(channels[0].scale).toBe(213947.0);
    expect(channels[0].scaleUnits).toBe("M/S**2");
    expect(channels[0].sampleRate).toBe(50.0);
    expect(channels[0].instrumentCode).toBe("H");
  });

  it("extracts instrument code from channel name", async () => {
    fetchMock.mockResponseOnce(MOCK_RESPONSE);

    const channels = await fetchStationMetadata("AK", "K204");
    expect(channels[1].instrumentCode).toBe("N");
  });

  it("throws on HTTP error", async () => {
    fetchMock.mockResponseOnce("", { status: 404 });

    await expect(fetchStationMetadata("XX", "FAKE")).rejects.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest --no-watchman shared/seismic/earthscope-client.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
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
```

**Step 4: Run test to verify it passes**

Run: `npx jest --no-watchman shared/seismic/earthscope-client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add shared/seismic/earthscope-client.ts shared/seismic/earthscope-client.test.ts shared/seismic/seismic-types.ts
git commit -m "feat: add EarthScope client for station metadata and seismic types"
```

---

### Task 6: Envelope Compute

Pure functions for computing envelopes from raw samples and rolling up from finer to coarser levels.

**Files:**
- Create: `shared/seismic/envelope-compute.ts`
- Test: `shared/seismic/envelope-compute.test.ts`

**Step 1: Write the test**

```typescript
// shared/seismic/envelope-compute.test.ts
import { computeEnvelopesFromRaw, rollUpEnvelopes } from "./envelope-compute";
import { NO_DATA_SENTINEL } from "./envelope-config";

describe("envelope-compute", () => {
  describe("computeEnvelopesFromRaw", () => {
    it("computes min/max for each window", () => {
      // 10 samples at 10 Hz, window of 0.5s = 5 samples per window → 2 windows
      const samples = new Float64Array([1, -3, 5, 2, -1, 4, 0, -2, 6, 3]);
      const result = computeEnvelopesFromRaw(samples, 10, 0.5);

      expect(result.mins).toHaveLength(2);
      expect(result.maxs).toHaveLength(2);

      // Window 0: [1, -3, 5, 2, -1] → min=-3, max=5
      expect(result.mins[0]).toBe(-3);
      expect(result.maxs[0]).toBe(5);

      // Window 1: [4, 0, -2, 6, 3] → min=-2, max=6
      expect(result.mins[1]).toBe(-2);
      expect(result.maxs[1]).toBe(6);
    });

    it("handles a last window with fewer samples", () => {
      // 7 samples at 10 Hz, window of 0.5s = 5 samples per window
      // Window 0: [1, 2, 3, 4, 5], Window 1: [6, 7] (partial)
      const samples = new Float64Array([1, 2, 3, 4, 5, 6, 7]);
      const result = computeEnvelopesFromRaw(samples, 10, 0.5);

      expect(result.mins).toHaveLength(2);
      expect(result.mins[1]).toBe(6);
      expect(result.maxs[1]).toBe(7);
    });

    it("returns empty arrays for empty input", () => {
      const result = computeEnvelopesFromRaw(new Float64Array(0), 100, 1.0);
      expect(result.mins).toHaveLength(0);
      expect(result.maxs).toHaveLength(0);
    });
  });

  describe("rollUpEnvelopes", () => {
    it("computes coarser envelope from finer level", () => {
      // 4 finer points rolled up with k=2 → 2 coarser points
      const finerMins = new Int16Array([-100, -200, -50, -300]);
      const finerMaxs = new Int16Array([100, 200, 50, 300]);

      const result = rollUpEnvelopes(finerMins, finerMaxs, 2);

      expect(result.mins).toHaveLength(2);
      expect(result.maxs).toHaveLength(2);

      // Coarse point 0: min of [-100, -200] = -200, max of [100, 200] = 200
      expect(result.mins[0]).toBe(-200);
      expect(result.maxs[0]).toBe(200);

      // Coarse point 1: min of [-50, -300] = -300, max of [50, 300] = 300
      expect(result.mins[1]).toBe(-300);
      expect(result.maxs[1]).toBe(300);
    });

    it("skips sentinel values during rollup", () => {
      // k=2, first pair has one sentinel → only use the non-sentinel value
      const finerMins = new Int16Array([NO_DATA_SENTINEL, -100]);
      const finerMaxs = new Int16Array([NO_DATA_SENTINEL, 100]);

      const result = rollUpEnvelopes(finerMins, finerMaxs, 2);
      expect(result.mins[0]).toBe(-100);
      expect(result.maxs[0]).toBe(100);
    });

    it("produces sentinel when all finer points are sentinel", () => {
      const finerMins = new Int16Array([NO_DATA_SENTINEL, NO_DATA_SENTINEL]);
      const finerMaxs = new Int16Array([NO_DATA_SENTINEL, NO_DATA_SENTINEL]);

      const result = rollUpEnvelopes(finerMins, finerMaxs, 2);
      expect(result.mins[0]).toBe(NO_DATA_SENTINEL);
      expect(result.maxs[0]).toBe(NO_DATA_SENTINEL);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest --no-watchman shared/seismic/envelope-compute.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// shared/seismic/envelope-compute.ts
import { NO_DATA_SENTINEL } from "./envelope-config";
import type { EnvelopeTileData } from "./seismic-types";

/**
 * Compute envelope (min/max pairs) from raw samples.
 *
 * @param samples - Raw sample values in physical units
 * @param sampleRate - Samples per second
 * @param windowSeconds - Duration of each envelope window in seconds
 * @returns Arrays of min and max values, one per window
 */
export function computeEnvelopesFromRaw(
  samples: Float64Array,
  sampleRate: number,
  windowSeconds: number
): { mins: number[]; maxs: number[] } {
  if (samples.length === 0) return { mins: [], maxs: [] };

  const samplesPerWindow = Math.round(sampleRate * windowSeconds);
  const numWindows = Math.ceil(samples.length / samplesPerWindow);
  const mins: number[] = [];
  const maxs: number[] = [];

  for (let w = 0; w < numWindows; w++) {
    const start = w * samplesPerWindow;
    const end = Math.min(start + samplesPerWindow, samples.length);
    let min = samples[start];
    let max = samples[start];
    for (let i = start + 1; i < end; i++) {
      if (samples[i] < min) min = samples[i];
      if (samples[i] > max) max = samples[i];
    }
    mins.push(min);
    maxs.push(max);
  }

  return { mins, maxs };
}

/**
 * Roll up a finer envelope level to produce a coarser level.
 * Each coarser point is the min/max of k consecutive finer points.
 * Sentinel values are skipped; if all k points are sentinels, the coarser point is also sentinel.
 */
export function rollUpEnvelopes(
  finerMins: Int16Array,
  finerMaxs: Int16Array,
  k: number
): EnvelopeTileData {
  const coarseCount = Math.ceil(finerMins.length / k);
  const mins = new Int16Array(coarseCount);
  const maxs = new Int16Array(coarseCount);

  for (let c = 0; c < coarseCount; c++) {
    const start = c * k;
    const end = Math.min(start + k, finerMins.length);
    let minVal = NO_DATA_SENTINEL;
    let maxVal = NO_DATA_SENTINEL;
    let hasData = false;

    for (let i = start; i < end; i++) {
      if (finerMins[i] === NO_DATA_SENTINEL) continue;
      if (!hasData) {
        minVal = finerMins[i];
        maxVal = finerMaxs[i];
        hasData = true;
      } else {
        if (finerMins[i] < minVal) minVal = finerMins[i];
        if (finerMaxs[i] > maxVal) maxVal = finerMaxs[i];
      }
    }

    mins[c] = minVal;
    maxs[c] = maxVal;
  }

  return { mins, maxs };
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest --no-watchman shared/seismic/envelope-compute.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add shared/seismic/envelope-compute.ts shared/seismic/envelope-compute.test.ts
git commit -m "feat: add envelope computation and level rollup functions"
```

---

### Task 7: Generate Envelopes Script

The batch script that ties everything together: reads local miniSEED files, fetches sensitivity, computes envelopes at all 3 levels, and uploads tiles to S3.

**Files:**
- Create: `scripts/seismic/generate-envelopes.ts`
- Modify: `scripts/package.json` (add dependencies)

**Step 1: Install script dependencies**

```bash
cd scripts && npm install @aws-sdk/client-s3 pako seisplotjs && cd ..
```

Note: seisplotjs is already a dependency in the root package.json but the `scripts/` directory has its own `package.json` and `node_modules`. pako is needed here for encoding.

**Step 2: Write the script**

```typescript
// scripts/seismic/generate-envelopes.ts
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { miniseed } from "seisplotjs";
import {
  LEVEL_SPACINGS, POINTS_PER_TILE, K_FACTOR, NUM_LEVELS,
  AMPLITUDE_RANGES, NO_DATA_SENTINEL
} from "../../shared/seismic/envelope-config";
import { getTileIndex, getTileTimeRange, getTileS3Key, getTileDuration } from "../../shared/seismic/tile-addressing";
import { encodeEnvelopeTile, quantize } from "../../shared/seismic/envelope-codec";
import { computeEnvelopesFromRaw, rollUpEnvelopes } from "../../shared/seismic/envelope-compute";
import { fetchStationMetadata } from "../../shared/seismic/earthscope-client";
import type { ChannelMetadata, EnvelopePoint, EnvelopeTileData } from "../../shared/seismic/seismic-types";

// ---- Configuration ----

const DEFAULT_S3_BUCKET = "models-resources";
const DEFAULT_S3_PREFIX = "collaborative-learning/envelopes/";
const DEFAULT_AWS_REGION = "us-east-1";

interface ScriptConfig {
  /** Path to ROVER data root (e.g., "<datarepo>/data/") */
  inputDir: string;
  /** SEED network code (e.g., "AK") */
  network: string;
  /** SEED station code (e.g., "K204") */
  station: string;
  /** SEED channel code (e.g., "BHZ"). If omitted, processes all channels found. */
  channel?: string;
  /** S3 bucket name */
  s3Bucket: string;
  /** S3 key prefix (e.g., "envelopes/") */
  s3Prefix: string;
  /** AWS region */
  awsRegion: string;
}

function parseArgs(): ScriptConfig {
  const args = process.argv.slice(2);
  const config: Partial<ScriptConfig> = {
    s3Bucket: DEFAULT_S3_BUCKET,
    s3Prefix: DEFAULT_S3_PREFIX,
    awsRegion: DEFAULT_AWS_REGION,
  };

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    switch (key) {
      case "--input-dir": config.inputDir = value; break;
      case "--network": config.network = value; break;
      case "--station": config.station = value; break;
      case "--channel": config.channel = value; break;
      case "--s3-bucket": config.s3Bucket = value; break;
      case "--s3-prefix": config.s3Prefix = value; break;
      case "--aws-region": config.awsRegion = value; break;
      default:
        console.error(`Unknown argument: ${key}`);
        process.exit(1);
    }
  }

  if (!config.inputDir || !config.network || !config.station) {
    console.error("Usage: npx tsx scripts/seismic/generate-envelopes.ts \\");
    console.error("  --input-dir <path> --network <net> --station <sta> \\");
    console.error("  [--channel <chan>] [--s3-bucket <bucket>] [--s3-prefix <prefix>] [--aws-region <region>]");
    process.exit(1);
  }

  return config as ScriptConfig;
}

// ---- miniSEED Parsing ----

interface RawTrace {
  channel: string;
  sampleRate: number;
  /** Start time in seconds since Unix epoch */
  startTime: number;
  /** Samples as raw counts (integers) */
  samples: Float64Array;
}

/**
 * Find all ROVER miniSEED files for a given network and station.
 * ROVER stores files as: <dataRoot>/<network>/<year>/<dayOfYear>/<station>.<network>.<year>.<dayOfYear>
 */
function findRoverFiles(dataRoot: string, network: string, station: string): string[] {
  const networkDir = join(dataRoot, network);
  const files: string[] = [];

  for (const year of readdirSync(networkDir)) {
    const yearDir = join(networkDir, year);
    if (!statSync(yearDir).isDirectory()) continue;
    for (const day of readdirSync(yearDir)) {
      const dayDir = join(yearDir, day);
      if (!statSync(dayDir).isDirectory()) continue;
      const expected = `${station}.${network}.${year}.${day}`;
      const filePath = join(dayDir, expected);
      try {
        statSync(filePath);
        files.push(filePath);
      } catch {
        // File doesn't exist for this day — skip
      }
    }
  }

  return files;
}

function loadMiniSeedFiles(dataRoot: string, network: string, station: string): RawTrace[] {
  const files = findRoverFiles(dataRoot, network, station);
  if (files.length === 0) {
    throw new Error(`No ROVER files found for ${network}.${station} in ${dataRoot}`);
  }
  console.log(`Found ${files.length} ROVER file(s)`);

  const traces: RawTrace[] = [];
  for (const filePath of files) {
    const buffer = readFileSync(filePath);
    const arrayBuf = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const records = miniseed.parseDataRecords(arrayBuf);
    const seismograms = miniseed.seismogramPerChannel(records);

    for (const seis of seismograms) {
      const segments = seis.segments;
      for (const seg of segments) {
        traces.push({
          channel: seis.channelCode,
          sampleRate: seg.sampleRate,
          startTime: seg.startTime.toEpochSecond(),
          samples: new Float64Array(seg.y),
        });
      }
    }
  }

  console.log(`Loaded ${traces.length} trace segment(s)`);
  return traces;
}

// ---- Sensitivity Lookup ----

function findSensitivity(
  metadata: ChannelMetadata[],
  channel: string,
  timeSec: number
): { scale: number; instrumentCode: string } {
  // Find the channel metadata entry that covers this time
  const matching = metadata.filter(m => m.channel === channel);
  if (matching.length === 0) {
    throw new Error(`No metadata found for channel ${channel}`);
  }

  for (const m of matching) {
    const start = new Date(m.startTime).getTime() / 1000;
    const end = m.endTime === "" ? Infinity : new Date(m.endTime).getTime() / 1000;
    if (timeSec >= start && timeSec < end) {
      return { scale: m.scale, instrumentCode: m.instrumentCode };
    }
  }

  // Fall back to the most recent entry
  console.warn(`No metadata time match for channel ${channel} at ${timeSec}, using latest`);
  const last = matching[matching.length - 1];
  return { scale: last.scale, instrumentCode: last.instrumentCode };
}

// ---- Tile Assembly ----

function assembleTiles(
  level: number,
  envelopePoints: EnvelopePoint[],
  rangeMax: number
): Map<number, EnvelopeTileData> {
  const tiles = new Map<number, EnvelopeTileData>();
  const pointsPerTile = POINTS_PER_TILE[level];

  for (const pt of envelopePoints) {
    const tileIdx = getTileIndex(pt.time, level);
    if (!tiles.has(tileIdx)) {
      const mins = new Int16Array(pointsPerTile).fill(NO_DATA_SENTINEL);
      const maxs = new Int16Array(pointsPerTile).fill(NO_DATA_SENTINEL);
      tiles.set(tileIdx, { mins, maxs });
    }

    const tile = tiles.get(tileIdx)!;
    const tileRange = getTileTimeRange(level, tileIdx);
    const pointIndex = Math.floor((pt.time - tileRange.start) / LEVEL_SPACINGS[level]);

    if (pointIndex >= 0 && pointIndex < pointsPerTile) {
      const qMin = quantize(pt.min, rangeMax);
      const qMax = quantize(pt.max, rangeMax);

      if (tile.mins[pointIndex] === NO_DATA_SENTINEL) {
        tile.mins[pointIndex] = qMin;
        tile.maxs[pointIndex] = qMax;
      } else {
        // Merge: keep the more extreme values
        tile.mins[pointIndex] = Math.min(tile.mins[pointIndex], qMin) as number;
        tile.maxs[pointIndex] = Math.max(tile.maxs[pointIndex], qMax) as number;
      }
    }
  }

  return tiles;
}

// ---- S3 Operations ----

async function wipeExistingTiles(
  s3: S3Client,
  bucket: string,
  prefix: string,
  station: string,
  channel: string
): Promise<void> {
  const keyPrefix = `${prefix}${station}/${channel}/`;
  console.log(`Wiping existing tiles under ${keyPrefix}...`);

  let continuationToken: string | undefined;
  do {
    const list = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: keyPrefix,
      ContinuationToken: continuationToken,
    }));

    if (list.Contents && list.Contents.length > 0) {
      await s3.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: list.Contents.map(obj => ({ Key: obj.Key })),
        },
      }));
      console.log(`  Deleted ${list.Contents.length} object(s)`);
    }

    continuationToken = list.NextContinuationToken;
  } while (continuationToken);
}

async function uploadTiles(
  s3: S3Client,
  bucket: string,
  prefix: string,
  station: string,
  channel: string,
  level: number,
  tiles: Map<number, EnvelopeTileData>
): Promise<void> {
  console.log(`Uploading ${tiles.size} L${level} tile(s)...`);
  let count = 0;

  for (const [tileIdx, tile] of tiles) {
    const key = `${prefix}${getTileS3Key(station, channel, level, tileIdx)}`;
    const body = encodeEnvelopeTile(tile.mins, tile.maxs);

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: new Uint8Array(body),
      ContentType: "application/octet-stream",
      ContentEncoding: "gzip",
    }));

    count++;
    if (count % 100 === 0) {
      console.log(`  Uploaded ${count}/${tiles.size}`);
    }
  }

  console.log(`  Done: ${count} L${level} tile(s) uploaded`);
}

// ---- Main ----

async function main() {
  const config = parseArgs();
  const prefix = config.s3Prefix;

  // 1. Load miniSEED files
  console.log(`Loading ROVER data from ${config.inputDir} for ${config.network}.${config.station}...`);
  const traces = loadMiniSeedFiles(config.inputDir, config.network, config.station);

  // 2. Fetch station metadata
  console.log(`Fetching station metadata for ${config.network}.${config.station}...`);
  const metadata = await fetchStationMetadata(config.network, config.station);
  console.log(`  Found ${metadata.length} channel(s)`);

  // 3. Group traces by channel
  const tracesByChannel = new Map<string, RawTrace[]>();
  for (const trace of traces) {
    if (config.channel && trace.channel !== config.channel) continue;
    if (!tracesByChannel.has(trace.channel)) {
      tracesByChannel.set(trace.channel, []);
    }
    tracesByChannel.get(trace.channel)!.push(trace);
  }

  if (tracesByChannel.size === 0) {
    console.error("No traces found for the specified channel(s)");
    process.exit(1);
  }

  // 4. Process each channel
  const s3 = new S3Client({ region: config.awsRegion });

  for (const [channel, channelTraces] of tracesByChannel) {
    console.log(`\nProcessing channel ${channel} (${channelTraces.length} trace segments)...`);

    // Determine instrument code and rangeMax from first trace
    const { instrumentCode } = findSensitivity(metadata, channel, channelTraces[0].startTime);
    const rangeMax = AMPLITUDE_RANGES[instrumentCode];
    if (!rangeMax) {
      console.warn(`Unknown instrument code "${instrumentCode}" for channel ${channel}, skipping`);
      continue;
    }
    console.log(`  Instrument: ${instrumentCode}, range: ±${rangeMax}`);

    // Sort traces by start time
    channelTraces.sort((a, b) => a.startTime - b.startTime);

    // Compute L2 envelopes from raw data
    const finestLevel = NUM_LEVELS - 1;
    console.log("  Computing L2 envelopes from raw data...");
    const l2Points: EnvelopePoint[] = [];

    for (const trace of channelTraces) {
      // Look up scale for this trace's time range (may differ across epochs)
      const { scale } = findSensitivity(metadata, channel, trace.startTime);
      const physicalSamples = new Float64Array(trace.samples.length);
      for (let i = 0; i < trace.samples.length; i++) {
        physicalSamples[i] = trace.samples[i] / scale;
      }

      const { mins, maxs } = computeEnvelopesFromRaw(
        physicalSamples, trace.sampleRate, LEVEL_SPACINGS[finestLevel]
      );

      for (let i = 0; i < mins.length; i++) {
        const time = trace.startTime + i * LEVEL_SPACINGS[finestLevel];
        l2Points.push({ time, min: mins[i], max: maxs[i] });
      }
    }
    console.log(`  Generated ${l2Points.length} L2 envelope points`);

    // Assemble L2 tiles
    const allTiles: Array<Map<number, EnvelopeTileData>> = new Array(NUM_LEVELS);
    allTiles[finestLevel] = assembleTiles(finestLevel, l2Points, rangeMax);

    // Roll up L2 → L1 → L0
    for (let level = NUM_LEVELS - 2; level >= 0; level--) {
      console.log(`  Rolling up L${level + 1} → L${level}...`);
      const finerTiles = allTiles[level + 1];

      // Collect all finer-level data points in order
      const finerTileIndices = [...finerTiles.keys()];
      const allMins: number[] = [];
      const allMaxs: number[] = [];
      const allTimes: number[] = [];
      const finerPointsPerTile = POINTS_PER_TILE[level + 1];

      for (const tileIdx of finerTileIndices) {
        const tile = finerTiles.get(tileIdx)!;
        const tileRange = getTileTimeRange(level + 1, tileIdx);
        for (let i = 0; i < finerPointsPerTile; i++) {
          allMins.push(tile.mins[i]);
          allMaxs.push(tile.maxs[i]);
          allTimes.push(tileRange.start + i * LEVEL_SPACINGS[level + 1]);
        }
      }

      const rolledUp = rollUpEnvelopes(
        new Int16Array(allMins),
        new Int16Array(allMaxs),
        K_FACTOR
      );

      // Convert rolled-up Int16 values back to timed points for tile assembly
      const coarserPoints: EnvelopePoint[] = [];
      for (let i = 0; i < rolledUp.mins.length; i++) {
        if (rolledUp.mins[i] === NO_DATA_SENTINEL) continue;
        const time = allTimes[i * K_FACTOR] ?? allTimes[0] + i * LEVEL_SPACINGS[level];
        // Dequantize from Int16 back to physical units for re-assembly
        coarserPoints.push({
          time,
          min: (rolledUp.mins[i] / 32767) * rangeMax,
          max: (rolledUp.maxs[i] / 32767) * rangeMax,
        });
      }

      allTiles[level] = assembleTiles(level, coarserPoints, rangeMax);
      console.log(`  Generated ${allTiles[level].size} L${level} tile(s)`);
    }

    // Wipe existing tiles for this station/channel
    await wipeExistingTiles(s3, config.s3Bucket, prefix, config.station, channel);

    // Upload all levels
    for (let level = 0; level < NUM_LEVELS; level++) {
      await uploadTiles(s3, config.s3Bucket, prefix, config.station, channel, level, allTiles[level]);
    }

    console.log(`  Channel ${channel} complete.`);
  }

  console.log("\nDone!");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
```

**Step 3: Verify script compiles**

Run: `cd scripts && npx tsx --check seismic/generate-envelopes.ts; cd ..`

Note: A full integration test is not included here because the script requires local miniSEED files and AWS credentials. Manual testing procedure:

1. Download miniSEED data via ROVER for a test station
2. Run the script against a test S3 bucket:
   ```bash
   cd scripts && npx tsx seismic/generate-envelopes.ts \
     --input-dir /path/to/rover/data \
     --network AK --station K204 \
     --s3-bucket my-test-bucket \
     --s3-prefix envelopes/
   ```
3. Verify tiles exist in S3: `aws s3 ls s3://my-test-bucket/envelopes/K204/BHZ/`
4. Spot-check a tile by downloading and decoding it

**Step 4: Commit**

```bash
git add scripts/seismic/generate-envelopes.ts scripts/package.json scripts/package-lock.json
git commit -m "feat: add envelope generation script for seismic tile cache"
```

---

### Task 8: End-to-End Verification

Manually verify the full pipeline works with real data.

**Step 1: Download test data via ROVER**

Follow ROVER documentation to download a few days of data for a test station (e.g., AK.K204.BHZ).

**Step 2: Run the script**

```bash
cd scripts && npx tsx seismic/generate-envelopes.ts \
  --input-dir /path/to/rover/data \
  --network AK --station K204 --channel BHZ
```

**Step 3: Verify output**

- Check S3 for tiles at all 3 levels: `aws s3 ls s3://models-resources/collaborative-learning/envelopes/K204/BHZ/`
- Verify L0 has ~2 tiles, L1 has proportionally more, L2 has the most
- Download a tile and decode it in a Node REPL to confirm valid Int16 data:

```typescript
import { decodeEnvelopeTile } from "../../shared/seismic/envelope-codec";
import { readFileSync } from "fs";

const buf = readFileSync("downloaded-tile.bin");
const { mins, maxs } = decodeEnvelopeTile(buf.buffer);
console.log("Point count:", mins.length);
console.log("First 10 mins:", Array.from(mins.slice(0, 10)));
console.log("First 10 maxs:", Array.from(maxs.slice(0, 10)));
```

**Step 4: Commit any fixes**

If any issues are found during manual testing, fix them and commit.
