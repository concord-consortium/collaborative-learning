# Envelope Tile Cache Design

## Overview

To support smooth zooming across a large time range without loading all raw data, we maintain a tiled cache of **envelope data** — precomputed min/max amplitude pairs over time windows at multiple resolutions. Each "tile" stores a fixed number of envelope points, and the system selects the appropriate resolution level based on the current zoom.

## Storage format

**Columnar Int16** is a good balance of compactness and simplicity:
- Store all min values contiguously, then all max values (columnar layout compresses better than interleaved min/max because adjacent values in each column are more similar).
- Quantize amplitudes to Int16 (2 bytes) by mapping the station's amplitude range linearly to the integer range. Seismic envelope data at coarse resolutions doesn't need Float32 precision.
- Gzip the binary buffer. A tile of 1024 points = 1024 × 2 × 2 = 4 KB raw, ~1.5–2 KB gzipped.
- In the browser, the decompressed buffer can be read directly as a `Float32Array` (or `Int16Array` with a known scale factor) — no parsing needed.

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

## Storage estimates (per station-year, gzipped columnar Int16)

Raw data is not stored in the tile cache — it is fetched on demand from the data provider when the user zooms in. Only envelope levels L0–L3 are stored.

| Level | Points / year | Raw size | Gzipped (est) |
|-------|---------------|----------|---------------|
| L0    | ~100          | 400 B    | negligible    |
| L1    | ~10,000       | 40 KB    | ~20 KB        |
| L2    | ~1,000,000    | 4 MB     | ~2–3 MB       |
| L3    | ~100,000,000  | 400 MB   | ~200–280 MB   |

L3 dominates at ~99% of total storage. For 1 station-year, total envelope storage is roughly **200–280 MB** gzipped.

## Firestore considerations

Firestore charges $0.18/GB/month for stored data. At ~280 MB per station-year, the storage cost is roughly **$0.05/month per station-year** — very cheap. For comparison, S3 Standard at $0.023/GB would be ~$0.006/month for the same data.
