# Envelope Generation Pipeline Design

## Summary

Redesign `scripts/seismic/generate-envelopes.ts` to:

1. **Add `--local-only` flag** — write tiles to disk without uploading to S3
2. **Stream-process raw data** — process one ROVER file at a time instead of loading all raw data into memory, writing tiles incrementally as they complete

## Motivation

The current script loads all ROVER miniSEED files into memory at once, computes all L2 envelope points, assembles all tiles at every level, and then uploads everything. For large datasets (months or years of data), this requires holding all raw samples and all intermediate envelope points in memory simultaneously.

A pipeline approach processes one file at a time, keeps only a small working set in memory, and writes completed tiles as it goes. This makes the script practical for arbitrarily large datasets.

The `--local-only` flag enables testing and inspection of generated tiles without requiring AWS credentials or an internet connection.

## Decisions

- **`--local-only` flag**: When set, skip all S3 operations (no client creation, no wipe, no upload). `--output-dir` becomes required when `--local-only` is set. When `--local-only` is not set, behavior is unchanged: upload to S3, and optionally also write to `--output-dir`.
- **Wipe-first for S3**: When uploading to S3, wipe existing tiles for the station/channel before streaming new tiles (same as current behavior).
- **Accumulate rollups in quantized Int16 space**: L1 points are computed from quantized L2 values, matching the behavior of the existing `rollUpEnvelopes` function. This ensures identical output.
- **File-at-a-time granularity**: Each ROVER file (one per day) is the unit of processing. Raw data from one file is released before loading the next.

## Design

### `--local-only` flag

Add `--local-only` as a boolean flag (no value argument). The existing `parseArgs` function advances by 2 for every argument (key + value), so it needs to be modified to handle flag-style arguments that have no value — advance by 1 instead of 2 for `--local-only`.

When present:
- `--output-dir` is required (error if missing)
- No `S3Client` is created
- `wipeExistingTiles` is skipped
- Tile flushing writes to disk only

When not present, behavior is as today: always upload to S3, optionally also write to `--output-dir`.

### Pipeline architecture

#### State per channel

```
openTiles: Map<tileIndex, EnvelopeTileData>[]    // one map per level (3 maps)
l1Accumulators: Map<globalPointIndex, {min: number, max: number}>
l0Accumulators: Map<globalPointIndex, {min: number, max: number}>
highestL2GlobalIndex: number                     // global L2 point index of the most recent L2 point processed
```

- `openTiles[level]` holds tiles currently being filled. At most 2–3 L2 tiles, 1–2 L1 tiles, and 1–2 L0 tiles are open at any time. New tiles are initialized with `mins` and `maxs` arrays filled with `NO_DATA_SENTINEL`.
- `l1Accumulators` tracks running quantized min/max for L1 points still accumulating L2 contributions. Keyed by global L1 point index (`floor(time / L1_spacing)`). At most 2 active at a time.
- `l0Accumulators` tracks running quantized min/max for L0 points still accumulating L1 contributions. At most 1–2 active (one finishing, one starting).

#### Global point indices

A "global point index" is the index of an envelope point in the global time grid:

```
globalPointIndex(time, level) = floor(time / LEVEL_SPACINGS[level])
```

Each L1 point at global index `j` covers L2 global indices `[j * K, (j+1) * K)`. This is how L2 points are mapped to their corresponding L1 accumulator, and similarly L1 to L0.

#### Processing flow

**Setup:**
1. Parse args, fetch station metadata
2. Find and sort ROVER files by date. Files are organized as `network/year/dayOfYear/...`. Sort numerically by extracted year and day-of-year components (not lexicographically, since day-of-year may not be zero-padded).
3. If S3 mode: wipe existing tiles for the station/channel
4. Initialize empty pipeline state

**Precondition:** ROVER files must be non-overlapping in time. The pipeline assumes that processing files in date order produces L2 points in monotonically increasing time. If a file contains timestamps that fall within an already-flushed tile, those points would be silently lost. This is a safe assumption for ROVER data, which organizes files by day with no overlap.

**Per file:**
1. Load one ROVER file, parse miniSEED, extract traces for the target channel (filtering by `--channel` if specified, same as the current script)
2. Sort traces within the file by start time
3. For each trace:
   a. Convert raw counts to physical units using the channel's sensitivity
   b. Call `computeEnvelopesFromRaw` to get L2-resolution min/max arrays
   c. For each L2 envelope point (with computed timestamp):
      - Quantize min/max using `quantize(value, rangeMax)` → `qMin`, `qMax`
      - Compute L2 tile index and point-within-tile offset; place into open L2 tile (create if needed)
      - Update `highestL2GlobalIndex` to this point's global L2 index
      - Compute L1 global point index; update L1 accumulator (running min of `qMin`, running max of `qMax`; create if needed)
4. After processing all traces in the file, flush completed state (see below)
5. Release the file's raw data (traces, samples go out of scope)

**Flushing completed state:**

After each file, determine what has completed based on time advancement. The "current" indices are derived from `highestL2GlobalIndex`:

```
currentL1PointIndex = floor(highestL2GlobalIndex / K)
currentL0PointIndex = floor(currentL1PointIndex / K)
```

1. For each L1 accumulator with index < `currentL1PointIndex`:
   - The L1 point is complete — place its quantized min/max into the appropriate L1 tile
   - Compute the L0 global point index for this L1 point (`floor(l1PointIndex / K)`); update the L0 accumulator
   - Remove the L1 accumulator
2. For each L0 accumulator with index < `currentL0PointIndex`:
   - The L0 point is complete — place its quantized min/max into the appropriate L0 tile
   - Remove the L0 accumulator
3. For each level, flush (write/upload) any open tile whose index is less than the current tile index for that level, then remove it from the open set

**Final flush:**

After all files are processed:
1. Finalize all remaining L1 accumulators → place into L1 tiles, update L0 accumulators
2. Finalize all remaining L0 accumulators → place into L0 tiles
3. Flush all remaining open tiles at every level

#### Tile flushing

A single `flushTile(level, tileIndex, tileData)` function handles output:
- If `outputDir` is set: encode tile with `encodeEnvelopeTile`, write to `{outputDir}/{station}/{channel}/L{level}/{tileIndex}`
- If S3 mode (not `--local-only`): encode tile, PUT to S3 with gzip content encoding

#### Memory profile

At any point during processing:
- **Raw data**: ~20–40 MB (one day's ROVER file parsed into traces)
- **Open L2 tiles**: ~2–3 tiles × 80 KB = ~160–240 KB
- **Open L1 tiles**: ~1–2 tiles × 4 KB = ~4–8 KB
- **Open L0 tiles**: 1–2 tiles × 4 KB = ~4–8 KB
- **Accumulators**: A few entries × 4 bytes each = negligible

Total: roughly the size of one ROVER file, regardless of how much total data is being processed.

### Existing code reuse

- `findRoverFiles` — reused as-is (already returns file paths without loading data)
- `computeEnvelopesFromRaw` — reused as-is (operates on one trace's samples)
- `quantize` — reused as-is
- `encodeEnvelopeTile` — reused as-is (called per tile at flush time)
- `getTileIndex`, `getTileTimeRange`, `getTileS3Key` — reused as-is
- `assembleTiles` — replaced by incremental point placement in the pipeline
- `rollUpEnvelopes` — replaced by the L1/L0 accumulators (same logic, just incremental)
- `loadMiniSeedFiles` — replaced by per-file loading within the pipeline loop
- `uploadTiles` — replaced by `flushTile` which handles one tile at a time

### L2 tile boundary / L1 point alignment

This was written when `POINTS_PER_TILE[2]` was 20,480 (not divisible by K=100), which caused L1 points to straddle L2 tile boundaries. This has since been fixed — `POINTS_PER_TILE` is now `[1000, 1000, 20000]`, with all values divisible by K_FACTOR. See [Tile structure](../seismic/envelope-tile-cache-design.md#tile-structure).
