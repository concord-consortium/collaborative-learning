# Envelope Tile Cache Design

## Overview

To support smooth zooming across a large time range without loading all raw data, we maintain a tiled cache of **envelope data** — precomputed min/max amplitude pairs over time windows at multiple resolutions. Each "tile" stores a fixed number of envelope points, and the system selects the appropriate resolution level based on the current zoom.

## Storage format

**Columnar Int16** is a good balance of compactness and simplicity:
- Store all min values contiguously, then all max values (columnar layout compresses better than interleaved min/max because adjacent values in each column are more similar).
- Quantize amplitudes to Int16 (2 bytes) by mapping the station's amplitude range linearly to the integer range. Seismic envelope data at coarse resolutions doesn't need Float32 precision.
- Gzip the binary buffer. For example, a 1024-point tile = 1024 × 2 × 2 = 4 KB raw, ~1.5–2 KB gzipped. L3 tiles use more points per tile (see [Tile structure](#tile-structure)).
- In the browser, the decompressed buffer can be read directly as a `Float32Array` (or `Int16Array` with a known scale factor) — no parsing needed.
- Reserve Int16 value `-32768` as a sentinel for "no data" (see [Missing and partial data](#missing-and-partial-data)).

## Switching rule

Each pixel on the x-axis should map to approximately one envelope point. When the user zooms in far enough that an envelope point spans more than ~1 pixel, the system switches to the next finer level. Conversely, when zoomed out, coarser levels avoid loading excessive data.

## Resolution levels

The resolution range spans from a 10-year overview on a ~1000-pixel display down to raw 200 Hz data:
- **Coarsest**: 10 years / 1000 px ≈ 315,000 seconds per point
- **Finest** (raw data): 1/200 Hz = 0.005 seconds per point
- **Ratio**: ~63 million

The number of levels depends on the scale factor K between adjacent levels: `levels = ceil(log_K(63,000,000))`. Larger K means fewer levels but more data loaded at level transitions (up to K × 1000 points per view).

| Factor K | Levels | Points loaded at transition | Bytes at transition (Int16 min+max) |
|----------|--------|-----------------------------|-------------------------------------|
| 10       | 8      | 10,000                      | 40 KB                               |
| 32       | 6      | 32,000                      | 128 KB                              |
| 100      | 5      | 100,000                     | 400 KB                              |
| 1000     | 4      | 1,000,000                   | 4 MB                                |

**Recommended: K ≈ 100, giving 5 levels**

| Level | Point spacing | Sample rate  | Active zoom range          |
|-------|---------------|--------------|----------------------------|
| 0     | ~315,000 s    | ~1/3.6 days  | ≥ ~10 years (full overview)|
| 1     | ~3,150 s      | ~1/52 min    | ~10 years → ~36 days       |
| 2     | ~31.5 s       | ~1/32 s      | ~36 days → ~8.7 hours      |
| 3     | ~0.315 s      | ~3.2 Hz      | ~8.7 hours → ~5.3 min      |
| raw   | 0.005 s       | 200 Hz       | < ~5.3 min                 |

The display width (~1000 px) barely affects the level count — doubling it shifts the count by at most 1.

## Tile structure

Each tile stores envelope points for a contiguous time range. The number of points per tile can vary by level — coarser levels use fewer points per tile since each point covers more time, while L3 uses more points per tile to keep the object count manageable for S3 PUT costs and to provide a reasonable fetch unit for slow school networks.

With 1024 points per tile for L0–L2, the tile durations are:

| Level | Point spacing | Points per tile | Tile duration   | Tiles per year |
|-------|---------------|-----------------|-----------------|----------------|
| L0    | ~315,000 s    | 1,024           | ~10.2 years     | ~0.1           |
| L1    | ~3,150 s      | 1,024           | ~37.3 days      | ~10            |
| L2    | ~31.5 s       | 1,024           | ~9.0 hours      | ~978           |
| raw   | 0.005 s       | —               | —               | on-demand      |

L0 is coarse enough that a single tile covers more than a year — for a 10-year dataset, one tile suffices.

### L3 tile duration

L3 has ~100 million points per station-year. At 1024 points per tile, that would be ~97,700 tiles per year — each only ~1.5–2 KB gzipped but expensive in S3 PUT requests at scale. Using more points per tile reduces the object count and provides a larger fetch unit, which is better for slow connections (fewer round-trips).

| L3 tile duration | Points per tile | Tile size (gzipped Int16) | Tiles per station-year | PUTs at 1,000 station-years | PUT cost |
|------------------|-----------------|---------------------------|------------------------|-----------------------------|----------|
| ~5.4 min (1,024 pts) | 1,024 | ~2 KB | 97,700 | 97.7M | **$489** |
| 1 hour (~11,400 pts) | ~11,400 | ~22 KB | ~8,770 | 8.77M | $44 |
| ~9 hours (~100K pts) | ~100,000 | ~200 KB | ~977 | 977K | $4.89 |
| 1 day (~274K pts) | ~274,000 | ~540 KB | 365 | 365K | **$1.83** |

A duration in the **1–9 hour range** balances PUT costs, fetch size for slow networks, and conflict window for concurrent writers (see [Concurrent writes](#concurrent-writes-and-conflict-handling)). The client fetches 1–2 tiles for a typical L3 viewport, decompresses the tile, and indexes directly into the array — same as other levels, just with more points per tile.

## Tile addressing

Given a datetime, the client needs to determine which tile to fetch. Two approaches:

### Option A: Fixed point count (sequential index)

Tiles are numbered sequentially from a shared epoch (e.g., Unix epoch). The tile duration is constant per level (`points_per_tile × point_spacing`), so the index is:

```
tile_duration = points_per_tile[level] × point_spacing[level]
tile_index = floor((t - epoch) / tile_duration)
```

Tile path: `/{station}/{level}/{tile_index}`

**Pros**: Simple arithmetic, uniform tile sizes, uniform fetch sizes, similar to web map tile systems (z/x/y).
**Cons**: Tile boundaries don't align with human-readable time units. Index numbers can be large (L3 tile indices reach ~5 million for 2024 timestamps from Unix epoch).

### Option B: Calendar-aligned tiles

Tiles snap to natural time boundaries, with the point count varying per tile:

| Level | Tile boundary | Points per tile (approx) |
|-------|---------------|--------------------------|
| L0    | 10 years      | ~100                     |
| L1    | 1 month       | ~830–880 (varies by month)|
| L2    | 1 hour        | ~114                     |
| L3    | 5 minutes     | ~952                     |

Tile path: `/{station}/{level}/2024-03-15T14:00:00` or `/{station}/L2/2024/03/15/14`

**Pros**: Human-readable paths, easy to reason about cache invalidation ("regenerate March 2024"), aligns with how data often arrives in practice.
**Cons**: Variable tile sizes (months have different lengths), more complex indexing math, variable fetch sizes.

### Recommendation

Fixed point count (Option A) is simpler to implement and matches the uniform storage format. Calendar-aligned (Option B) is worth considering if human-readable paths or time-boundary-aligned cache invalidation become important.

## Storage estimates (per station-year, gzipped columnar Int16)

Raw data is not stored in the tile cache — it is fetched on demand from the data provider when the user zooms in. Only envelope levels L0–L3 are stored.

| Level | Points / year | Raw size | Gzipped (est) |
|-------|---------------|----------|---------------|
| L0    | ~100          | 400 B    | negligible    |
| L1    | ~10,000       | 40 KB    | ~20 KB        |
| L2    | ~1,000,000    | 4 MB     | ~2–3 MB       |
| L3    | ~100,000,000  | 400 MB   | ~200–280 MB   |

L3 dominates at ~99% of total storage. For 1 station-year, total envelope storage is roughly **200–280 MB** gzipped.

## Missing and partial data

Tile generation may be driven by end users processing and uploading data, so gaps are expected — both fully missing tiles and tiles with partial coverage.

### Fully missing tiles

When a client requests a tile that doesn't exist, the server returns a 404 (or equivalent). The client treats this as "no data for this time range" and renders it as blank. This is straightforward and requires no special encoding.

### Partially complete tiles

A tile may cover a time range where data exists for only part of the window. In this case the tile is present but contains undefined entries for the missing portions. Both the min and max arrays use the sentinel value **`-32768`** (the minimum Int16 value) to indicate "no data" at that position. The client skips these entries when rendering — drawing nothing for those time intervals rather than plotting a misleading amplitude.

This approach keeps the format simple (fixed-size arrays, no variable-length encoding or sidecar metadata) while cleanly distinguishing "amplitude is zero" from "no measurement exists."

## Why a custom binary format

We considered several existing formats before settling on a simple custom binary layout:

| Format | Tiled HTTP access | Browser JS library | Verdict |
|--------|------------------|--------------------|---------|
| **Zarr** | Native (chunk = object) | zarrita.js | Closest fit — each chunk is an S3 object, metadata is declarative JSON, good Python tooling for generation. But value over custom format is incremental for our simple 1D arrays. |
| **HDF5** | Cloud-Optimized possible | h5wasm (no partial reads in browser) | No JS library supports partial HTTP reads — must download entire files. |
| **miniSEED** | N/A | seisplotjs | Stores raw waveforms only, not pre-computed envelopes. Relevant for the raw data layer but not the tile cache. |
| **TileDB** | Native (tiles on S3) | Cloud API only | No JS library for direct S3 access — requires commercial TileDB Cloud service or a server proxy. |
| **PMTiles** | Range requests | pmtiles | Validates the architecture (single-file tile archives on static storage) but tightly coupled to 2D map tiles. |
| **Arrow IPC / Parquet** | Limited | apache-arrow / hyparquet | Too much per-tile metadata overhead for simple 1D int16 arrays. Parquet's row-group mechanism could work but adds complexity without solving new problems. |

**Zarr is the strongest alternative** — it standardizes exactly what we need (chunked arrays on cloud storage with per-chunk HTTP access). If we later want interoperability with Python analysis tools or want to drop the custom format spec, migrating to Zarr would be straightforward since the underlying storage pattern is nearly identical.

For now, the custom binary format is simpler: no additional JS dependency, zero metadata overhead per tile, and the format is trivial enough (gzipped array of int16 or uint8 values at a known offset) that a spec is barely needed.

## Concurrent writes and conflict handling

S3 objects are immutable — there is no partial/in-place update. Each write replaces the entire object. This means concurrent writers to the same tile must do read-modify-write.

**S3 conditional writes** solve this cleanly: a PUT request with an `If-Match` header (specifying the ETag from the previous GET) will fail with HTTP 412 if another writer modified the object in the meantime. The writer can then re-read, merge, and retry.

### Conflict granularity by level

For L0–L2, tiles are small objects (~2–4 KB). Conflicts require two users to process overlapping time ranges at the same level simultaneously — unlikely in practice.

For L3, tiles are larger (covering hours of data, ~22–200 KB each) which increases the conflict window — two users processing overlapping hours would contend on the same tile. Since concurrent processing of the same station is expected to be rare, occasional retries should be acceptable. The L3 tile duration choice (see [L3 tile duration](#l3-tile-duration)) trades off between PUT cost savings (larger tiles) and conflict window (smaller tiles).

### Write flow

1. Writer fetches the existing tile (noting the ETag), or confirms it doesn't exist
2. Merges new envelope data with any existing data (filling in sentinel values)
3. PUTs the updated object with `If-Match: <previous-ETag>` (or `If-None-Match: *` for new objects)
4. On 412 conflict: re-read, re-merge, retry

## Possible optimization: Uint8 instead of Int16

Seismic waveforms oscillate around zero, so within any envelope window the min is typically ≤ 0 and the max is typically ≥ 0. We can exploit this by storing each as a **single unsigned byte** rather than a signed 16-bit integer:

- **Max values**: Uint8 0–255 maps to `[0, +peak_amplitude]`
- **Min values**: Uint8 0–255 maps to `[0, -peak_amplitude]`

This gives 256 levels per side (512 across the full amplitude range). For a display that's 200–400 pixels tall, this provides sub-pixel precision — more than sufficient for the educational visualizations we're targeting.

**Sentinel value**: Reserve `0` in both arrays to mean "no data." The actual value range becomes 1–255 (255 levels per side). A true zero amplitude maps to 1, which is close enough for display purposes.

**Storage savings**: Raw tile size drops from 4 KB to 2 KB (1024 × 1 × 2), gzipped ~0.8–1 KB. L3 storage per station-year drops from ~200–280 MB to ~100–140 MB.

**Edge case**: At L3 (~0.315s windows), a low-frequency wave could place an entire window on one side of zero — making a min positive or a max negative. Clamping to 0 in these cases loses minimal visual information since the adjacent windows will capture the full extent.

**Resolution limit**: On a full-screen tall display (~2000px height, ~1000px per side), 256 levels means ~4 pixels per quantization step — visible stair-stepping. A custom 10-bit format (1024 levels per side) would fix this but requires bit packing/unpacking with no direct `TypedArray` view, and the storage savings over Int16 are modest after gzip (~1.2 KB vs ~1.5 KB per tile). If 8-bit resolution proves insufficient, falling back to Int16 is simpler than introducing a bit-packed format — the ~2x raw size increase is cheap given the small tile sizes.

## Firestore considerations

Firestore charges $0.18/GB/month for stored data. At ~280 MB per station-year, the storage cost is roughly **$0.05/month per station-year** — very cheap. For comparison, S3 Standard at $0.023/GB would be ~$0.006/month for the same data.
