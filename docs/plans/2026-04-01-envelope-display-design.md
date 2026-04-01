# Envelope Tile Display Design

## Summary

Implement the client-side reading and display of precomputed envelope tiles (Part 2 of the [envelope tile cache design](../seismic/envelope-tile-cache-design.md)) and the seismic query service (Parts 2 and 3 of the [seismic data services design](../seismic/seismic-data-services-design.md)). Replace the seisplotjs Seismograph custom element with uPlot for waveform rendering.

### Related documents

- [Envelope Tile Cache Design](../seismic/envelope-tile-cache-design.md) — tile levels, storage format, quantization
- [Seismic Data Services Design](../seismic/seismic-data-services-design.md) — fetcher and query service architecture
- [Seismic Tiles Plan](../seismic/seismic-tiles-plan.md) — overall tile architecture

## Decisions

- **uPlot** for waveform rendering — lightweight (~35KB), high-performance canvas-based time-series library. Chosen over custom canvas rendering to avoid writing/maintaining a rendering engine.
- **Pre-assembled arrays** — the query service dequantizes and assembles flat arrays in uPlot's data format. uPlot receives simple `[timestamps[], mins[], maxs[]]` (envelopes) or `[timestamps[], values[]]` (raw). Clean separation: uPlot knows nothing about tiles or Int16.
- **Fixed 2-hour chunks for raw data** — same cache pattern as envelope tiles, avoiding fiddly gap-detection with arbitrarily-sized segments.
- **Display-only chart** — no chart-level zoom/pan interaction initially. Zoom/pan via Timeline toolbar buttons. Can add uPlot drag-to-zoom/pan later.
- **Gaps as nulls** — uPlot renders null values as gaps natively. Visual indicator for no-data regions deferred.
- **uPlot band fill for envelopes** — uses built-in band rendering (fill between min and max series). Pixel-precise vertical bars can be added later via custom draw hooks if needed.
- **Typed parameter objects** — `fetchEnvelopeTile`, `query`, and `loadViewport` accept typed objects rather than positional arguments.

## Part 2: Envelope Tile Fetcher

### Location

`shared/seismic/envelope-fetcher.ts` (new file)

### API

```ts
interface FetchEnvelopeTileParams {
  network: string;
  station: string;
  channel: string;
  level: number;
  tileIndex: number;
  s3BaseUrl?: string;
  signal?: AbortSignal;
}

fetchEnvelopeTile(params: FetchEnvelopeTileParams): Promise<EnvelopeTileData | null>
```

### Responsibilities

- Join `network` + `station` into `"AK_K204"` format for S3 key construction
- Construct URL using `getS3Root()` + `getTileS3Key()` from `tile-addressing.ts`
- Fetch via HTTP GET, pass `signal` through for cancellation
- Decode using `decodeEnvelopeTile()` from `envelope-codec.ts`
- Return `null` on 404 (tile doesn't exist), throw on other errors

### Not responsible for

Caching, dequantization, deciding which tiles to fetch — those are the query service's job.

## Part 3: Seismic Query Service

### Location

`src/models/stores/seismic-query-service.ts` (new file). Property on the `Stores` class. Components access via `useStores().seismicQueryService`.

### Cache structure

Two MobX observable maps:

**Envelope cache:** `Map<string, EnvelopeTileData | "missing" | "loading">` keyed by `"L{level}/{tileIndex}/{station}/{channel}"`.

**Raw data cache:** `Map<string, RawCacheEntry>` keyed by `"{station}/{channel}/raw/{chunkIndex}"` where `chunkIndex = Math.floor(unixSeconds / RAW_CHUNK_DURATION)`. A `RawCacheEntry` holds parsed segments for that chunk, or `"loading"` / `"missing"`.

A `RawSegment` holds `{ startTime: number, sampleRate: number, samples: Float64Array }` — extracted from seisplotjs after parsing, since uPlot needs plain arrays.

Raw chunks use a configurable constant:

```ts
// in envelope-config.ts
export const RAW_CHUNK_DURATION = 7200; // 2 hours, adjustable
```

### Level selection

`selectLevel(secondsPerPixel)` compares against `LEVEL_SPACINGS`:

- `secondsPerPixel >= LEVEL_SPACINGS[0]` (15750) → L0
- `secondsPerPixel >= LEVEL_SPACINGS[1]` (157.5) → L1
- `secondsPerPixel >= LEVEL_SPACINGS[2]` (1.575) → L2
- Below that → raw

Picks the coarsest level whose spacing ≤ `secondsPerPixel`, yielding ≥1 point per pixel without over-fetching.

### query() method

```ts
interface SeismicViewportParams {
  network: string;
  station: string;
  location: string;
  channel: string;
  startTime: DateTime;
  endTime: DateTime;
  pixelWidth: number;
}

query(params: SeismicViewportParams): ViewportQueryResult
```

Returns a fresh object with pre-assembled uPlot-ready arrays:

```ts
interface ViewportQueryResult {
  level: number | "raw";
  // [timestamps, mins, maxs] for envelopes; [timestamps, values] for raw
  data: (number | null)[][];
  amplitudeRange: number;
  isLoading: boolean;
}
```

For **envelope levels**: computes tile indices for the viewport, reads from cache, dequantizes Int16 → physical units, assembles flat arrays with timestamps from tile-addressing math. Inserts `null` for missing/loading tiles.

For **raw level**: computes chunk indices, reads cached segments, assembles `[timestamps, values]`.

Called from MobX observer components — cache reads are tracked for reactivity.

### loadViewport() method

```ts
loadViewport(callerId: string, params: SeismicViewportParams): void
```

- Computes needed tile/chunk indices, checks cache
- Cancels stale fetches for this `callerId` via `AbortController`
- Fires fetches for missing data: `fetchEnvelopeTile` for envelope levels, `fetchRawSeismicData` for raw
- On completion, updates MobX observable cache → triggers re-render

### Multi-level fallback

When zooming to a finer level, `query()` returns one-level-coarser data for regions where the target level is still loading:

- Zooming L0 → L1: show L0 while L1 loads
- Zooming L1 → L2: show L1 while L2 loads
- Zooming L2 → raw: show L2 while raw loads

Once the finer data arrives, MobX reactivity re-renders automatically.

### Missing envelope regions

404 from `fetchEnvelopeTile` is recorded as `"missing"` — a permanent marker distinct from `"loading"`. The plot renders these as gaps (nulls). No raw data fallback at envelope zoom levels.

### Viewport-scoped cancellation

Each WaveformPanel generates a stable caller ID on mount via `useRef(nanoid())`. When a new `loadViewport` arrives with the same caller ID, tiles still needed are kept alive and tiles no longer needed are cancelled via `AbortController`. Multiple WaveformPanel instances don't interfere with each other.

### Station metadata

Cached per station from `fetchStationMetadata`. Provides sensitivity values for raw data count-to-physical-unit conversion.

## SharedSeismogram Changes

### New persisted props

```ts
network: types.maybe(types.string),    // "AK"
station: types.maybe(types.string),    // "K204"
location: types.maybe(types.string),   // "--" or "00"
channel: types.maybe(types.string),    // "HNZ"
```

### Removed

- Volatile state: `seismogram`, `isLoading`, `loadError`
- `loadData` action (day-chunked fetch loop)
- `setSeismogram` action

### Added

- `setStation(network, station, location, channel)` action

The model becomes a thin container of query parameters. Data loading moves entirely to the query service.

## WaveformPanel Changes

### New props

```ts
interface WaveformPanelProps {
  label: string;
  sharedSeismogram: SharedSeismogramType;
  startTime: DateTime;
  endTime: DateTime;
  pixelWidth: number;
}
```

### Rendering

- Gets query service from `useStores().seismicQueryService`
- Calls `loadViewport()` in a `useEffect` (debounced ~100–200ms)
- Reads `query()` in the render body (MobX observer)
- Creates uPlot instance on mount, calls `setData()` on updates, `setSize()` on resize
- Envelope data: two series (min, max) with uPlot band fill
- Raw data: single series as a line
- Generates a stable caller ID on mount via `useRef(nanoid())` for viewport-scoped cancellation

### Removed

- seisplotjs Seismograph custom element
- `seismogram` and `durationSeconds` props

## Timeline Component Changes

- Reads `sharedSeismogram` and view range from `TimelineContentModel`
- Measures pixel width via `ResizeObserver` or ref
- Passes `sharedSeismogram`, `startTime`, `endTime`, `pixelWidth` to WaveformPanel
- No longer passes `seismogram` or `durationSeconds`

## Wave Runner Component Changes

`status-and-output.tsx` currently passes `seismogram`, `startTime`, and `durationSeconds` to WaveformPanel, and shows `isLoading`/`loadError` from SharedSeismogram's volatile state.

### Updated WaveformPanel usage

- Pass `sharedSeismogram`, `startTime`, `endTime`, and `pixelWidth` instead
- `sharedSeismogram` is already available via `model.sharedSeismogram`
- Measure container width for `pixelWidth`
- Compute `endTime` from date strings (instead of `durationSeconds`)

### Loading/error state

SharedSeismogram's volatile `isLoading` and `loadError` are removed. The WaveformPanel handles loading state internally via `queryResult.isLoading`. The explicit loading/error UI in `status-and-output.tsx` can be simplified or driven by the query service's observable state.

## File Structure

```
shared/seismic/
├── envelope-fetcher.ts           # NEW (Part 2)
├── envelope-config.ts            # REVISED: + RAW_CHUNK_DURATION
├── seismic-types.ts              # REVISED: + ViewportQueryResult, RawSegment, etc.

src/models/stores/
├── seismic-query-service.ts      # NEW (Part 3)
├── stores.ts                     # REVISED: + seismicQueryService property

src/plugins/shared-seismogram/
├── shared-seismogram.ts          # REVISED: + station props, remove loading logic
├── components/
│   └── waveform-panel.tsx        # REVISED: uPlot replaces seisplotjs

src/plugins/timeline/components/
├── timeline.tsx                  # REVISED: new WaveformPanel props

src/plugins/wave-runner/components/
├── status-and-output.tsx         # REVISED: new WaveformPanel props, simplified loading UI
```

## New dependency

- `uplot` — ~35KB canvas-based time-series charting library
