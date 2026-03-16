# Envelope Tile Cache Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hardcoded S3 miniSEED loading with a multi-resolution envelope tile cache that fetches envelopes from S3 and raw data from EarthScope, with browser-side envelope computation and upload.

**Architecture:** SharedSeismogram MST model orchestrates data loading. Pure utility modules handle envelope encoding/decoding, tile addressing, EarthScope fetching, envelope computation, and S3 read/write. A canvas-based WaveformPanel replaces the seisplotjs renderer.

**Tech Stack:** TypeScript, MobX State Tree, Canvas 2D API, pako (gzip), seisplotjs (miniSEED parsing only), jest-fetch-mock

**Reference docs:**
- Data format spec: `docs/seismic/envelope-tile-cache-design.md`
- Implementation design: `docs/plans/2026-03-16-envelope-tile-cache-design.md`

---

### Task 1: Envelope Config

Constants that define the level structure. Every other module imports from here.

**Files:**
- Create: `src/plugins/shared-seismogram/envelope-config.ts`
- Test: `src/plugins/shared-seismogram/envelope-config.test.ts`

**Step 1: Write the config module**

```typescript
// envelope-config.ts

/**
 * Envelope tile cache configuration.
 * Level spacings must satisfy the integer multiple constraint:
 * each level's spacing must be an exact integer multiple of the next finer level.
 *
 * Starting configuration: L0 targets ~6 months, K ≈ 100.
 * See docs/seismic/envelope-tile-cache-design.md for rationale.
 */

// Point spacing in seconds for each envelope level, coarsest to finest.
// L0 ≈ 15,750s, L1 ≈ 157.5s, L2 ≈ 1.575s
// Exact values chosen so each is an integer multiple of the next: 15750 / 157.5 = 100, 157.5 / 1.575 = 100.
export const LEVEL_SPACINGS = [15750, 157.5, 1.575] as const;

// Scale factor between adjacent levels.
export const K_FACTOR = 100;

// Number of envelope points per tile (all levels).
export const POINTS_PER_TILE = 1024;

// Number of envelope levels (derived from LEVEL_SPACINGS).
export const NUM_LEVELS = LEVEL_SPACINGS.length;

// Int16 sentinel value meaning "no data at this position".
export const NO_DATA_SENTINEL = -32768;

// Fixed amplitude ranges by instrument code (second character of SEED channel code).
// Values are the maximum physical amplitude that maps to Int16 max (32767).
// Units: m/s for velocity sensors (H, L), m/s² for accelerometers (N).
export const AMPLITUDE_RANGES: Record<string, number> = {
  H: 0.05,   // High-gain seismometer, velocity, ±0.05 m/s
  L: 0.05,   // Low-gain seismometer, velocity, ±0.05 m/s
  N: 40,     // Accelerometer, acceleration, ±40 m/s²
};

// Maximum Int16 value used for quantization (reserve -32768 as sentinel).
export const INT16_MAX = 32767;

// Tile duration in seconds for each level: POINTS_PER_TILE * spacing.
export const TILE_DURATIONS = LEVEL_SPACINGS.map(s => POINTS_PER_TILE * s);

// S3 base URL for envelope tile storage.
export const ENVELOPE_S3_BASE = "https://models-resources.s3.amazonaws.com/collaborative-learning/envelopes";
```

**Step 2: Write tests**

```typescript
// envelope-config.test.ts
import {
  LEVEL_SPACINGS, K_FACTOR, POINTS_PER_TILE, NUM_LEVELS,
  NO_DATA_SENTINEL, AMPLITUDE_RANGES, INT16_MAX, TILE_DURATIONS
} from "./envelope-config";

describe("envelope-config", () => {
  it("has 3 envelope levels", () => {
    expect(NUM_LEVELS).toBe(3);
    expect(LEVEL_SPACINGS).toHaveLength(3);
  });

  it("spacings satisfy the integer multiple constraint", () => {
    for (let i = 0; i < LEVEL_SPACINGS.length - 1; i++) {
      const ratio = LEVEL_SPACINGS[i] / LEVEL_SPACINGS[i + 1];
      expect(ratio).toBe(K_FACTOR);
    }
  });

  it("tile durations are derived correctly", () => {
    TILE_DURATIONS.forEach((dur, i) => {
      expect(dur).toBe(POINTS_PER_TILE * LEVEL_SPACINGS[i]);
    });
  });

  it("sentinel is Int16 minimum", () => {
    expect(NO_DATA_SENTINEL).toBe(-32768);
  });

  it("has amplitude ranges for expected instrument codes", () => {
    expect(AMPLITUDE_RANGES.H).toBe(0.05);
    expect(AMPLITUDE_RANGES.L).toBe(0.05);
    expect(AMPLITUDE_RANGES.N).toBe(40);
  });
});
```

**Step 3: Run tests**

Run: `npx jest --no-watchman src/plugins/shared-seismogram/envelope-config.test.ts`
Expected: All pass.

**Step 4: Commit**

```
feat: add envelope tile cache configuration constants
```

---

### Task 2: Envelope Codec

Pure functions for encoding/decoding gzipped columnar Int16 tile buffers, plus amplitude quantization.

**Files:**
- Create: `src/plugins/shared-seismogram/utils/envelope-codec.ts`
- Test: `src/plugins/shared-seismogram/utils/envelope-codec.test.ts`

**Step 1: Write the failing tests**

```typescript
// envelope-codec.test.ts
import { quantize, dequantize, encodeEnvelopeTile, decodeEnvelopeTile } from "./envelope-codec";
import { NO_DATA_SENTINEL, INT16_MAX } from "../envelope-config";

describe("quantize", () => {
  it("maps zero to zero", () => {
    expect(quantize(0, 0.05)).toBe(0);
  });

  it("maps positive range max to INT16_MAX", () => {
    expect(quantize(0.05, 0.05)).toBe(INT16_MAX);
  });

  it("maps negative range max to -INT16_MAX", () => {
    expect(quantize(-0.05, 0.05)).toBe(-INT16_MAX);
  });

  it("clamps values beyond range", () => {
    expect(quantize(0.1, 0.05)).toBe(INT16_MAX);
    expect(quantize(-0.1, 0.05)).toBe(-INT16_MAX);
  });

  it("maps intermediate values proportionally", () => {
    const result = quantize(0.025, 0.05);
    expect(result).toBe(Math.round(0.5 * INT16_MAX));
  });

  it("never produces the sentinel value", () => {
    // -rangeMax maps to -32767, not -32768
    expect(quantize(-0.05, 0.05)).not.toBe(NO_DATA_SENTINEL);
  });
});

describe("dequantize", () => {
  it("maps zero to zero", () => {
    expect(dequantize(0, 0.05)).toBe(0);
  });

  it("round-trips through quantize/dequantize with small error", () => {
    const original = 0.0123;
    const rangeMax = 0.05;
    const q = quantize(original, rangeMax);
    const recovered = dequantize(q, rangeMax);
    expect(Math.abs(recovered - original)).toBeLessThan(rangeMax / INT16_MAX * 2);
  });
});

describe("encodeEnvelopeTile / decodeEnvelopeTile", () => {
  it("round-trips a tile of data", async () => {
    const mins = new Int16Array(1024);
    const maxs = new Int16Array(1024);
    for (let i = 0; i < 1024; i++) {
      mins[i] = -100 - i;
      maxs[i] = 100 + i;
    }

    const encoded = await encodeEnvelopeTile(mins, maxs);
    expect(encoded).toBeInstanceOf(ArrayBuffer);
    // Gzipped should be smaller than raw (4096 bytes)
    expect(encoded.byteLength).toBeLessThan(4096);

    const decoded = await decodeEnvelopeTile(encoded);
    expect(decoded.mins).toEqual(mins);
    expect(decoded.maxs).toEqual(maxs);
  });

  it("round-trips a tile with sentinel values", async () => {
    const mins = new Int16Array(1024).fill(NO_DATA_SENTINEL);
    const maxs = new Int16Array(1024).fill(NO_DATA_SENTINEL);
    mins[500] = -50;
    maxs[500] = 50;

    const encoded = await encodeEnvelopeTile(mins, maxs);
    const decoded = await decodeEnvelopeTile(encoded);
    expect(decoded.mins[0]).toBe(NO_DATA_SENTINEL);
    expect(decoded.mins[500]).toBe(-50);
    expect(decoded.maxs[500]).toBe(50);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest --no-watchman src/plugins/shared-seismogram/utils/envelope-codec.test.ts`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

Note: This project uses webpack which can handle `pako`. Check if pako is already a dependency; if not, `npm install pako` and `npm install -D @types/pako`.

```typescript
// envelope-codec.ts
import pako from "pako";
import { INT16_MAX, NO_DATA_SENTINEL, POINTS_PER_TILE } from "../envelope-config";

/**
 * Quantize a physical amplitude value to Int16.
 * Maps [-rangeMax, +rangeMax] to [-32767, +32767].
 * Clamps values beyond the range. Never produces the sentinel value (-32768).
 */
export function quantize(physicalValue: number, rangeMax: number): number {
  const normalized = physicalValue / rangeMax;
  const clamped = Math.max(-1, Math.min(1, normalized));
  return Math.round(clamped * INT16_MAX);
}

/**
 * Dequantize an Int16 value back to physical units.
 */
export function dequantize(int16Value: number, rangeMax: number): number {
  return (int16Value / INT16_MAX) * rangeMax;
}

/**
 * Encode min/max Int16Arrays into a gzipped columnar buffer.
 * Layout: [all mins contiguously][all maxs contiguously], then gzipped.
 */
export async function encodeEnvelopeTile(mins: Int16Array, maxs: Int16Array): Promise<ArrayBuffer> {
  const raw = new ArrayBuffer(mins.byteLength + maxs.byteLength);
  const view = new Int16Array(raw);
  view.set(mins, 0);
  view.set(maxs, mins.length);
  const compressed = pako.gzip(new Uint8Array(raw));
  return compressed.buffer;
}

/**
 * Decode a gzipped columnar buffer into min/max Int16Arrays.
 */
export async function decodeEnvelopeTile(
  buffer: ArrayBuffer
): Promise<{ mins: Int16Array; maxs: Int16Array }> {
  const decompressed = pako.ungzip(new Uint8Array(buffer));
  const int16 = new Int16Array(decompressed.buffer);
  const half = int16.length / 2;
  return {
    mins: int16.slice(0, half),
    maxs: int16.slice(half),
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx jest --no-watchman src/plugins/shared-seismogram/utils/envelope-codec.test.ts`
Expected: All pass.

**Step 5: Commit**

```
feat: add envelope codec for gzipped Int16 tile encoding/decoding
```

---

### Task 3: Tile Addressing

Pure math for mapping timestamps to tile indices and S3 keys.

**Files:**
- Create: `src/plugins/shared-seismogram/utils/tile-addressing.ts`
- Test: `src/plugins/shared-seismogram/utils/tile-addressing.test.ts`

**Step 1: Write the failing tests**

```typescript
// tile-addressing.test.ts
import { getTileIndex, getTileTimeRange, getTileIndicesForViewport, getTileS3Key } from "./tile-addressing";
import { TILE_DURATIONS, LEVEL_SPACINGS, POINTS_PER_TILE } from "../envelope-config";

describe("getTileIndex", () => {
  it("returns 0 for timestamp 0 (Unix epoch)", () => {
    expect(getTileIndex(0, 0)).toBe(0);
  });

  it("returns correct index for a known timestamp", () => {
    // L2 tile duration = 1024 * 1.575 = 1612.8 seconds
    // timestamp 2000s → tile index = floor(2000 / 1612.8) = 1
    expect(getTileIndex(2000, 2)).toBe(1);
  });

  it("handles level 0 with large timestamps", () => {
    // L0 tile duration = 1024 * 15750 = 16,128,000 seconds
    // 2026-01-01T00:00:00Z = 1767225600
    // tile index = floor(1767225600 / 16128000) = 109
    expect(getTileIndex(1767225600, 0)).toBe(109);
  });
});

describe("getTileTimeRange", () => {
  it("returns correct range for tile 0 at level 2", () => {
    const range = getTileTimeRange(2, 0);
    expect(range.start).toBe(0);
    expect(range.end).toBe(TILE_DURATIONS[2]);
  });

  it("returns correct range for tile 1 at level 2", () => {
    const range = getTileTimeRange(2, 1);
    expect(range.start).toBe(TILE_DURATIONS[2]);
    expect(range.end).toBe(2 * TILE_DURATIONS[2]);
  });
});

describe("getTileIndicesForViewport", () => {
  it("returns a single tile when viewport fits within one tile", () => {
    const tileDur = TILE_DURATIONS[2]; // 1612.8s
    const indices = getTileIndicesForViewport(100, 200, 2);
    expect(indices).toEqual([0]);
  });

  it("returns multiple tiles when viewport spans tile boundaries", () => {
    const tileDur = TILE_DURATIONS[2]; // 1612.8s
    const indices = getTileIndicesForViewport(tileDur - 100, tileDur + 100, 2);
    expect(indices).toEqual([0, 1]);
  });

  it("returns all tiles for a large viewport", () => {
    const tileDur = TILE_DURATIONS[2];
    const indices = getTileIndicesForViewport(0, tileDur * 3 + 1, 2);
    expect(indices).toEqual([0, 1, 2, 3]);
  });
});

describe("getTileS3Key", () => {
  it("constructs correct key", () => {
    const key = getTileS3Key("AK.K204", "HNZ", 2, 42);
    expect(key).toBe("AK.K204/HNZ/L2/42");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest --no-watchman src/plugins/shared-seismogram/utils/tile-addressing.test.ts`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

```typescript
// tile-addressing.ts
import { TILE_DURATIONS, LEVEL_SPACINGS, POINTS_PER_TILE } from "../envelope-config";

/**
 * Get the tile index for a given Unix timestamp at a given level.
 * Tiles are sequential from Unix epoch: index = floor(timestamp / tileDuration).
 */
export function getTileIndex(timestampSeconds: number, level: number): number {
  return Math.floor(timestampSeconds / TILE_DURATIONS[level]);
}

/**
 * Get the time range (in Unix seconds) covered by a tile.
 */
export function getTileTimeRange(
  level: number,
  tileIndex: number
): { start: number; end: number } {
  const start = tileIndex * TILE_DURATIONS[level];
  const end = start + TILE_DURATIONS[level];
  return { start, end };
}

/**
 * Get all tile indices needed to cover a viewport time range at a given level.
 */
export function getTileIndicesForViewport(
  startTimeSeconds: number,
  endTimeSeconds: number,
  level: number
): number[] {
  const firstTile = getTileIndex(startTimeSeconds, level);
  const lastTile = getTileIndex(endTimeSeconds, level);
  const indices: number[] = [];
  for (let i = firstTile; i <= lastTile; i++) {
    indices.push(i);
  }
  return indices;
}

/**
 * Construct the S3 object key for a tile.
 * Format: {station}/{channel}/L{level}/{tileIndex}
 */
export function getTileS3Key(
  station: string,
  channel: string,
  level: number,
  tileIndex: number
): string {
  return `${station}/${channel}/L${level}/${tileIndex}`;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx jest --no-watchman src/plugins/shared-seismogram/utils/tile-addressing.test.ts`
Expected: All pass.

**Step 5: Commit**

```
feat: add tile addressing math for envelope tile cache
```

---

### Task 4: EarthScope Client

Fetching raw miniSEED data and station metadata from EarthScope FDSN services.

**Files:**
- Create: `src/plugins/shared-seismogram/utils/earthscope-client.ts`
- Test: `src/plugins/shared-seismogram/utils/earthscope-client.test.ts`

**Step 1: Write the failing tests**

The project uses `jest-fetch-mock` which is enabled globally in setupTests.ts. Use `fetchMock` to mock HTTP responses.

```typescript
// earthscope-client.test.ts
import { fetchRawData, fetchStationMetadata } from "./earthscope-client";

// jest-fetch-mock is enabled globally via setupTests.ts

beforeEach(() => {
  fetchMock.resetMocks();
});

describe("fetchRawData", () => {
  it("fetches miniSEED data from EarthScope dataselect", async () => {
    const fakeBuffer = new ArrayBuffer(512);
    fetchMock.mockResponseOnce(async () => ({
      body: Buffer.from(fakeBuffer),
      headers: { "Content-Type": "application/vnd.fdsn.mseed" },
    }));

    const result = await fetchRawData("AK", "K204", "--", "HNZ",
      "2026-02-01T00:00:00", "2026-02-02T00:00:00");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("service.earthscope.org/fdsnws/dataselect/1/query");
    expect(url).toContain("net=AK");
    expect(url).toContain("sta=K204");
    expect(url).toContain("cha=HNZ");
    expect(result).toBeInstanceOf(ArrayBuffer);
  });

  it("throws on HTTP error", async () => {
    fetchMock.mockResponseOnce("", { status: 404 });
    await expect(
      fetchRawData("AK", "K204", "--", "HNZ", "2026-02-01T00:00:00", "2026-02-02T00:00:00")
    ).rejects.toThrow();
  });
});

describe("fetchStationMetadata", () => {
  const sampleResponse = [
    "#Network | Station | Location | Channel | Latitude | Longitude | Elevation | Depth | Azimuth | Dip | SensorDescription | Scale | ScaleFreq | ScaleUnits | SampleRate | StartTime | EndTime",
    "AK|K204||HNZ|61.1758|-150.011505|30.0|0.0|0.0|-90.0|Episensor|213947.0|0.03|M/S**2|200.0|2012-08-20T00:00:00.0000|"
  ].join("\n");

  it("parses station metadata from text response", async () => {
    fetchMock.mockResponseOnce(sampleResponse);

    const metadata = await fetchStationMetadata("AK", "K204");

    expect(metadata).toHaveLength(1);
    expect(metadata[0].channel).toBe("HNZ");
    expect(metadata[0].scale).toBe(213947.0);
    expect(metadata[0].scaleUnits).toBe("M/S**2");
    expect(metadata[0].sampleRate).toBe(200.0);
  });

  it("handles multiple channels", async () => {
    const multiResponse = [
      "#Network | Station | ...",
      "AK|K204||HNZ|61.1758|-150.011505|30.0|0.0|0.0|-90.0|Sensor|213947.0|0.03|M/S**2|200.0|2012-08-20T00:00:00.0000|",
      "AK|K204||HNE|61.1758|-150.011505|30.0|0.0|90.0|0.0|Sensor|213947.0|0.03|M/S**2|200.0|2012-08-20T00:00:00.0000|"
    ].join("\n");
    fetchMock.mockResponseOnce(multiResponse);

    const metadata = await fetchStationMetadata("AK", "K204");
    expect(metadata).toHaveLength(2);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest --no-watchman src/plugins/shared-seismogram/utils/earthscope-client.test.ts`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

```typescript
// earthscope-client.ts

const DATASELECT_BASE = "https://service.earthscope.org/fdsnws/dataselect/1/query";
const STATION_BASE = "https://service.earthscope.org/fdsnws/station/1/query";

export interface StationChannelMetadata {
  network: string;
  station: string;
  location: string;
  channel: string;
  latitude: number;
  longitude: number;
  scale: number;         // Overall sensitivity (counts per physical unit)
  scaleFreq: number;
  scaleUnits: string;    // e.g., "M/S**2" or "M/S"
  sampleRate: number;
  startTime: string;
  endTime: string;
}

/**
 * Fetch raw miniSEED data from EarthScope FDSN dataselect service.
 */
export async function fetchRawData(
  net: string, sta: string, loc: string, cha: string,
  start: string, end: string
): Promise<ArrayBuffer> {
  const params = new URLSearchParams({ net, sta, loc, cha, start, end });
  const url = `${DATASELECT_BASE}?${params}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`EarthScope dataselect failed: ${response.status} ${response.statusText}`);
  }
  return response.arrayBuffer();
}

/**
 * Fetch station/channel metadata from EarthScope FDSN station service.
 * Returns channel-level metadata including sensitivity (Scale).
 */
export async function fetchStationMetadata(
  net: string, sta: string
): Promise<StationChannelMetadata[]> {
  const params = new URLSearchParams({ net, sta, level: "channel", format: "text" });
  const url = `${STATION_BASE}?${params}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`EarthScope station query failed: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  return parseStationText(text);
}

function parseStationText(text: string): StationChannelMetadata[] {
  const lines = text.split("\n").filter(line => line.trim() && !line.startsWith("#"));
  return lines.map(line => {
    const fields = line.split("|").map(f => f.trim());
    return {
      network: fields[0],
      station: fields[1],
      location: fields[2],
      channel: fields[3],
      latitude: parseFloat(fields[4]),
      longitude: parseFloat(fields[5]),
      scale: parseFloat(fields[11]),
      scaleFreq: parseFloat(fields[12]),
      scaleUnits: fields[13],
      sampleRate: parseFloat(fields[14]),
      startTime: fields[15],
      endTime: fields[16],
    };
  });
}
```

**Step 4: Run tests to verify they pass**

Run: `npx jest --no-watchman src/plugins/shared-seismogram/utils/earthscope-client.test.ts`
Expected: All pass.

**Step 5: Commit**

```
feat: add EarthScope FDSN client for raw data and station metadata
```

---

### Task 5: Envelope Computation

Pure functions to compute envelopes from raw data and roll up between levels.

**Files:**
- Create: `src/plugins/shared-seismogram/utils/envelope-compute.ts`
- Test: `src/plugins/shared-seismogram/utils/envelope-compute.test.ts`

**Step 1: Write the failing tests**

```typescript
// envelope-compute.test.ts
import { computeEnvelopesFromRaw, rollUpEnvelopes, mergeTileData } from "./envelope-compute";
import { NO_DATA_SENTINEL, K_FACTOR } from "../envelope-config";

describe("computeEnvelopesFromRaw", () => {
  it("computes min/max over windows", () => {
    // 10 samples, sampleRate=5Hz, windowSeconds=1s → 2 windows of 5 samples each
    const samples = new Float64Array([1, -2, 3, -4, 5, 6, -7, 8, -9, 10]);
    const result = computeEnvelopesFromRaw(samples, 5, 1);
    expect(result.mins).toEqual([-4, -9]);
    expect(result.maxs).toEqual([5, 10]);
  });

  it("handles partial last window", () => {
    // 7 samples, sampleRate=5Hz, windowSeconds=1s → 2 windows: 5 samples + 2 samples
    const samples = new Float64Array([1, -2, 3, -4, 5, 6, -7]);
    const result = computeEnvelopesFromRaw(samples, 5, 1);
    expect(result.mins).toEqual([-4, -7]);
    expect(result.maxs).toEqual([5, 6]);
  });
});

describe("rollUpEnvelopes", () => {
  it("computes coarser envelopes from finer ones", () => {
    // 4 fine points, K=2 → 2 coarse points
    const finerMins = new Int16Array([-100, -200, -50, -150]);
    const finerMaxs = new Int16Array([100, 200, 50, 150]);
    const result = rollUpEnvelopes(finerMins, finerMaxs, 2);
    expect(Array.from(result.mins)).toEqual([-200, -150]);
    expect(Array.from(result.maxs)).toEqual([200, 150]);
  });

  it("skips sentinel values in rollup", () => {
    const finerMins = new Int16Array([NO_DATA_SENTINEL, -200, -50, NO_DATA_SENTINEL]);
    const finerMaxs = new Int16Array([NO_DATA_SENTINEL, 200, 50, NO_DATA_SENTINEL]);
    const result = rollUpEnvelopes(finerMins, finerMaxs, 2);
    // Window 0: only index 1 has data → min=-200, max=200
    // Window 1: only index 2 has data → min=-50, max=50
    expect(Array.from(result.mins)).toEqual([-200, -50]);
    expect(Array.from(result.maxs)).toEqual([200, 50]);
  });

  it("produces sentinel when all values in window are sentinel", () => {
    const finerMins = new Int16Array([NO_DATA_SENTINEL, NO_DATA_SENTINEL]);
    const finerMaxs = new Int16Array([NO_DATA_SENTINEL, NO_DATA_SENTINEL]);
    const result = rollUpEnvelopes(finerMins, finerMaxs, 2);
    expect(Array.from(result.mins)).toEqual([NO_DATA_SENTINEL]);
    expect(Array.from(result.maxs)).toEqual([NO_DATA_SENTINEL]);
  });
});

describe("mergeTileData", () => {
  it("returns new data when existing is null", () => {
    const newData = {
      mins: new Int16Array([-100, -200]),
      maxs: new Int16Array([100, 200]),
    };
    const result = mergeTileData(null, newData);
    expect(result.mins).toEqual(newData.mins);
    expect(result.maxs).toEqual(newData.maxs);
  });

  it("fills sentinel gaps in existing data with new data", () => {
    const existing = {
      mins: new Int16Array([NO_DATA_SENTINEL, -200]),
      maxs: new Int16Array([NO_DATA_SENTINEL, 200]),
    };
    const newData = {
      mins: new Int16Array([-100, NO_DATA_SENTINEL]),
      maxs: new Int16Array([100, NO_DATA_SENTINEL]),
    };
    const result = mergeTileData(existing, newData);
    expect(Array.from(result.mins)).toEqual([-100, -200]);
    expect(Array.from(result.maxs)).toEqual([100, 200]);
  });

  it("does not overwrite existing non-sentinel data", () => {
    const existing = {
      mins: new Int16Array([-100, -200]),
      maxs: new Int16Array([100, 200]),
    };
    const newData = {
      mins: new Int16Array([-999, -999]),
      maxs: new Int16Array([999, 999]),
    };
    const result = mergeTileData(existing, newData);
    expect(Array.from(result.mins)).toEqual([-100, -200]);
    expect(Array.from(result.maxs)).toEqual([100, 200]);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest --no-watchman src/plugins/shared-seismogram/utils/envelope-compute.test.ts`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

```typescript
// envelope-compute.ts
import { NO_DATA_SENTINEL } from "../envelope-config";

/**
 * Compute min/max envelopes from raw sample data.
 * @param samples Raw amplitude values in physical units
 * @param sampleRate Samples per second
 * @param windowSeconds Duration of each envelope window in seconds
 * @returns Arrays of min and max values, one per window
 */
export function computeEnvelopesFromRaw(
  samples: Float64Array,
  sampleRate: number,
  windowSeconds: number
): { mins: number[]; maxs: number[] } {
  const samplesPerWindow = Math.round(sampleRate * windowSeconds);
  const numWindows = Math.ceil(samples.length / samplesPerWindow);
  const mins: number[] = [];
  const maxs: number[] = [];

  for (let w = 0; w < numWindows; w++) {
    const start = w * samplesPerWindow;
    const end = Math.min(start + samplesPerWindow, samples.length);
    let min = Infinity;
    let max = -Infinity;
    for (let i = start; i < end; i++) {
      if (samples[i] < min) min = samples[i];
      if (samples[i] > max) max = samples[i];
    }
    mins.push(min);
    maxs.push(max);
  }

  return { mins, maxs };
}

/**
 * Roll up finer-level envelopes to a coarser level.
 * Each coarser window covers k consecutive finer windows.
 * Sentinel values are skipped; if all values in a window are sentinel, the result is sentinel.
 */
export function rollUpEnvelopes(
  finerMins: Int16Array,
  finerMaxs: Int16Array,
  k: number
): { mins: Int16Array; maxs: Int16Array } {
  const numCoarse = Math.ceil(finerMins.length / k);
  const mins = new Int16Array(numCoarse);
  const maxs = new Int16Array(numCoarse);

  for (let c = 0; c < numCoarse; c++) {
    const start = c * k;
    const end = Math.min(start + k, finerMins.length);
    let min = Infinity;
    let max = -Infinity;
    let hasData = false;

    for (let i = start; i < end; i++) {
      if (finerMins[i] !== NO_DATA_SENTINEL) {
        hasData = true;
        if (finerMins[i] < min) min = finerMins[i];
        if (finerMaxs[i] > max) max = finerMaxs[i];
      }
    }

    if (hasData) {
      mins[c] = min;
      maxs[c] = max;
    } else {
      mins[c] = NO_DATA_SENTINEL;
      maxs[c] = NO_DATA_SENTINEL;
    }
  }

  return { mins, maxs };
}

/**
 * Merge new envelope data into an existing tile, filling sentinel gaps.
 * Existing non-sentinel data is preserved; new data only fills positions
 * where the existing tile has sentinel values.
 */
export function mergeTileData(
  existing: { mins: Int16Array; maxs: Int16Array } | null,
  newData: { mins: Int16Array; maxs: Int16Array }
): { mins: Int16Array; maxs: Int16Array } {
  if (!existing) return newData;

  const mins = new Int16Array(existing.mins);
  const maxs = new Int16Array(existing.maxs);

  for (let i = 0; i < mins.length; i++) {
    if (mins[i] === NO_DATA_SENTINEL && newData.mins[i] !== NO_DATA_SENTINEL) {
      mins[i] = newData.mins[i];
      maxs[i] = newData.maxs[i];
    }
  }

  return { mins, maxs };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx jest --no-watchman src/plugins/shared-seismogram/utils/envelope-compute.test.ts`
Expected: All pass.

**Step 5: Commit**

```
feat: add envelope computation and level rollup functions
```

---

### Task 6: S3 Tile Store

Read/write envelope tiles to S3 with conditional writes for conflict handling.

**Files:**
- Create: `src/plugins/shared-seismogram/utils/s3-tile-store.ts`
- Test: `src/plugins/shared-seismogram/utils/s3-tile-store.test.ts`

**Step 1: Write the failing tests**

```typescript
// s3-tile-store.test.ts
import { fetchTile, putTile, readModifyWriteTile } from "./s3-tile-store";

beforeEach(() => {
  fetchMock.resetMocks();
});

describe("fetchTile", () => {
  it("returns data and etag on success", async () => {
    const fakeData = new ArrayBuffer(100);
    fetchMock.mockResponseOnce(async () => ({
      body: Buffer.from(fakeData),
      headers: { ETag: '"abc123"' },
    }));

    const result = await fetchTile("https://s3.example.com/bucket", "AK.K204/HNZ/L2/42");
    expect(result).not.toBeNull();
    expect(result!.etag).toBe('"abc123"');
    expect(result!.data).toBeInstanceOf(ArrayBuffer);
  });

  it("returns null on 404", async () => {
    fetchMock.mockResponseOnce("", { status: 404 });
    const result = await fetchTile("https://s3.example.com/bucket", "AK.K204/HNZ/L2/42");
    expect(result).toBeNull();
  });

  it("throws on other HTTP errors", async () => {
    fetchMock.mockResponseOnce("", { status: 500 });
    await expect(fetchTile("https://s3.example.com/bucket", "key")).rejects.toThrow();
  });
});

describe("putTile", () => {
  it("sends PUT with If-Match when etag provided", async () => {
    fetchMock.mockResponseOnce("", { status: 200 });
    await putTile("https://s3.example.com/bucket", "key", new ArrayBuffer(10), '"abc123"');

    const call = fetchMock.mock.calls[0];
    const options = call[1] as RequestInit;
    expect(options.method).toBe("PUT");
    expect((options.headers as Record<string, string>)["If-Match"]).toBe('"abc123"');
  });

  it("sends PUT with If-None-Match when no etag (new object)", async () => {
    fetchMock.mockResponseOnce("", { status: 200 });
    await putTile("https://s3.example.com/bucket", "key", new ArrayBuffer(10));

    const call = fetchMock.mock.calls[0];
    const options = call[1] as RequestInit;
    expect((options.headers as Record<string, string>)["If-None-Match"]).toBe("*");
  });

  it("throws ConflictError on 412", async () => {
    fetchMock.mockResponseOnce("", { status: 412 });
    await expect(
      putTile("https://s3.example.com/bucket", "key", new ArrayBuffer(10), '"old"')
    ).rejects.toThrow("Conflict");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest --no-watchman src/plugins/shared-seismogram/utils/s3-tile-store.test.ts`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

```typescript
// s3-tile-store.ts

export class ConflictError extends Error {
  constructor() {
    super("Conflict: tile was modified by another writer");
    this.name = "ConflictError";
  }
}

/**
 * Fetch a tile from S3. Returns null if the tile doesn't exist (404).
 */
export async function fetchTile(
  s3BaseUrl: string,
  key: string
): Promise<{ data: ArrayBuffer; etag: string } | null> {
  const url = `${s3BaseUrl}/${key}`;
  const response = await fetch(url);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`S3 fetch failed: ${response.status} ${response.statusText}`);
  }
  const data = await response.arrayBuffer();
  const etag = response.headers.get("ETag") || "";
  return { data, etag };
}

/**
 * PUT a tile to S3 with conditional write.
 * If etag is provided, uses If-Match (update existing).
 * If etag is undefined, uses If-None-Match: * (create new).
 * Throws ConflictError on 412.
 */
export async function putTile(
  s3BaseUrl: string,
  key: string,
  data: ArrayBuffer,
  etag?: string
): Promise<void> {
  const url = `${s3BaseUrl}/${key}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/octet-stream",
  };
  if (etag) {
    headers["If-Match"] = etag;
  } else {
    headers["If-None-Match"] = "*";
  }

  const response = await fetch(url, {
    method: "PUT",
    headers,
    body: data,
  });

  if (response.status === 412) {
    throw new ConflictError();
  }
  if (!response.ok) {
    throw new Error(`S3 PUT failed: ${response.status} ${response.statusText}`);
  }
}

/**
 * Read-modify-write a tile with automatic retry on conflicts.
 * @param mergeFn Receives the existing decoded data (or null for new tiles) and returns updated data.
 */
export async function readModifyWriteTile(
  s3BaseUrl: string,
  key: string,
  mergeFn: (existing: ArrayBuffer | null) => Promise<ArrayBuffer>,
  maxRetries = 3
): Promise<void> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const existing = await fetchTile(s3BaseUrl, key);
    const merged = await mergeFn(existing?.data ?? null);

    try {
      await putTile(s3BaseUrl, key, merged, existing?.etag);
      return; // success
    } catch (err) {
      if (err instanceof ConflictError && attempt < maxRetries) {
        continue; // retry
      }
      throw err;
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx jest --no-watchman src/plugins/shared-seismogram/utils/s3-tile-store.test.ts`
Expected: All pass.

**Step 5: Commit**

```
feat: add S3 tile store with conditional writes
```

---

### Task 7: Canvas-based WaveformPanel

Replace seisplotjs Seismograph with a canvas renderer that handles both envelope and raw data.

**Files:**
- Modify: `src/plugins/shared-seismogram/components/waveform-panel.tsx`
- Modify: `src/plugins/shared-seismogram/components/waveform-panel.test.tsx`

**Step 1: Define the ViewportData type**

Create a shared types file that both the model and component will use:

Create: `src/plugins/shared-seismogram/seismic-types.ts`

```typescript
// seismic-types.ts
import { NO_DATA_SENTINEL } from "./envelope-config";

/** Envelope data: min/max pairs at each time point. */
export interface EnvelopeData {
  type: "envelope";
  startTime: number;    // Unix seconds of first point
  spacing: number;      // Seconds between points
  mins: Int16Array;     // Quantized min values (NO_DATA_SENTINEL = no data)
  maxs: Int16Array;     // Quantized max values
  rangeMax: number;     // Physical amplitude range for dequantization
}

/** Raw waveform data: individual samples. */
export interface RawData {
  type: "raw";
  startTime: number;    // Unix seconds of first sample
  sampleRate: number;   // Samples per second
  samples: Float64Array; // Amplitude values in physical units
  rangeMax: number;     // Physical amplitude range for Y-axis scaling
}

export type ViewportData = EnvelopeData | RawData;

export function isNoData(value: number): boolean {
  return value === NO_DATA_SENTINEL;
}
```

**Step 2: Write the failing test for canvas rendering**

```typescript
// waveform-panel.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { WaveformPanel } from "./waveform-panel";
import { EnvelopeData, RawData } from "../seismic-types";
import { NO_DATA_SENTINEL } from "../envelope-config";

describe("WaveformPanel", () => {
  it("renders label", () => {
    render(
      <WaveformPanel label="Test" data={null} width={100} height={60} />
    );
    expect(screen.getByText("Test")).toBeInTheDocument();
  });

  it("renders a canvas element", () => {
    const data: EnvelopeData = {
      type: "envelope",
      startTime: 0,
      spacing: 1,
      mins: new Int16Array(100).fill(-1000),
      maxs: new Int16Array(100).fill(1000),
      rangeMax: 0.05,
    };
    const { container } = render(
      <WaveformPanel label="Test" data={data} width={100} height={60} />
    );
    expect(container.querySelector("canvas")).toBeInTheDocument();
  });

  it("renders with null data (no crash)", () => {
    const { container } = render(
      <WaveformPanel label="Test" data={null} width={100} height={60} />
    );
    expect(container.querySelector("canvas")).toBeInTheDocument();
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `npx jest --no-watchman src/plugins/shared-seismogram/components/waveform-panel.test.tsx`
Expected: FAIL — props don't match current component.

**Step 4: Rewrite the component**

```tsx
// waveform-panel.tsx
import React, { useEffect, useRef } from "react";
import { ViewportData, isNoData } from "../seismic-types";
import { dequantize } from "../utils/envelope-codec";
import "./waveform-panel.scss";

interface WaveformPanelProps {
  label: string;
  data: ViewportData | null;
  width: number;
  height: number;
}

export const WaveformPanel: React.FC<WaveformPanelProps> = ({
  label, data, width, height,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);

    if (!data) return;

    ctx.strokeStyle = "white";
    ctx.fillStyle = "white";
    ctx.lineWidth = 1;

    if (data.type === "envelope") {
      renderEnvelope(ctx, data, width, height);
    } else {
      renderRaw(ctx, data, width, height);
    }
  }, [data, width, height]);

  return (
    <div className="waveform-panel">
      <div className="waveform-panel-label">{label}</div>
      <div className="waveform-panel-display">
        <canvas ref={canvasRef} width={width} height={height} />
      </div>
    </div>
  );
};

function renderEnvelope(
  ctx: CanvasRenderingContext2D,
  data: ViewportData & { type: "envelope" },
  width: number,
  height: number
) {
  const { mins, maxs, rangeMax } = data;
  const numPoints = mins.length;
  const centerY = height / 2;
  const scaleY = height / 2; // maps rangeMax to half the canvas height

  for (let px = 0; px < width; px++) {
    // Map pixel to data index
    const dataIndex = Math.floor((px / width) * numPoints);
    if (dataIndex >= numPoints) break;
    if (isNoData(mins[dataIndex])) continue;

    const minVal = dequantize(mins[dataIndex], rangeMax);
    const maxVal = dequantize(maxs[dataIndex], rangeMax);

    const yMin = centerY - (maxVal / rangeMax) * scaleY;
    const yMax = centerY - (minVal / rangeMax) * scaleY;

    ctx.fillRect(px, yMin, 1, Math.max(1, yMax - yMin));
  }
}

function renderRaw(
  ctx: CanvasRenderingContext2D,
  data: ViewportData & { type: "raw" },
  width: number,
  height: number
) {
  const { samples, rangeMax } = data;
  const centerY = height / 2;
  const scaleY = height / 2;

  ctx.beginPath();
  for (let px = 0; px < width; px++) {
    const sampleIndex = Math.floor((px / width) * samples.length);
    if (sampleIndex >= samples.length) break;

    const y = centerY - (samples[sampleIndex] / rangeMax) * scaleY;

    if (px === 0) {
      ctx.moveTo(px, y);
    } else {
      ctx.lineTo(px, y);
    }
  }
  ctx.stroke();
}
```

**Step 5: Run tests to verify they pass**

Run: `npx jest --no-watchman src/plugins/shared-seismogram/components/waveform-panel.test.tsx`
Expected: All pass.

**Step 6: Commit**

```
feat: replace seisplotjs with canvas-based waveform renderer
```

---

### Task 8: Expand SharedSeismogram Model

Add SEED identifiers, time range props, volatile caches, level selection, and data loading orchestration.

**Files:**
- Modify: `src/plugins/shared-seismogram/shared-seismogram.ts`
- Modify: `src/plugins/shared-seismogram/shared-seismogram.test.ts`

**Step 1: Write failing tests for new functionality**

```typescript
// Add to shared-seismogram.test.ts (new describe blocks)

import { LEVEL_SPACINGS } from "./envelope-config";

// ... existing imports and tests ...

describe("selectLevel", () => {
  it("selects L0 for very zoomed-out views", () => {
    const model = SharedSeismogram.create({});
    // 1 year on 1000px ≈ 31536 seconds/pixel → L0 spacing is 15750
    expect(model.selectLevel(31536)).toBe(0);
  });

  it("selects L1 for medium zoom", () => {
    const model = SharedSeismogram.create({});
    // 3 days on 1000px ≈ 259 seconds/pixel → between L0 and L1 spacings
    expect(model.selectLevel(259)).toBe(1);
  });

  it("selects L2 for zoomed-in views", () => {
    const model = SharedSeismogram.create({});
    // 30 minutes on 1000px ≈ 1.8 seconds/pixel → between L1 and L2
    expect(model.selectLevel(1.8)).toBe(2);
  });

  it("selects raw for very zoomed-in views", () => {
    const model = SharedSeismogram.create({});
    // 30 seconds on 1000px = 0.03 seconds/pixel → below L2
    expect(model.selectLevel(0.03)).toBe("raw");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest --no-watchman src/plugins/shared-seismogram/shared-seismogram.test.ts`
Expected: FAIL — `selectLevel` not defined.

**Step 3: Rewrite SharedSeismogram**

```typescript
// shared-seismogram.ts
import { flow, getType, Instance, types } from "mobx-state-tree";
import { miniseed, seismogram as seismogramNS } from "seisplotjs";
import { SharedModel, SharedModelType } from "../../models/shared/shared-model";
import { LEVEL_SPACINGS, NUM_LEVELS, AMPLITUDE_RANGES, ENVELOPE_S3_BASE } from "./envelope-config";
import { ViewportData, EnvelopeData, RawData } from "./seismic-types";
import { decodeEnvelopeTile, dequantize, quantize, encodeEnvelopeTile } from "./utils/envelope-codec";
import { getTileIndicesForViewport, getTileS3Key, getTileTimeRange } from "./utils/tile-addressing";
import { fetchRawData, fetchStationMetadata, StationChannelMetadata } from "./utils/earthscope-client";
import { computeEnvelopesFromRaw, rollUpEnvelopes, mergeTileData } from "./utils/envelope-compute";
import { fetchTile, readModifyWriteTile } from "./utils/s3-tile-store";

export const kSharedSeismogramType = "SharedSeismogram";

export const SharedSeismogram = SharedModel
  .named("SharedSeismogram")
  .props({
    type: types.optional(types.literal(kSharedSeismogramType), kSharedSeismogramType),
    network: types.optional(types.string, ""),
    station: types.optional(types.string, ""),
    location: types.optional(types.string, ""),
    channel: types.optional(types.string, ""),
    startTime: types.optional(types.number, 0),  // Unix seconds
    endTime: types.optional(types.number, 0),     // Unix seconds
  })
  .volatile(() => ({
    tileCache: new Map<string, { mins: Int16Array; maxs: Int16Array }>(),
    rawDataCache: new Map<string, { samples: Float64Array; sampleRate: number }>(),
    stationMetadata: null as StationChannelMetadata[] | null,
    isLoading: false,
    loadError: null as string | null,
  }))
  .views(self => ({
    get hasData() {
      return self.tileCache.size > 0 || self.rawDataCache.size > 0;
    },

    get instrumentCode(): string {
      // Second character of channel code (e.g., "HNZ" → "N")
      return self.channel.length >= 2 ? self.channel[1] : "H";
    },

    get rangeMax(): number {
      return AMPLITUDE_RANGES[this.instrumentCode] ?? 0.05;
    },

    /**
     * Select the appropriate resolution level for a given seconds-per-pixel.
     * Returns the level index (0, 1, 2) or "raw" if zoomed in beyond L2.
     */
    selectLevel(secondsPerPixel: number): number | "raw" {
      for (let level = 0; level < NUM_LEVELS; level++) {
        if (secondsPerPixel >= LEVEL_SPACINGS[level]) {
          return level;
        }
      }
      // Below finest envelope level: check if raw is needed
      if (secondsPerPixel < LEVEL_SPACINGS[NUM_LEVELS - 1]) {
        return "raw";
      }
      return NUM_LEVELS - 1;
    },
  }))
  .actions(self => ({
    setStationMetadata(metadata: StationChannelMetadata[]) {
      self.stationMetadata = metadata;
    },

    cacheTile(level: number, tileIndex: number, data: { mins: Int16Array; maxs: Int16Array }) {
      self.tileCache.set(`L${level}/${tileIndex}`, data);
    },

    cacheRawData(key: string, samples: Float64Array, sampleRate: number) {
      self.rawDataCache.set(key, { samples, sampleRate });
    },

    /**
     * Load data for a viewport. Fetches tiles or raw data as needed.
     */
    loadViewport: flow(function* (
      viewStartTime: number,
      viewEndTime: number,
      pixelWidth: number
    ) {
      const secondsPerPixel = (viewEndTime - viewStartTime) / pixelWidth;
      const level = self.selectLevel(secondsPerPixel);

      self.isLoading = true;
      self.loadError = null;

      try {
        if (level === "raw") {
          yield (self as any).loadRawData(viewStartTime, viewEndTime);
        } else {
          yield (self as any).loadEnvelopeTiles(level, viewStartTime, viewEndTime);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        self.loadError = `Error loading seismic data: ${message}`;
      } finally {
        self.isLoading = false;
      }
    }),

    loadEnvelopeTiles: flow(function* (level: number, startTime: number, endTime: number) {
      const stationKey = `${self.network}.${self.station}`;
      const tileIndices = getTileIndicesForViewport(startTime, endTime, level);

      const fetches = tileIndices
        .filter(idx => !self.tileCache.has(`L${level}/${idx}`))
        .map(async (idx) => {
          const key = getTileS3Key(stationKey, self.channel, level, idx);
          const result = await fetchTile(ENVELOPE_S3_BASE, key);
          if (result) {
            const decoded = await decodeEnvelopeTile(result.data);
            (self as any).cacheTile(level, idx, decoded);
          }
        });

      yield Promise.all(fetches);
    }),

    loadRawData: flow(function* (startTime: number, endTime: number) {
      const cacheKey = `${startTime}-${endTime}`;
      if (self.rawDataCache.has(cacheKey)) return;

      // Fetch station metadata if needed
      if (!self.stationMetadata) {
        const metadata: StationChannelMetadata[] = yield fetchStationMetadata(
          self.network, self.station
        );
        (self as any).setStationMetadata(metadata);
      }

      const startISO = new Date(startTime * 1000).toISOString();
      const endISO = new Date(endTime * 1000).toISOString();

      const buffer: ArrayBuffer = yield fetchRawData(
        self.network, self.station, self.location, self.channel,
        startISO, endISO
      );

      // Parse miniSEED and convert to physical units
      const records = miniseed.parseDataRecords(buffer);
      const seismogram = miniseed.merge(records);
      const numSamples = seismogram.numPoints;
      const sampleRate = seismogram.sampleRate;

      // Find sensitivity for this channel and time period
      const channelMeta = self.stationMetadata?.find(
        m => m.channel === self.channel
      );
      const sensitivity = channelMeta?.scale ?? 1;

      // Convert counts to physical units
      const samples = new Float64Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        samples[i] = seismogram.y(i) / sensitivity;
      }

      (self as any).cacheRawData(cacheKey, samples, sampleRate);
    }),

    /**
     * Compute envelopes from cached raw data and upload to S3.
     */
    processAndUploadEnvelopes: flow(function* (
      rawStartTime: number,
      rawEndTime: number
    ) {
      const cacheKey = `${rawStartTime}-${rawEndTime}`;
      const rawEntry = self.rawDataCache.get(cacheKey);
      if (!rawEntry) return;

      const { samples, sampleRate } = rawEntry;
      const stationKey = `${self.network}.${self.station}`;

      // Compute L2 from raw
      const l2Spacing = LEVEL_SPACINGS[NUM_LEVELS - 1];
      const l2Envelope = computeEnvelopesFromRaw(samples, sampleRate, l2Spacing);

      // Quantize to Int16
      const l2Mins = new Int16Array(l2Envelope.mins.map(v => quantize(v, self.rangeMax)));
      const l2Maxs = new Int16Array(l2Envelope.maxs.map(v => quantize(v, self.rangeMax)));

      // Upload L2 tiles
      yield uploadEnvelopesToS3(stationKey, self.channel, NUM_LEVELS - 1,
        rawStartTime, l2Mins, l2Maxs);

      // Roll up to L1
      const l1Result = rollUpEnvelopes(l2Mins, l2Maxs, 100);
      yield uploadEnvelopesToS3(stationKey, self.channel, NUM_LEVELS - 2,
        rawStartTime, l1Result.mins, l1Result.maxs);

      // Roll up to L0
      const l0Result = rollUpEnvelopes(l1Result.mins, l1Result.maxs, 100);
      yield uploadEnvelopesToS3(stationKey, self.channel, 0,
        rawStartTime, l0Result.mins, l0Result.maxs);
    }),
  }));

async function uploadEnvelopesToS3(
  stationKey: string,
  channel: string,
  level: number,
  startTime: number,
  mins: Int16Array,
  maxs: Int16Array
) {
  // Determine which tiles are affected and write each one
  const tileIndices = getTileIndicesForViewport(
    startTime,
    startTime + mins.length * LEVEL_SPACINGS[level],
    level
  );

  for (const idx of tileIndices) {
    const key = getTileS3Key(stationKey, channel, level, idx);
    const tileRange = getTileTimeRange(level, idx);

    // Extract the portion of data that belongs to this tile
    // (simplified: in practice need to compute exact offsets)
    await readModifyWriteTile(ENVELOPE_S3_BASE, key, async (existingBuffer) => {
      const existing = existingBuffer
        ? await decodeEnvelopeTile(existingBuffer)
        : null;
      const merged = mergeTileData(existing, { mins, maxs });
      return encodeEnvelopeTile(merged.mins, merged.maxs);
    });
  }
}

export interface SharedSeismogramType extends Instance<typeof SharedSeismogram> {}

export function isSharedSeismogram(model?: SharedModelType): model is SharedSeismogramType {
  return !!model && getType(model) === SharedSeismogram;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx jest --no-watchman src/plugins/shared-seismogram/shared-seismogram.test.ts`
Expected: All pass (existing tests + new selectLevel tests).

**Step 5: Commit**

```
feat: expand SharedSeismogram with envelope tile cache, raw data loading, and level selection
```

---

### Task 9: Update Timeline and WaveRunner Consumers

Update the tiles that consume SharedSeismogram to use the new viewport-based API and WaveformPanel props.

**Files:**
- Modify: `src/plugins/timeline/components/timeline.tsx`
- Modify: `src/plugins/timeline/models/timeline-content.ts`
- Modify: `src/plugins/wave-runner/components/status-and-output.tsx`

**Step 1: Update Timeline component**

The Timeline component needs to pass viewport info to SharedSeismogram and receive ViewportData for the WaveformPanel. This requires knowing the pixel width of the container. Use a ref + ResizeObserver.

Read the current timeline.tsx and timeline-content.ts to understand the exact structure before modifying. The component currently passes a `seismogram` object and time range to WaveformPanel. Update it to:
1. Compute viewport dimensions
2. Call `model.sharedSeismogram.loadViewport(...)` when viewport changes
3. Pass `ViewportData` to the new WaveformPanel

**Step 2: Update WaveRunner component**

Similar changes to status-and-output.tsx — pass viewport data instead of a Seismogram object.

**Step 3: Run the full test suite**

Run: `npx jest --no-watchman src/plugins/timeline/ src/plugins/wave-runner/ src/plugins/shared-seismogram/`
Expected: All pass.

**Step 4: Commit**

```
feat: update Timeline and WaveRunner to use envelope tile cache
```

---

### Task 10: Integration Testing and Cleanup

End-to-end verification that the full pipeline works.

**Step 1: Manual smoke test**

Run: `npm start`
- Open the app with a problem that includes a Timeline tile
- Verify the waveform renders at zoomed-out views (envelope data from S3)
- Verify zooming in below ~2.6 min fetches raw data from EarthScope
- Verify the canvas renderer displays both envelope and raw data correctly

**Step 2: Remove old seisplotjs Seismograph dependency from WaveformPanel**

The seisplotjs import in waveform-panel.tsx is no longer needed for rendering. It's still needed in shared-seismogram.ts for miniSEED parsing. Remove the seismograph/seismographconfig imports from the component.

**Step 3: Run full test suite**

Run: `npx jest --no-watchman`
Expected: All pass.

**Step 4: Commit**

```
chore: remove seisplotjs rendering dependency from WaveformPanel
```
