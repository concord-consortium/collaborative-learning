# Envelope Tile Cache Implementation Design

## Summary

Replace the current hardcoded S3 miniSEED fetching in SharedSeismogram with a multi-resolution envelope tile cache system. Envelope data (precomputed min/max amplitude pairs) is stored in S3 at three resolution levels. Raw data is fetched on demand from EarthScope when the user zooms in below the finest envelope level.

See [envelope-tile-cache-design.md](../seismic/envelope-tile-cache-design.md) for the full data format specification (storage format, amplitude quantization, tile addressing, etc.).

## Decisions

- **Full pipeline**: envelope read/write from S3, raw data from EarthScope, level switching, canvas rendering
- **Browser computes envelopes and uploads directly to S3** via presigned URLs
- **Canvas-based custom renderer** for both envelope and raw data, replacing seisplotjs Seismograph
- **SharedSeismogram expanded** as the central MST model, with pure utility functions in `utils/`
- **3 stored envelope levels** (L0–L2), raw data from EarthScope below L2
- **Level configuration as constants** so spacings can be tuned without structural changes

## Data flow

### Reading (zoom/pan)

1. Timeline/WaveRunner provides viewport (start time, end time, pixel width) to SharedSeismogram
2. SharedSeismogram computes `seconds_per_pixel` → selects appropriate level
3. For envelope levels (L0–L2): compute which tile indices cover the viewport, fetch from S3, decode gzipped Int16 buffers
4. For raw: fetch miniSEED from EarthScope FDSN dataselect API, convert counts to physical units using station sensitivity
5. Return a uniform data structure to WaveformPanel: array of `{time, min, max}` for envelopes, or `{time, value}` for raw
6. WaveformPanel renders on canvas: envelopes as filled vertical bands, raw as a polyline

### Writing (after raw data fetch)

1. When raw data is fetched from EarthScope, compute L2 envelopes from the raw samples (min/max over windows)
2. Roll up: L2 → L1 → L0 (each coarser window = K consecutive finer windows)
3. For each affected tile at each level: read-modify-write to S3 (fetch existing tile via GET, merge new data into sentinel gaps, PUT with `If-Match` conditional write)
4. Cache the computed envelopes in memory so they're immediately available for display

## File structure

```
src/plugins/shared-seismogram/
├── shared-seismogram.ts              # Expanded MST model (state, orchestration)
├── shared-seismogram-registration.ts
├── shared-seismogram.test.ts
├── envelope-config.ts                # Level spacings, K factor, tile size constants
├── utils/
│   ├── envelope-codec.ts             # Encode/decode gzipped columnar Int16, quantization
│   ├── tile-addressing.ts            # Tile index math, S3 URL construction
│   ├── earthscope-client.ts          # Fetch raw miniSEED, station metadata (sensitivity)
│   ├── envelope-compute.ts           # Raw → envelopes, level rollup
│   └── s3-tile-store.ts              # Read/write tiles to S3, conditional writes, presigned URLs
├── components/
│   ├── waveform-panel.tsx            # Canvas-based renderer (replaces seisplotjs)
│   ├── waveform-panel.scss
│   └── waveform-panel.test.tsx
```

## Module responsibilities

### `envelope-config.ts`
Configurable constants that define the level structure. All other modules derive their behavior from these values.
- `LEVEL_SPACINGS`: array of point spacings in seconds (e.g., `[15750, 157.5, 1.575]`)
- `K_FACTOR`: scale factor between levels (~100)
- `POINTS_PER_TILE`: 1024
- `AMPLITUDE_RANGES`: map of instrument code → fixed range (e.g., `{ H: 0.05, L: 0.05, N: 40 }`)
- `NO_DATA_SENTINEL`: -32768

### `utils/envelope-codec.ts`
Pure functions for binary encoding/decoding.
- `encodeEnvelopeTile(mins: Int16Array, maxs: Int16Array) → ArrayBuffer` (gzipped columnar Int16)
- `decodeEnvelopeTile(buffer: ArrayBuffer) → { mins: Int16Array, maxs: Int16Array }`
- `quantize(physicalValue: number, rangeMax: number) → number` (physical units → Int16)
- `dequantize(int16Value: number, rangeMax: number) → number` (Int16 → physical units)

### `utils/tile-addressing.ts`
Pure functions for mapping time ranges to tile indices.
- `getTileIndex(timestamp: number, level: number) → number`
- `getTileTimeRange(level: number, tileIndex: number) → { start: number, end: number }`
- `getTileIndicesForViewport(startTime: number, endTime: number, level: number) → number[]`
- `getTileS3Key(station: string, channel: string, level: number, tileIndex: number) → string`

### `utils/earthscope-client.ts`
Fetching from EarthScope FDSN services.
- `fetchRawData(net, sta, loc, cha, start, end) → ArrayBuffer` (miniSEED from dataselect)
- `fetchStationMetadata(net, sta) → StationMetadata[]` (channel info including sensitivity, from station service)

### `utils/envelope-compute.ts`
Pure functions for envelope computation.
- `computeEnvelopesFromRaw(samples: Float64Array, sampleRate: number, windowSeconds: number) → { mins: number[], maxs: number[] }`
- `rollUpEnvelopes(finerMins: Int16Array, finerMaxs: Int16Array, k: number) → { mins: Int16Array, maxs: Int16Array }`
- `mergeTileData(existing: { mins: Int16Array, maxs: Int16Array } | null, newData: { mins: Int16Array, maxs: Int16Array }) → { mins: Int16Array, maxs: Int16Array }` (fills sentinel gaps)

### `utils/s3-tile-store.ts`
S3 read/write with conditional writes.
- `fetchTile(s3BaseUrl, key) → { data: ArrayBuffer, etag: string } | null` (returns null for 404)
- `putTile(s3BaseUrl, key, data: ArrayBuffer, etag?: string) → void` (conditional write, throws on 412)
- `readModifyWriteTile(s3BaseUrl, key, mergeFn) → void` (retry loop for conflicts)

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
- `processAndUploadEnvelopes(rawData, timeRange)` — computes envelopes, uploads to S3

### WaveformPanel changes

- Replace seisplotjs `Seismograph` custom element with a `<canvas>` element
- Accept `ViewportData` (envelope or raw) instead of `Seismogram`
- Render envelopes as filled vertical lines (min to max per pixel column)
- Render raw data as a polyline
- Handle "no data" gaps (sentinel values) by leaving those pixel columns blank
