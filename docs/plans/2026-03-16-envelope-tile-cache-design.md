# Envelope Tile Cache Implementation Design

## Summary

Replace the current hardcoded S3 miniSEED fetching in SharedSeismogram with a multi-resolution envelope tile cache system. Envelope data (precomputed min/max amplitude pairs) is stored in S3 at three resolution levels. Raw data is fetched on demand from EarthScope when the user zooms in below the finest envelope level.

The work is split into two independent parts:

1. **Part 1: Envelope generation script** — A Node.js script (`scripts/seismic/generate-envelopes.ts`) that reads local miniSEED files (downloaded via ROVER), computes envelopes at all 3 levels, and uploads tiles to S3 via AWS SDK. Batch mode: wipe and regenerate.

2. **Part 2: Client-side reading** — Update SharedSeismogram to read envelopes from S3 when available, fall back to raw data from EarthScope when not. The browser never writes to S3.

See [envelope-tile-cache-design.md](../seismic/envelope-tile-cache-design.md) for the full data format specification (storage format, amplitude quantization, tile addressing, etc.).

## Decisions

- **Two-part split**: script generates envelopes offline, client reads them
- **Canvas-based custom renderer** for both envelope and raw data, replacing seisplotjs Seismograph
- **SharedSeismogram expanded** as the central MST model, with pure utility functions
- **3 stored envelope levels** (L0–L2), raw data from EarthScope below L2
- **Level configuration as constants** so spacings can be tuned without structural changes
- **Shared code** used by both the script and the client lives in `shared/seismic/`

## Part 1: Envelope Generation Script

### Input
A directory of local miniSEED files downloaded via [ROVER](https://github.com/EarthScope/rover). The script also needs the station's sensitivity, which it fetches from the EarthScope FDSN Station service.

### Output
Gzipped columnar Int16 envelope tiles uploaded to S3 at all 3 levels (L0, L1, L2).

### Operation
Batch mode: for a given station/channel, the script processes all miniSEED files in the input directory and generates a complete set of envelope tiles. No incremental updates — re-run the script to regenerate.

### Script location
`scripts/seismic/generate-envelopes.ts` — run with `ts-node` or `npx tsx`.

### Dependencies
- `@aws-sdk/client-s3` for S3 uploads
- `seisplotjs` for miniSEED parsing
- `pako` for gzip compression
- Shared modules from `shared/seismic/`

## Part 2: Client-Side Reading

### Data flow (read-only)

1. Timeline/WaveRunner provides viewport (start time, end time, pixel width) to SharedSeismogram
2. SharedSeismogram computes `seconds_per_pixel` → selects appropriate level
3. For envelope levels (L0–L2): compute which tile indices cover the viewport, fetch from S3, decode gzipped Int16 buffers
4. For raw: fetch miniSEED from EarthScope FDSN dataselect API, convert counts to physical units using station sensitivity
5. Return a uniform data structure to WaveformPanel: array of `{time, min, max}` for envelopes, or `{time, value}` for raw
6. WaveformPanel renders on canvas: envelopes as filled vertical bands, raw as a polyline

For now, the browser doesn't write envelopes to S3.

## File structure

```
shared/seismic/
├── envelope-config.ts                # Level spacings, K factor, tile size constants
├── envelope-codec.ts                 # Encode/decode gzipped columnar Int16, quantization
├── tile-addressing.ts                # Tile index math, S3 key construction
├── envelope-compute.ts               # Raw → envelopes, level rollup
├── earthscope-client.ts              # Fetch station metadata (sensitivity)
├── seismic-types.ts                  # ViewportData, EnvelopeData, RawData types

scripts/seismic/
├── generate-envelopes.ts             # Batch envelope generation script

src/plugins/shared-seismogram/
├── shared-seismogram.ts              # Expanded MST model (state, orchestration)
├── shared-seismogram-registration.ts
├── shared-seismogram.test.ts
├── utils/
│   └── envelope-fetcher.ts           # Read-only: fetch tiles from S3 via HTTP GET
├── components/
│   ├── waveform-panel.tsx            # Canvas-based renderer (replaces seisplotjs)
│   ├── waveform-panel.scss
│   └── waveform-panel.test.tsx
```

## Module responsibilities

### `shared/seismic/envelope-config.ts`
Configurable constants that define the level structure. All other modules derive their behavior from these values.
- `LEVEL_SPACINGS`: array of point spacings in seconds (e.g., `[15750, 157.5, 1.575]`)
- `K_FACTOR`: scale factor between levels (~100)
- `POINTS_PER_TILE`: array of points per tile for each level (e.g., `[1024, 1024, 20480]`). L2 uses 20× more points per tile to reduce tile count.
- `AMPLITUDE_RANGES`: map of instrument code → fixed range (e.g., `{ H: 0.05, L: 0.05, N: 40 }`)
- `NO_DATA_SENTINEL`: -32768

### `shared/seismic/envelope-codec.ts`
Pure functions for binary encoding/decoding. Used by both the script (encoding) and the client (decoding).
- `encodeEnvelopeTile(mins: Int16Array, maxs: Int16Array) → ArrayBuffer` (gzipped columnar Int16, accepts any length)
- `decodeEnvelopeTile(buffer: ArrayBuffer) → { mins: Int16Array, maxs: Int16Array }` (infers point count from buffer size)
- `quantize(physicalValue: number, rangeMax: number) → number` (physical units → Int16)
- `dequantize(int16Value: number, rangeMax: number) → number` (Int16 → physical units)

### `shared/seismic/tile-addressing.ts`
Pure functions for mapping time ranges to tile indices. Used by both the script and the client.
- `getTileIndex(timestamp: number, level: number) → number`
- `getTileTimeRange(level: number, tileIndex: number) → { start: number, end: number }`
- `getTileIndicesForViewport(startTime: number, endTime: number, level: number) → number[]`
- `getTileS3Key(station: string, channel: string, level: number, tileIndex: number) → string`

### `shared/seismic/earthscope-client.ts`
Fetching station metadata from EarthScope FDSN services. Used by both the script (to get sensitivity) and the client (to get sensitivity for raw data conversion).
- `fetchStationMetadata(net, sta) → StationMetadata[]` (channel info including sensitivity)

### `shared/seismic/envelope-compute.ts`
Pure functions for envelope computation. Used by the script; could also be used client-side if needed later.
- `computeEnvelopesFromRaw(samples: Float64Array, sampleRate: number, windowSeconds: number) → { mins: number[], maxs: number[] }`
- `rollUpEnvelopes(finerMins: Int16Array, finerMaxs: Int16Array, k: number) → { mins: Int16Array, maxs: Int16Array }`

### `src/plugins/shared-seismogram/utils/envelope-fetcher.ts`
Read-only tile fetching for the browser. Simple HTTP GET from S3, returns null on 404.
- `fetchEnvelopeTile(s3BaseUrl, key) → { mins: Int16Array, maxs: Int16Array } | null`

### SharedSeismogram changes

**New props:**
- `network`, `station`, `location`, `channel` (SEED identifiers)
- `startTime`, `endTime` (time range for this seismogram's data)

**New volatile state:**
- `tileCache`: Map of `"L{level}/{tileIndex}"` → decoded tile data
- `rawDataCache`: Map of time range key → raw sample arrays
- `stationMetadata`: sensitivity and instrument info from EarthScope

**New views:**
- `selectLevel(secondsPerPixel: number) → number | "raw"` — picks the appropriate level
- `getDataForViewport(startTime, endTime, pixelWidth) → ViewportData` — returns renderable data

**New actions:**
- `loadViewport(startTime, endTime, pixelWidth)` — fetches needed tiles/raw data, populates caches

### WaveformPanel changes

- Replace seisplotjs `Seismograph` custom element with a `<canvas>` element
- Accept `ViewportData` (envelope or raw) instead of `Seismogram`
- Render envelopes as filled vertical lines (min to max per pixel column)
- Render raw data as a polyline
- Handle "no data" gaps (sentinel values) by leaving those pixel columns blank
