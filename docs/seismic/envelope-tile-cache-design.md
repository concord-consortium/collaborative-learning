# Envelope Tile Cache Design

## Overview

To support smooth zooming across a large time range without loading all raw data, we maintain a tiled cache of **envelope data** — precomputed min/max amplitude pairs over time windows at multiple resolutions. Each "tile" stores a fixed number of envelope points, and the system selects the appropriate resolution level based on the current zoom.

## Storage format

**Columnar Int16** is a good balance of compactness and simplicity:
- Store all min values contiguously, then all max values (columnar layout compresses better than interleaved min/max because adjacent values in each column are more similar).
- Quantize amplitudes to Int16 (2 bytes) using a fixed global amplitude range per instrument type (see [Amplitude quantization](#amplitude-quantization)). Seismic envelope data at coarse resolutions doesn't need Float32 precision.
- Gzip the binary buffer. For example, a 1000-point L0/L1 tile = 1000 × 2 × 2 = 4 KB raw. L2 tiles use 20,000 points (~80 KB raw). In practice, gzip compression is very effective on envelope data: measured L0/L1 tiles are ~100–600 bytes and L2 tiles are ~3–6 KB (much smaller than the theoretical maximum, due to repeated sentinel values and smooth amplitude patterns). See [Tile structure](#tile-structure).
- In the browser, the decompressed buffer can be read directly as an `Int16Array` with a known scale factor — no parsing needed.
- Reserve Int16 value `-32768` as a sentinel for "no data" (see [Missing and partial data](#missing-and-partial-data)).

## Amplitude quantization

Raw miniSEED data from EarthScope contains integer counts (digitizer output). Before quantizing to Int16 for envelope storage, the counts must be converted to physical units by dividing by the channel's overall sensitivity. This puts values in consistent, physically meaningful units that students can reason about — a learning goal is for students to gain understanding of the actual units of seismic amplitudes.

**Obtaining the sensitivity**: The overall sensitivity (counts per physical unit) is available as the `Scale` field from the EarthScope FDSN Station service at channel level:

```
https://service.earthscope.org/fdsnws/station/1/query?net=AK&sta=K204&level=channel&format=text
```

The response includes `Scale`, `ScaleFreq`, and `ScaleUnits` columns. For example, `Scale=213947.0` with `ScaleUnits=M/S**2` means 213,947 counts per 1 m/s². To convert: `physical_value = raw_count / Scale`. Note that a station's sensitivity can change over time when equipment is swapped — the `StartTime` and `EndTime` columns indicate which sensitivity value applies to a given time period.

The amplitude range depends on the **instrument type**, identified by the second character of the SEED channel code (e.g., B**H**Z vs B**N**Z):

| Instrument code | Sensor type | Physical units | Fixed range | Int16 resolution |
|---|---|---|---|---|
| **H** (high-gain seismometer) | Broadband velocity | m/s | ±0.05 m/s | ~1.5 µm/s per step |
| **L** (low-gain seismometer) | Broadband velocity | m/s | ±0.05 m/s | ~1.5 µm/s per step |
| **N** (accelerometer) | Strong-motion acceleration | m/s² | ±40 m/s² | ~1.2 mm/s² per step |

**Why fixed global ranges instead of per-tile or per-station scaling:**
- **Incremental fill**: Tiles are filled incrementally as users process data. A per-tile scale factor would require rescaling existing data when new data arrives with a larger amplitude, complicating the read-modify-write flow.
- **Cross-station comparison**: Students will compare amplitudes across stations. A fixed range means Int16 values are directly comparable without needing per-tile metadata.
- **Simplicity**: No per-tile header or scale factor to manage. The instrument type (from the channel code) determines the range.

**Precision is sufficient**: The ±0.05 m/s velocity range maps to ±32,767 Int16 steps. Typical teleseismic signals (0.0001–0.001 m/s peak) use 65–650 steps — more than enough for display. Very quiet signals (~0.00001 m/s) still get ~7 steps. Broadband seismometers clip at ~0.013–0.026 m/s, well within the ±0.05 m/s range.

**Deriving the range**: The clip level of a seismometer is determined by `max_output_voltage / sensitivity`. Common broadband sensors: STS-2 clips at ~0.013 m/s, Trillium Compact at ~0.026 m/s. The ±0.05 m/s range provides headroom beyond any common sensor's clip level. Accelerometers typically clip at ±2g to ±4g (~±20–40 m/s²); the ±40 m/s² range covers the common ±4g sensors. Note that clip levels are not available in StationXML — they must be derived from manufacturer specs or computed from the sensitivity and max output voltage.

## Switching rule

Each pixel on the x-axis should map to approximately one envelope point. When the user zooms in far enough that an envelope point spans more than ~1 pixel, the system switches to the next finer level. Conversely, when zoomed out, coarser levels avoid loading excessive data.

## Resolution levels

Users are expected to view at most ~1 year of data at once. The coarsest envelope level should target **less than** the maximum view so it covers a useful zoom range — if L0 is tuned for exactly the maximum, it's only active at that single zoom level and becomes nearly useless.

We store **3 envelope levels** (L0–L2) and fetch raw data directly from EarthScope for views below L2's range. A 4th envelope level (finer than L2) would have tens of millions of points per station-year — too expensive to store. At the L2→raw transition, a raw data fetch is small enough (tens to hundreds of KB) that skipping the 4th level is practical.

The scale factor K ≈ 100 between adjacent levels keeps data loaded at transitions reasonable (~100,000 points = ~400 KB).

**Starting configuration: L0 targets ~6 months (K ≈ 100)**

| Level | Point spacing | Active zoom range | Points/year | Gzipped storage/station-year |
|-------|---------------|-------------------|-------------|------------------------------|
| L0 | ~15,750 s | ~1 year → ~6 months | ~2,000 | negligible |
| L1 | ~157.5 s | ~6 months → ~1.8 days | ~200,000 | ~100–200 KB |
| L2 | ~1.575 s | ~1.8 days → ~2.6 min | ~20,000,000 | ~4–6 MB |
| Raw | 0.005 s | < ~2.6 min | — | fetched on demand from EarthScope |

Total stored envelope data: **~4–6 MB per station-year**, dominated by L2. (Measured: 19 L2 tiles covering ~7 days averaged ~4.3 KB each, extrapolating to ~4.3 MB/station-year. Gzip compression is much more effective than initially estimated because envelope data contains many repeated sentinel values and smoothly varying amplitudes.)

The main tradeoff in choosing L0's target is L2 storage: a smaller L0 target (e.g., 3 months) pushes L2 finer, increasing storage but reducing the view size at which raw data must be fetched. A larger L0 target (e.g., 1 year) halves L2 storage but means raw fetches start at ~5 min views instead of ~2.6 min.

| L0 target | L2 spacing | Raw data needed below... | L2 storage/station-year |
|-----------|-----------|------------------------|------------------------|
| 3 months | ~0.79 s | ~1.3 min | ~8–12 MB |
| 6 months | ~1.575 s | ~2.6 min | ~4–6 MB |
| 1 year | ~3.15 s | ~5 min | ~2–3 MB |

**The level configuration should be easy to change** — the spacings should be defined as constants so we can experiment with different L0 targets and K values without structural code changes. The tile addressing, storage format, and switching logic should all derive from these constants.

The display width (~1000 px) barely affects the level count — doubling it shifts the count by at most 1.

### Integer multiple constraint

Each level's point spacing should be an exact integer multiple of the next finer level's spacing. This matters because tiles are filled incrementally: when new raw data arrives for part of a tile, we need to update the coarser levels without re-reading all the raw data.

For example, if a user processes 1 hour of raw data:
1. L2 envelope points are computed directly from the raw samples (min/max over groups of raw samples per L2 window).
2. The affected L1 points can then be computed from the L2 data — each L1 window covers exactly K consecutive L2 windows, so `L1_min = min(L2_mins)` and `L1_max = max(L2_maxes)`.
3. Similarly, L0 from L1.

If the spacings aren't exact integer multiples, a coarser window would straddle finer windows — its min/max couldn't be computed from the finer level alone, and you'd need to go back to raw data or accept approximate values.

Note that this constraint applies between envelope levels only — not between L2 and the raw data. At the raw→L2 boundary, L2 windows are always computed directly from raw samples, so a non-integer number of samples per window just means some windows have one more sample than others (e.g., if L2 spacing is 1.575s at 200 Hz, windows alternate between 315 and 316 samples). The min/max is still well-defined either way. Raw sample rates also vary by station (commonly 50, 100, or 200 Hz), so L2 spacing can't be an exact multiple of all possible sample intervals anyway.

The approximate values in the table above (~1.575s, ~157.5s, etc.) would need to be adjusted to exact values that satisfy the integer multiple constraint between envelope levels when the levels are finalized.

## Tile structure

Each tile stores envelope points for a contiguous time range. The number of points per tile varies by level — L2 uses 20× more points per tile to reduce tile count (fewer S3 objects to manage). With the 6-month L0 configuration:

| Level | Point spacing | Points per tile | Tile duration   | Tiles per year | Tile size (gzipped) |
|-------|---------------|-----------------|-----------------|----------------|---------------------|
| L0    | ~15,750 s     | 1,000           | ~182 days       | ~2             | ~100–200 bytes      |
| L1    | ~157.5 s      | 1,000           | ~1.8 days       | ~200           | ~500–600 bytes      |
| L2    | ~1.575 s      | 20,000          | ~8.75 hours     | ~1,000         | ~3–6 KB             |
| Raw   | 0.005 s       | —               | —               | on-demand      | —                   |

L2 has the most tiles per year. At 20,000 points per tile, each L2 tile is ~80 KB raw / ~3–6 KB gzipped (measured). The ~1,000 tiles per station-year is very manageable for S3.

Points per tile at each level is chosen to be divisible by K_FACTOR (100), so that tile boundaries at finer levels always align with point boundaries at the next coarser level. This ensures incremental updates to a coarser level never need to read across finer-level tile boundaries.

## Tile addressing

Given a datetime, the client needs to determine which tile to fetch. Two approaches:

### Option A: Fixed point count (sequential index)

Tiles are numbered sequentially from a shared epoch (e.g., Unix epoch). The tile duration is constant per level (`points_per_tile × point_spacing`), so the index is:

```
tile_duration = points_per_tile[level] × point_spacing[level]
tile_index = floor((t - epoch) / tile_duration)
```

Tile path: `v2/{network}_{station}/{location}/{channel}/L{level}/{tileIndex}`

**Pros**: Simple arithmetic, uniform tile sizes, uniform fetch sizes, similar to web map tile systems (z/x/y).
**Cons**: Tile boundaries don't align with human-readable time units.

Including the channel in the path is necessary because the amplitude quantization range depends on the instrument type (see [Amplitude quantization](#amplitude-quantization)), and a station may have multiple channels (e.g., both velocity BHZ and accelerometer BNZ). The SEED location code is likewise its own path segment (blank encoded as `--`), since a station can host multiple instruments that share a channel code but differ by location.

### Option B: Calendar-aligned tiles

Tiles snap to natural time boundaries, with the point count varying per tile:

| Level | Tile boundary | Points per tile (approx) |
|-------|---------------|--------------------------|
| L0    | 1 year        | ~2,000                   |
| L1    | 1 month       | ~16,500–17,500 (varies by month)|
| L2    | 1 hour        | ~2,286                   |

Tile path: `/{station}/{location}/{channel}/{level}/2024-03-15T14:00:00` or `/{station}/{location}/{channel}/L2/2024/03/15/14`

**Pros**: Human-readable paths, easy to reason about cache invalidation ("regenerate March 2024"), aligns with how data often arrives in practice.
**Cons**: Variable tile sizes (months have different lengths), more complex indexing math, variable fetch sizes.

### Recommendation

Fixed point count (Option A) is simpler to implement and matches the uniform storage format. Calendar-aligned (Option B) is worth considering if human-readable paths or time-boundary-aligned cache invalidation become important.

## Storage estimates (per station-year, gzipped columnar Int16)

Raw data is not stored in the tile cache — it is fetched on demand from EarthScope when the user zooms in. Only envelope levels L0–L2 are stored.

**Note on raw data fetching:** When the Timeline tile fetches raw data for zoomed-in views, requests should be aligned to fixed 1-minute time boundaries rather than using the exact visible time range. This way, when multiple students zoom into the same region, their requests hit the same CloudFront cache keys instead of each generating a unique request that must be forwarded to EarthScope. At 200 Hz, 1 minute of raw data is ~48 KB, which downloads in under 0.5 seconds even on a slow school network (1 Mbps). This matters because zooming and scrolling can trigger multiple fetches in quick succession — larger chunks (e.g., 10 minutes = ~480 KB = ~3.8 seconds at 1 Mbps) would feel sluggish for interactive exploration. Note that this 1-minute boundary is intentionally different from the 10-minute coverage bitmap windows in the [event database](event-database-design.md). The coverage bitmap tracks whether the ML model has processed a time range, which is a bulk operation where coarser granularity keeps storage compact. Raw data fetching serves interactive zooming, where responsiveness matters more than minimizing the number of cache keys.

| Level | Points / year | Raw size | Gzipped (measured) |
|-------|---------------|----------|--------------------|
| L0    | ~2,000        | 8 KB     | negligible         |
| L1    | ~200,000      | 800 KB   | ~100–200 KB        |
| L2    | ~20,000,000   | 80 MB    | ~4–6 MB            |

L2 dominates at ~97% of total storage. For 1 station-year, total envelope storage is roughly **4–6 MB** gzipped. These figures are based on measured tile sizes from a ~7-day sample (station K204, channel HNZ): L2 tiles averaged ~4.3 KB gzipped vs 80 KB raw (~5% compression ratio). The high compressibility comes from sparse data (sentinel-filled gaps) and smooth amplitude patterns. These estimates are for the 6-month L0 configuration — see the [comparison table in Resolution levels](#resolution-levels) for how storage changes with different L0 targets.

## Missing and partial data

Tile generation may be driven by end users processing and uploading data, so gaps are expected — both fully missing tiles and tiles with partial coverage.

### Fully missing tiles

When a client requests a tile that doesn't exist, the server returns a 404 (or equivalent). The client treats this as "no data for this time range" and renders it as blank. This is straightforward and requires no special encoding.

### Partially complete tiles

A tile may cover a time range where data exists for only part of the window. In this case the tile is present but contains undefined entries for the missing portions. Both the min and max arrays use the sentinel value **`-32768`** (the minimum Int16 value) to indicate "no data" at that position. The client skips these entries when rendering — drawing nothing for those time intervals rather than plotting a misleading amplitude.

This approach keeps the format simple (fixed-size arrays, no variable-length encoding or sidecar metadata) while cleanly distinguishing "amplitude is zero" from "no measurement exists."

### Open questions: envelope computation with incomplete or corrupt raw data

**Partial gaps within a window**: A single envelope window may cover a time range where only some of the expected raw samples exist (e.g., a data gap starts mid-window). Options include: computing the envelope from whatever samples are present, treating the entire window as missing, or using a threshold (e.g., if less than half the samples are present, mark it missing). To be decided.

**Corrupt / out-of-range raw data points**: Raw seismic data sometimes contains isolated spike values far outside the plausible range. With our fixed amplitude quantization, these would exceed the Int16 range. Options include: clamping to the Int16 max (effectively saying "this window had an extreme value"), discarding the outlier and computing the envelope from the remaining points, or flagging the window as having an error. To be decided.

**Using sentinel values for richer status**: The current design uses `-32768` in both the min and max arrays to mean "no data." But since the sentinel could be set independently on min vs max, a sentinel on only one channel could encode additional states — for example, distinguishing "no data" from "data present but contained out-of-range values" or other error conditions. This would allow the client to render these cases differently (e.g., a different color or icon for corrupt windows vs genuinely missing data). The specific encoding scheme is to be decided.

## Why a custom binary format

We considered several existing formats before settling on a simple custom binary layout:

| Format | Tiled HTTP access | Browser JS library | Verdict |
|--------|------------------|--------------------|---------|
| **Gzipped JSON** | N/A (custom) | Built-in | Simplest to implement — just `JSON.parse()` an array of numbers. But ~2.5–3× larger than binary Int16 after gzip (see size comparison below). At L3 scale this adds up to hundreds of MB of extra storage per station-year. |
| **Zarr** | Native (chunk = object) | zarrita.js | Closest fit — each chunk is an S3 object, metadata is declarative JSON, good Python tooling for generation. But value over custom format is incremental for our simple 1D arrays. |
| **HDF5** | Cloud-Optimized possible | h5wasm (no partial reads in browser) | No JS library supports partial HTTP reads — must download entire files. |
| **miniSEED** | N/A | seisplotjs | Stores raw waveforms only, not pre-computed envelopes. Relevant for the raw data layer but not the tile cache. |
| **TileDB** | Native (tiles on S3) | Cloud API only | No JS library for direct S3 access — requires commercial TileDB Cloud service or a server proxy. |
| **PMTiles** | Range requests | pmtiles | Validates the architecture (single-file tile archives on static storage) but tightly coupled to 2D map tiles. |
| **Arrow IPC / Parquet** | Limited | apache-arrow / hyparquet | Too much per-tile metadata overhead for simple 1D int16 arrays. Parquet's row-group mechanism could work but adds complexity without solving new problems. |

**Gzipped JSON vs binary Int16 size comparison**: A 1000-point tile has 2,000 Int16 values (min + max). As binary, this is 4 KB raw, ~100–600 bytes gzipped (measured). As JSON (e.g., `{"min":[-342,17,...],"max":[289,1045,...]}`), each number averages ~4–5 characters plus a comma separator, producing ~10–12 KB of text, which would gzip larger. Over a full station-year at L2 (~20M points), JSON would substantially increase storage cost. JSON also requires parsing text into numbers rather than directly interpreting a typed array buffer, though for tile-sized payloads the parse time difference is negligible.

**Zarr is the strongest alternative** — it standardizes exactly what we need (chunked arrays on cloud storage with per-chunk HTTP access). If we later want interoperability with Python analysis tools or want to drop the custom format spec, migrating to Zarr would be straightforward since the underlying storage pattern is nearly identical.

For now, the custom binary format is simpler: no additional JS dependency, zero metadata overhead per tile, and the format is trivial enough (gzipped array of int16 values at a known offset) that a spec is barely needed.

## Concurrent writes and conflict handling

S3 objects are immutable — there is no partial/in-place update. Each write replaces the entire object. This means concurrent writers to the same tile must do read-modify-write.

**S3 conditional writes** solve this cleanly: a PUT request with an `If-Match` header (specifying the ETag from the previous GET) will fail with HTTP 412 if another writer modified the object in the meantime. The writer can then re-read, merge, and retry.

### Conflict granularity by level

All tiles are small objects (~2–4 KB each). Conflicts require two users to process overlapping time ranges at the same level simultaneously — unlikely in practice. Since concurrent processing of the same station is expected to be rare, occasional retries should be acceptable.

### Write flow

1. Writer fetches the existing tile (noting the ETag), or confirms it doesn't exist
2. Merges new envelope data with any existing data (filling in sentinel values)
3. PUTs the updated object with `If-Match: <previous-ETag>` (or `If-None-Match: *` for new objects)
4. On 412 conflict: re-read, re-merge, retry

## Why not Uint8

An earlier version of this design considered storing min/max as Uint8 (one unsigned byte each, with min and max stored as magnitudes on their respective sides of zero). This would halve storage, but it is **not viable with fixed global amplitude ranges**. With only 255 usable levels spanning ±0.05 m/s, each step is ~196 µm/s. A typical teleseismic signal at 0.0001 m/s peak would map to less than 1 step — effectively invisible. Int16 with 32,767 levels provides the precision needed to represent both quiet teleseismic signals and near-clip-level local events in the same fixed range.

## Firestore considerations

Firestore charges $0.18/GB/month for stored data. At ~5 MB per station-year, the storage cost is roughly **$0.001/month per station-year** — very cheap. For comparison, S3 Standard at $0.023/GB would be ~$0.0001/month for the same data.
