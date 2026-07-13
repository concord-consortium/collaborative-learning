# Design: Location-Aware Seismic Storage

**Date:** 2026-07-13
**Status:** Approved

## Problem

Seismic data is identified by the FDSN NSLC tuple: network, station, location, channel. Today the
storage layers key data by network/station/channel only:

- **S3 envelope tiles**: `v1/{network}_{station}/{channel}/L{level}/{tileIndex}`
- **OPFS raw cache**: `/seismic-cache/{network}_{station}/{channel}/{year}/{doy}.mseed`
- **In-memory caches** (query service) and **admin station keys** derive from the same prefix
  functions, so they share the omission.

The location code distinguishes multiple instruments at one station (e.g. `00` vs `10`, or blank).
Two instruments sharing a channel code would collide under the current keys, and location is
already required when fetching from EarthScope — it just isn't recorded when the results are
stored.

## Decisions

1. **Clean break** — no backward compatibility with the v1 layouts. Old OPFS data and old S3
   tiles are simply never read again (new root names); no cleanup code.
2. **Location as a separate path segment** in FDSN NSLC order, with blank encoded as `--`
   (the FDSN convention).
3. **Collapse the type ladder** — `StationData` carries an optional `location`, with
   `undefined ≡ ""` (blank SEED location). `StationLocation` is deleted.

## Design

### 1. Types (`shared/seismic/seismic-types.ts`)

- `StationData` gains `location?: string`. `undefined` and `""` both mean the blank SEED
  location; they are normalized only at comparison/encoding points, never eagerly.
- `StationLocation` is deleted; all references (downloader, query service, viewport params)
  switch to `StationData`. `StationQuery` extends `StationData`.
- `StationConfig` becomes `StationData` plus optional `label` — no boundary conversion needed.

### 2. Path encoding (`tile-addressing.ts`, `envelope-config.ts`)

- New helpers, the single choke point for blank-location handling in paths:
  - `encodeLocation(location?: string): string` → `location ? location : "--"`
  - `decodeLocation(segment: string): string` → `segment === "--" ? "" : segment`
    (`listStations` yields `""`, never `undefined`, so round-trips are stable)
- `getStationChannelPrefix` becomes `{network}_{station}/{encodedLocation}/{channel}`.
  The S3 tile key is therefore `{network}_{station}/{loc}/{channel}/L{level}/{tileIndex}`.
- `getStationPrefix` / `parseStationPrefix` are unchanged.
- `ENVELOPE_LAYOUT_VERSION` bumps to **2**; the S3 root becomes `.../envelopes/v2/` so v1 tiles
  are never read. Deleting the v1 objects is a manual one-off
  (`aws s3 rm --recursive` on `.../envelopes/v1/`), not part of the code change.

Example keys (blank location and `00`):

```
S3:   v2/AK_K204/--/HNZ/L2/12345
S3:   v2/IU_ANMO/00/BHZ/L2/12345
OPFS: /seismic-cache-v2/AK_K204/--/HNZ/2026/031.mseed
```

### 3. OPFS cache (`opfs-seismic-cache.ts`)

- New layout: `/seismic-cache-v2/{network}_{station}/{location}/{channel}/{year}/{doy}.mseed`
  (`ROOT_DIR = "seismic-cache-v2"`).
- The old `seismic-cache` root is left in place and ignored — no migration or cleanup code.
- `listStations()` walks the extra directory level and decodes the location segment, so
  OPFS-discovered stations carry a real location.

### 4. Envelope generation script (`scripts/seismic/generate-envelopes.ts`)

- Add a `--location` CLI arg (default blank).
- **Correctness fix**: `loadMiniSeedFile` keys traces by channel only — at a station with two
  location codes on the same channel (e.g. `00` and `10` both with `BHZ`), it would merge
  samples from different instruments. Capture `locationCode` from seisplotjs and filter traces
  by channel **and** location.
- `findSensitivity` likewise filters metadata by channel + location.
- Fix the stale `fetchStationMetadata(config.network, config.station)` call (the signature
  takes a `StationId` object).
- Tile keys and `wipeExistingTiles` pick up location automatically via
  `getStationChannelPrefix`.

### 5. Consumer ripple

- **Query service** (`seismic-query-service.ts`): `envelopeCacheKey` / `rawCacheKey` gain
  location for free via the prefix change. `getMetadataForChannel` must match channel **and**
  location, normalizing both sides (`(m.location ?? "") === (query.location ?? "")`) — that is
  the point of location codes: different instruments have different sensitivities.
- **Download service/worker**: `DownloadParams` extends `StationData`; `ensureRange` stores the
  full identity so `readDay` hits the right OPFS path.
- **Admin**: station keys (`getStationChannelPrefix`) change shape, so saved localStorage
  selections in the old format are pruned on refresh — acceptable under the clean break.
  `mergeStations` merges on the location-aware key. `stationLabel`'s fallback shows the
  location when non-blank (e.g. `IU ANMO 00 BHZ`).

### 6. Error handling & testing

- Blank-vs-`--` conversion lives only in `encodeLocation` / `decodeLocation`; equality checks
  outside the path helpers normalize with `?? ""` on both sides.
- Tests to update: `tile-addressing.test`, `opfs-seismic-cache.test` (+ `fake-opfs`),
  `seismic-downloader.test`, `seismic-query-service.test`, admin tests.
- New coverage: encode/decode round-trip (including `undefined`), `listStations` with multiple
  locations at one station, metadata matching by channel + location, script trace filtering by
  location.

## Out of scope

- Backward-compatible reads of v1 layouts.
- Cleanup of old OPFS roots or v1 S3 objects (S3 cleanup is a manual one-off).
- Any UI for choosing among location codes (catalog/config continues to supply them).
