# Seismic Data Services Design

## Summary

This document specifies the shared model and global services for working with seismic envelope tiles and raw waveform data. The system is split into three parts: two stateless fetchers for raw data and envelope tiles, and a reactive query service that orchestrates them for the plot component.

### Related documents

- [Seismic Tiles Plan](seismic-tiles-plan.md) — overall tile architecture and open questions
- [Envelope Tile Cache Design](envelope-tile-cache-design.md) — tile levels, storage format, quantization
- [Browser-Based Seismic Data Downloader](browser-seismic-downloader.md) — future bulk download system with OPFS caching
- [ML Model Integration](ml-model-integration-design.md) — ML model runner that consumes raw data

## Architecture Overview

Three parts, each with a single responsibility:

1. **Raw Data Fetcher** — makes a single HTTP request to EarthScope's dataselect endpoint, returns a `Response`. No caching, no parsing. Lives in `shared/seismic/earthscope-client.ts` alongside the existing metadata fetcher.

2. **Envelope Tile Fetcher** — fetches a single envelope tile from S3, decodes gzipped Int16 buffers. No caching, no dequantization. Lives in `shared/seismic/envelope-fetcher.ts`.

3. **Seismic Query Service** — the reactive layer. Lives on the `stores` object. Orchestrates parts 1 and 2, manages caching with MobX observables, and exposes a query API that the plot component observes. Handles level selection, multi-level fallback, and viewport-scoped cancellation.

**SharedSeismogram** is revised to be a thin MST shared model holding only query parameters (station, channel, time range, model). It has no knowledge of the query service.

The plot component reads query parameters from SharedSeismogram and calls the query service directly.

## Part 1: Raw Data Fetcher

### Location

`shared/seismic/earthscope-client.ts` — added to the existing file alongside `fetchStationMetadata`.

### Purpose

Make a single FDSN dataselect HTTP request and return the `Response`. This is the lowest-level building block for fetching seismic waveform data from EarthScope.

### API

```ts
fetchRawSeismicData(
  network: string,
  station: string,
  channel: string,
  startTime: string,        // ISO 8601
  endTime: string,          // ISO 8601
  options?: {
    baseUrl?: string,       // proxy URL, defaults to CloudFront proxy
    signal?: AbortSignal    // for cancellation by caller
  }
): Promise<Response>
```

### Responsibilities

- Construct the FDSN dataselect URL with query params
- Make a single `fetch()` call through the CloudFront proxy, passing `signal` to `fetch()` for cancellation support
- Validate the HTTP response (throw on non-2xx)
- Return the `Response` object

### Not responsible for

Parsing, caching, chunking, retries, concurrency. Those are caller concerns.

### Why return Response instead of ArrayBuffer

Returning the `Response` gives callers flexibility in how they consume the data:

- **ML model runner**: calls `response.arrayBuffer()` to buffer in memory and queue for processing. The compressed miniSEED ArrayBuffers are roughly half the size of decoded samples, making them more memory-efficient for queuing.
- **Query service**: calls `response.arrayBuffer()` then parses with seisplotjs.
- **Future browser-seismic-downloader**: can pipe `response.body` directly to an OPFS file handle via `response.body.pipeTo(writable)`, avoiding an intermediate ArrayBuffer entirely.

**Download progress:** Since the `Response.body` is a `ReadableStream`, callers can read it chunk by chunk and track bytes received against the `Content-Length` header to report download progress. This is useful for large fetches (e.g., 24 hours of data at ~20 MB) that may take several seconds. No changes to the fetcher API are needed — the caller decides whether to consume the response as a stream (with progress tracking) or just call `.arrayBuffer()`.

**Possible optimization:** Investigate whether seisplotjs can parse miniSEED from a `ReadableStream` rather than requiring a complete `ArrayBuffer`. miniSEED is a record-based format (fixed-size records), so streaming parsing is theoretically possible. This would allow piping fetch responses through a parsing transform without buffering the full response.

### Relationship to browser-seismic-downloader

The [browser-seismic-downloader](browser-seismic-downloader.md) will use this function as its per-day-chunk fetcher, wrapping it with day-aligned chunking, OPFS caching, availability-based gap detection, concurrency limiting (5 connections per EarthScope's rate limits), and retry logic. This function is designed as the building block that the downloader builds on top of.

### Alongside existing code

`fetchStationMetadata` stays as-is in the same file. It fetches station *metadata* from the `/station/1/query` endpoint. `fetchRawSeismicData` fetches *waveform data* from the `/dataselect/1/query` endpoint. Together they form a JavaScript API for EarthScope's FDSN services.

### Consumers

- **ML model runner** — queues ArrayBuffers for TensorFlow.js processing
- **Seismic query service** (Part 3) — fetches raw data for zoomed-in views below L2
- **Future browser-seismic-downloader** — bulk download with OPFS caching

## Part 2: Envelope Tile Fetcher

### Location

`shared/seismic/envelope-fetcher.ts` (new file)

### Purpose

Fetch a single precomputed envelope tile from S3 and decode it. The lowest-level building block for reading envelope data.

### API

```ts
fetchEnvelopeTile(
  station: string,        // e.g., "AK_K204"
  channel: string,        // e.g., "HNZ"
  level: number,          // 0, 1, or 2
  tileIndex: number,
  options?: {
    s3BaseUrl?: string,   // defaults to S3/CloudFront base URL
    signal?: AbortSignal  // for cancellation by caller
  }
): Promise<EnvelopeTileData | null>
// Returns { mins: Int16Array, maxs: Int16Array } or null on 404
```

### Responsibilities

- Construct the S3 URL using `getTileS3Key` from `tile-addressing.ts`
- Fetch via HTTP GET, passing `signal` to `fetch()` for cancellation support
- Decode using `decodeEnvelopeTile` from `envelope-codec.ts` (gunzip → columnar Int16Arrays)
- Return `null` on 404 (tile doesn't exist for that time range)
- Throw on other HTTP errors

### Not responsible for

Dequantization (converting Int16 → physical units). The query service or the plot decides when and how to dequantize, since the plot's value-to-pixel conversion could fold in dequantization to avoid an extra pass over the data.

Caching and deciding which tiles to fetch for a viewport — that's the query service's job.

### Consumers

- **Seismic query service** (Part 3) — fetches tiles to populate the cache

## Part 3: Seismic Query Service

### Location

Property on the `stores` object. Components access it via React context (`useStores()`). Not in the MST environment — only components and other services use it, not MST models.

### Purpose

The reactive layer that orchestrates Parts 1 and 2 to serve the plot component. Manages caching with MobX observables and provides query results that update incrementally as data loads.

### API

```ts
// MobX computed — returns current best-available data for the viewport.
// Returns a fresh object each call containing references to cached data.
query(
  station: string,
  channel: string,
  startTime: number,
  endTime: number,
  pixelWidth: number
): ViewportQuery

// Action — triggers fetches for missing data.
// Cancels stale fetches from the previous call with the same callerId.
loadViewport(
  callerId: string,
  station: string,
  channel: string,
  startTime: number,
  endTime: number,
  pixelWidth: number
): void
```

### ViewportQuery result

A fresh object returned on each `query()` call, containing references to cached data rather than assembled arrays. This keeps construction cheap — the expensive assembly into drawable form happens in the rendering step.

The result contains a mix of:

- **Envelope segments** — references to cached Int16Array tile data (not yet dequantized), tagged with level, tile index, and time range
- **Raw segments** — references to cached miniSEED segment data, tagged with sample rate and time range
- **Gaps** — regions where data is still loading or unavailable

The exact structure of ViewportQuery is **TBD based on the plot implementation** (uPlot vs custom canvas). The form of the cache — both for envelope data and raw data — should be driven by the specific needs of the plotting library to minimize conversion overhead during rendering.

### Requirements

The specific API and approach for the query service is likely to change as the plot implementation is developed, but the following requirements should hold:

1. **Cancellable in-flight requests.** When the plot moves to a new viewport before tiles have finished loading, the service must be able to cancel stale fetches rather than letting them pile up. See [Viewport-scoped cancellation](#viewport-scoped-cancellation) for the current approach.

2. **Debouncing is the caller's responsibility.** When a user is scrolling and zooming rapidly, the plot component should debounce before calling `loadViewport` to avoid starting and immediately cancelling many connections. The query service does not debounce internally — it assumes each `loadViewport` call represents a viewport the caller actually wants data for.

### Level selection

Given `secondsPerPixel` (derived from viewport width and time range), the service selects the appropriate data source:

- L0, L1, or L2 envelope level — using `LEVEL_SPACINGS` from `envelope-config.ts`
- Raw data — when zoomed in below L2 resolution

### Multi-level fallback

When the user zooms in (e.g., L1 → L2), the query returns the best available data per region:

- L2 tiles where already cached
- L1 data as fallback for regions where L2 tiles haven't loaded yet

As L2 tiles arrive and populate the MobX observable cache, `query()` returns updated results and the plot re-renders. The plot receives the full composite each time and re-renders all data (not just the new tiles). Given the data volumes involved (~1200 envelope points or ~24K raw samples per viewport), full re-rendering is expected to be fast enough. This can be revisited if performance is an issue.

### Viewport-scoped cancellation

Each plot component generates a stable caller ID (e.g., on mount) and passes it to every `loadViewport` call. When a new `loadViewport` arrives with the same caller ID:

1. The service compares the new viewport's needed tiles against in-flight fetches for that caller
2. Tiles still needed by the new viewport are kept alive
3. Tiles no longer needed are cancelled via `AbortController`

This prevents a pile-up of in-flight requests when the user pans or zooms rapidly. Multiple plot components (from different Timeline tiles) each have their own caller ID, so their viewports don't interfere.

`query()` is not scoped by caller ID — it reads from the shared cache, so two plots looking at the same station benefit from shared tiles.

### Caching

The cache holds at minimum:

- Data for the current query (tiles being loaded and already loaded)
- Data from the previous query (so fallback data is available during zoom transitions)

Envelope tiles are cached as Int16Arrays (as returned by Part 2). Dequantization is deferred to the plot or a rendering helper.

Raw data cache format is TBD. Raw data from EarthScope comes as miniSEED parsed by seisplotjs into segments, each with a start time, sample rate, and sample array. The cache stores these segments and the query finds segments that overlap the viewport.

Raw data is not cached by request time range (since viewports shift as the user scrolls). Instead, individual segments are cached and looked up by time overlap.

### What it delegates

- Envelope tile fetching → `fetchEnvelopeTile` (Part 2)
- Raw data fetching → `fetchRawSeismicData` in `earthscope-client.ts` (Part 1)
- miniSEED parsing → seisplotjs (or a thin wrapper)
- Tile addressing math → `tile-addressing.ts`
- Level configuration → `envelope-config.ts`

## SharedSeismogram (Revised)

### Location

`src/plugins/shared-seismogram/shared-seismogram.ts` — revision of existing file.

### Purpose

Thin MST shared model holding the query parameters that identify what seismic data a tile cares about. One instance per Wave Runner tile and one per Timeline tile.

### Props (persisted)

```ts
type: "SharedSeismogram"
network: string         // e.g., "AK"
station: string         // e.g., "K204"
channel: string         // e.g., "HNZ"
startTime: number       // Unix seconds
endTime: number         // Unix seconds
model: string           // ML model identifier
```

### Changes from current implementation

The current SharedSeismogram has:
- Hardcoded S3 miniSEED URLs
- Volatile state: `seismogram`, `isLoading`, `loadError`
- A `loadData` action that fetches and parses miniSEED

All of this is removed. The revised model has only props and setters. Loading, caching, and data management move to the query service.

### Lifecycle

- **Wave Runner** creates a SharedSeismogram and links itself as provider. Updates props as the user changes filters in the data setup UI.
- **"Timeline It!"** creates a new SharedSeismogram with a snapshot of the current props. This new instance is linked to a new Timeline tile.
- **Timeline tile's plot component** reads props from its linked SharedSeismogram and uses them to call the query service directly.
- **SharedSeismogram has no dependency on the query service.** It doesn't know the service exists.

### Registration

Remains registered as before via `shared-seismogram-registration.ts` with `registerSharedModelInfo`.

## File Structure

```
shared/seismic/
├── earthscope-client.ts          # REVISED: + fetchRawSeismicData (Part 1)
├── envelope-fetcher.ts           # NEW (Part 2)
├── envelope-config.ts            # existing
├── envelope-codec.ts             # existing
├── envelope-compute.ts           # existing
├── tile-addressing.ts            # existing
├── seismic-types.ts              # REVISED: + ViewportQuery, new types

src/plugins/shared-seismogram/
├── shared-seismogram.ts          # REVISED: thin query-params model
├── shared-seismogram-registration.ts  # existing

src/models/stores/
├── seismic-query-service.ts      # NEW (Part 3)
```

## Data Flow: User Zooms Into Timeline

1. **Plot component** detects viewport change. Reads station/channel from SharedSeismogram (MobX observation).
2. **Plot calls `loadViewport(callerId, ...)`** on the query service. Service computes `secondsPerPixel`, selects level, computes needed tile indices, checks cache, cancels stale fetches for this caller.
3. **Service fetches missing data** — envelope tiles via Part 2 and/or raw data via Part 1, in parallel.
4. **Each tile arrival updates MobX observable cache** — `query()` returns new results — plot re-renders incrementally.
5. **Plot reads `query()`** — gets best-available composite: finer-level tiles where cached, coarser-level fallback for gaps.
6. **Plot renders** — envelopes as filled vertical bands (min/max), raw as polyline. Format details depend on plot implementation.

Steps 4-6 repeat as each tile arrives during incremental loading.

## Shared code: browser and Node compatibility

All code in `shared/seismic/` must run in both the browser and Node.js (used by scripts like `generate-envelopes.ts`). Implementations should:

- Use `fetch()` for HTTP requests (available natively in Node 18+ and all target browsers)
- Avoid browser-only APIs (DOM, Web Workers, OPFS) and Node-only APIs (`fs`, `path`, `process`)
- Use standard `AbortController`/`AbortSignal` for cancellation (available in both environments)
- Be careful with dependencies — e.g., `pako` works in both environments, but some libraries may not

The seismic query service (Part 3) is browser-only since it lives on `stores` and uses MobX. Only Parts 1 and 2 and the shared utilities need dual-environment support.

## Station identifier conventions

SharedSeismogram stores `network` and `station` as separate props (matching EarthScope's API parameters). The envelope tile fetcher and S3 paths use the combined `{network}_{station}` format (e.g., `"AK_K204"`), as documented in [seismic-tiles-plan.md](seismic-tiles-plan.md#station-identification-across-systems). The query service joins them when calling the envelope fetcher and passes them separately when calling the raw data fetcher.

## Open Questions

### Plot implementation

The choice between uPlot and custom canvas rendering affects:
- The exact structure of `ViewportQuery`
- Cache format for both envelope and raw data
- Whether dequantization happens in the service, a rendering helper, or the plot's value-to-pixel conversion

This design intentionally leaves these details unspecified until the plot implementation is chosen.

### Raw data segment caching

The optimal in-memory representation for raw seismic segments (seisplotjs objects vs extracted typed arrays) depends on the plot's needs and memory constraints. To be decided alongside the plot implementation.
