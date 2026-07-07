# Seismic Admin Interface — Design

**Date:** 2026-07-07
**Status:** Approved, ready for implementation planning
**Related:** [browser-seismic-downloader.md](../seismic/browser-seismic-downloader.md), [envelope-tile-cache-design.md](../seismic/envelope-tile-cache-design.md)

## Overview

A standalone admin page at `/seismic-admin` (hosted like `/authoring`) that shows the
state of seismic data and lets an admin manage the **local raw-data cache**: see which
days of raw miniSEED are downloaded per station, download missing days, and delete
downloaded days — all scoped to a chosen date range.

**v1 scope:** the raw-data (OPFS) side is fully built. The **envelope side is scoped
out** — there is no way to enumerate envelope availability today (tiles are S3-only with
no index/listing, and no Firestore index exists). Envelope UI elements are rendered as
disabled placeholders so the layout is ready when a coverage source is added later.

## Hosting & app shell

- New webpack entry `src/seismic-admin/index.tsx` + an `HtmlWebpackPlugin` emitting
  `seismic-admin/index.html`, mirroring the `authoring` entry → served at `/seismic-admin`.
- A standalone React app; no document/unit MST tree required.
- Optional `?unit=<url|code>` loads a **station catalog** (see below). Without it, the
  page runs purely off the local OPFS cache.

## Station list

The selectable stations are the **union** of:
1. Stations present in the OPFS cache (`listStations()`), and
2. If `?unit=` is provided, the unit's `stations` config (`StationConfig[]`, with labels
   and location).

**Dedup/merge key: `(network, station, channel)`.** A unit-catalog station and an OPFS
station that share `(network, station, channel)` are treated as the **same station**; the
catalog entry supplies the display label and the `location` code.

All stations start **selected**; each can be toggled off/on. Applying the filter (see
header) re-renders the body for the selected set.

### Location handling (known limitation)

OPFS cache paths are keyed by `{network}_{station}/{channel}` and **omit `location`**, so
`listStations()` recovers only `(network, station, channel)`. `location` (needed to issue
a dataselect download) comes from the catalog match. Consequently:
- Catalog-backed stations: full identity known → **download enabled**.
- OPFS-only "orphan" stations (no catalog match): shown with disk usage; **delete
  enabled**, **download disabled** (location unknown).

This stems from the cache key omitting location (a system-wide assumption shared with the
envelope tile cache). Fixing it (keying caches by `StationLocation`) is out of scope here.

## Data layer — new OPFS enumeration

Add admin-facing, **range-scoped** reads to `opfs-seismic-cache.ts` (async, main-thread):

- `listStations(): Promise<StationData[]>` — walk `/seismic-cache/{net}_{sta}/{channel}/…`
  and return the `(network, station, channel)` present.
- `scanCachedDays(station, startDay, endDay)` — **exists**; drives the raw timeline (which
  days in range are cached).
- `stationRawBytes(station, startDay, endDay): Promise<number>` — **new**; sum the file
  sizes of cached day files **within the range only** (per-day `getFile().size`).
- `deleteDaysInRange(station, startDay, endDay): Promise<void>` — **new**; delete the day
  files whose day index falls **within the range only** (per-day `removeEntry`). Replaces
  whole-station delete for the admin. (Existing `deleteStation` stays for other callers.)

All range-scoped methods iterate `daysInRange(startSec, endSec)` and operate per day file,
consistent with `scanCachedDays`.

## Layout

- **Fixed header (does not scroll):** station checkboxes, start-date and end-date pickers,
  and an **Apply** button that applies the station filter and time range together.
- **Scrollable body:** an "All selected stations" summary section, then one section per
  selected station.

## Per-station section

- Station info header (label / net.sta.loc.cha).
- **Left area (most of the width):**
  - **Raw-data timeline** — a day-resolution bar spanning [start, end], filled where
    `scanCachedDays` reports the day cached. To its right: "N / M days" (cached / total in
    range) and the disk usage from `stationRawBytes`.
  - **Envelope timeline (placeholder)** — rendered disabled ("envelope coverage
    unavailable"), counts shown as "—". Layout preserved for future wiring.
- **Right area (buttons):**
  - **Fill missing envelope** — disabled (future).
  - **Download missing raw** — enabled for catalog-backed stations; downloads only the
    gap days in range.
  - **Delete raw data** — deletes cached days **in the range**, behind a simple confirm
    modal ("Delete raw data for {station} from {start} to {end}?").

## All-stations summary section

- No timelines. Shows aggregate counts across the selected stations: missing-envelope-days
  ("—", stubbed) and total missing-raw-days (days in range not yet cached).
- Buttons fan out to all selected stations: **Download missing raw** (sequential across
  stations) and **Delete raw data in range** (single confirm, then per-station delete).

## Actions & orchestration

- **Download missing raw** reuses `SeismicDownloadService.ensureRange(station, {start,end})`
  — it downloads only the gap days and exposes observable `completed / total /
  erroredDays / emptyDays` for per-section progress.
- **Cross-station downloads run sequentially** (one active `SeismicDownloadService` at a
  time) to respect EarthScope's shared-proxy connection limit.
- **Delete** reuses the new `deleteDaysInRange`.

## Error handling

- OPFS read/enumeration errors surface as an inline error on the affected section; the
  rest of the page keeps working.
- Download failures are reflected in the section's progress (`erroredDays`), consistent
  with the downloader's existing behavior.
- A missing/invalid `?unit=` degrades gracefully to OPFS-only (no catalog, download
  disabled on orphans).

## Testing

- OPFS enumeration (`listStations`, `stationRawBytes`, `deleteDaysInRange`) against the
  in-memory `fake-opfs` (the fake's file objects gain a `size`).
- Pure coverage→timeline-segments computation (cached-day set + range → filled/empty spans)
  and the missing-days counts.
- Action wiring with a mocked `SeismicDownloadService` / cache (download calls
  `ensureRange`; delete calls `deleteDaysInRange` after confirm; cross-station runs
  sequentially).
- Component tests: header apply-flow (filter + range), the confirm modal, and
  download-disabled state for orphan stations.

## Out of scope for v1

- Envelope availability/coverage (timeline, counts, working "fill" button) — pending a
  coverage source (S3 manifest / listing / Firestore index).
- Fixing the location-in-cache-key omission.
- Any change to the bulk downloader itself.
