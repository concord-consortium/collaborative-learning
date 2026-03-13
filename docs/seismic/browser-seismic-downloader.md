# Browser-Based Seismic Data Downloader

## Overview

To run ML models on seismic data in the browser, students need to download raw waveform data from EarthScope (formerly IRIS). Depending on the channel, data rates range from 50 Hz (BHZ) to 200 Hz (HHZ), meaning a year of data for a single station is roughly 1.8–7.3 GB. This document describes an approach for building a robust browser-based download manager modeled on [ROVER](https://earthscope.github.io/rover/), EarthScope's official command-line tool for bulk data retrieval.

## Why model this on ROVER rather than building from scratch

ROVER is EarthScope's recommended tool for large data downloads. It encodes years of operational experience with the FDSN web services, including:

- **EarthScope's rate limits**: max 5 concurrent connections and 10 connections/second. Exceeding these triggers TCP RESETs. ROVER's default of 5 parallel download workers matches this limit exactly. **Note:** These limits are per IP. If all requests go through a CloudFront proxy, all students share the same outbound IP(s), so the 5-connection limit applies to the entire class, not per student. See the concurrency warning in the [download queue](#key-components) section.
- **Day-aligned chunking with resume**: ROVER splits requests into day-length pieces and saves each as a separate file. This is a deliberate design choice — EarthScope's dataselect service is optimized for day-granularity requests, and day-length miniSEED files are the standard archive unit. Critically, this also means interrupted downloads can resume where they left off. ROVER scans its local repository to find which days are already on disk and only requests the gaps. For a browser downloading 1.8 GB over a potentially unreliable connection, this resume capability is essential.
- **Gap detection via the availability service**: Before downloading, ROVER queries `fdsnws/availability` to find what time ranges actually exist, avoiding wasted requests for periods with no data (station outages, maintenance windows, etc.).
- **Retry strategy**: 3 retries per download with configurable timeouts, tuned to EarthScope's service behavior.
- **Verification pass**: After downloading, ROVER does a final check expecting no new data. If data appears, it flags an inconsistency — a safeguard against race conditions with data being added server-side.

Building a download system from scratch would mean rediscovering these constraints through trial and error. By following ROVER's approach, we inherit best practices for being a well-behaved client of EarthScope's services.

## Architecture

### Download flow

```
1. User selects station, channel, and time range
2. Query fdsnws/availability → list of available day-ranges
3. Scan OPFS cache → list of already-downloaded days
4. Compute gaps (available - cached)
5. Download gaps: day-chunked, max 5 concurrent, 3 retries each
6. Write each day's miniSEED to OPFS
7. Update progress UI
```

All EarthScope requests go through a CloudFront CORS proxy, since EarthScope's servers do not support CORS headers. CloudFront caching at the edge helps if multiple students request the same station — subsequent requests are served from cache rather than re-fetching from EarthScope. However, students are likely exploring different stations and time ranges, so cache hits may be rare and most requests will be forwarded to EarthScope (see concurrency warning below).

### OPFS (Origin Private File System) for persistent caching

Downloaded miniSEED files are stored in the browser's Origin Private File System using ROVER's directory convention:

```
/seismic-cache/
  AK/
    FIB/
      BHZ/
        2025/
          001.mseed    (Jan 1)
          002.mseed    (Jan 2)
          ...
          365.mseed    (Dec 31)
```

**Why OPFS over other browser storage:**

| Option | Why not |
|---|---|
| IndexedDB | Not designed for large binary blobs; performance degrades at GB scale |
| Cache API | Designed for HTTP response caching, awkward for structured file hierarchies |
| File System Access API | Requires user to pick a folder and re-grant permission after each session; permission is lost on crash |
| **OPFS** | **Persistent across sessions, no permission prompts, works well from Web Workers, supports the directory structure we need** |

OPFS data survives browser crashes, tab closures, and device restarts. When a student returns to continue a download, the manager scans the OPFS directory to find which days are already cached and only downloads the gaps.

OPFS also enables data reuse across ML runs — if a student wants to run a different model over the same station data, the raw waveforms are already on disk.

### Key components

**Download queue**: A promise-pool limiting concurrency to 5 parallel fetches, matching EarthScope's connection limit. Each fetch targets one day of data via the FDSN dataselect endpoint through the CloudFront proxy.

**⚠️ Proxy concurrency problem:** The 5-connection limit is per IP, and a CloudFront proxy means all students share the same outbound IP(s) to EarthScope. If each student's browser runs 5 concurrent fetches, a class of 25 students could attempt 125 simultaneous connections — all appearing to come from the same CloudFront edge. EarthScope would reject most of these with TCP RESETs. Since students are likely exploring different stations and time ranges, CloudFront caching won't help much. Possible mitigations:
- Reduce per-student concurrency to 1–2 connections and implement server-side request queuing in the proxy.
- Use a Cloud Function proxy instead of or alongside CloudFront — each function invocation gets its own IP, naturally spreading the load.
- Pre-fetch data for the lesson's stations/time ranges before class to warm the cache.

**miniSEED parsing**: Use [seisplotjs](https://crotwell.github.io/seisplotjs/) (JavaScript library for seismological data) to parse miniSEED format. This replaces ROVER's dependency on `mseedindex` (a C program that builds a SQLite index of miniSEED byte offsets). Since we process data day-by-day rather than from large concatenated archives, we don't need byte-offset indexing.

**Progress and resume**: Track download state (total days, completed days, in-progress days) and display to the user. On resume, scan OPFS for existing day files and skip them. This is simpler than ROVER's SQLite-based index since each file represents exactly one day.

**Storage management UI**: Show cached stations, total space used, and allow cleanup of old data. OPFS quota is typically ~60% of available disk space, browser-managed.

### What we take from ROVER vs. what we skip

| ROVER feature | Browser version | Notes |
|---|---|---|
| Day-aligned chunking | Keep | Matches EarthScope's optimization and archive structure |
| 5 concurrent workers | Revisit | Matches EarthScope's per-IP rate limit, but with a proxy all students share this limit — may need to reduce per-student concurrency |
| 3 retries per download | Keep | Same resilience strategy |
| Availability-based gap detection | Keep | Avoids wasted requests for missing data |
| Verification pass | Consider | Could do a lightweight check, but less critical for a cache |
| mseedindex (C program) | Skip for v1 | seisplotjs parses miniSEED directly in JS; see [sub-day resume](#future-optimization-sub-day-resume) for when indexing becomes useful |
| SQLite index | Skip for v1 | OPFS directory structure + file existence is sufficient for day-level resume |
| File system organization | Adapt | Same directory layout, but in OPFS instead of local filesystem |
| ASDF conversion | Skip | Not needed |
| SeedLink streaming | Skip | We're fetching historical data, not real-time |

## Data sizes

Sizes vary by sample rate:

| Period | 50 Hz (BHZ) | 200 Hz (HHZ) |
|---|---|---|
| 1 day | ~5 MB | ~20 MB |
| 1 month | ~150 MB | ~600 MB |
| 1 year | ~1.8 GB | ~7.3 GB |

These sizes are within OPFS capacity on Chromebooks (typically 10+ GB available), though 200 Hz data for a full year may approach the limit.

## Future optimization: sub-day resume

The initial version downloads each day as an atomic unit — a day file is only written to OPFS on successful complete download. This is simple and matches ROVER's approach, but at 200 Hz (~20 MB/day), a single day's download could take 30 seconds to several minutes on slow school networks (1–5 Mbps). If the connection drops mid-download, the entire day must be re-fetched.

A future optimization could add sub-day resume so that a partially downloaded day doesn't need to be re-fetched entirely. Options include:

- **ROVER-style indexing**: Write miniSEED data blocks to the day file as they stream in, and maintain an index of which time ranges within the file are complete (using IndexedDB or a metadata file alongside the day file in OPFS). On resume, query the index to find intra-day gaps and request only those from EarthScope. This is the approach ROVER uses — its mseedindex tool and SQLite database serve exactly this purpose. We'd implement the same concept in JS using seisplotjs to parse the miniSEED blocks and record their time coverage.
- **Range-based resume**: Track bytes downloaded per day file, use `Range: bytes=N-` header to resume. Simpler than indexing but only handles "got the first N bytes, need the rest" — can't fill arbitrary gaps within a day.
- **Sub-day chunking**: Split each day into smaller time-based requests (e.g., hourly). Simpler resume (each chunk is atomic) but increases the number of requests and files.

This optimization should be considered after the first version is working and we have real-world data on how often downloads are interrupted.

## EarthScope service endpoints

| Service | URL | Purpose |
|---|---|---|
| Availability | `https://service.earthscope.org/fdsnws/availability/1/query` | Check what time ranges exist for a station/channel |
| Dataselect | `https://service.earthscope.org/fdsnws/dataselect/1/query` | Download miniSEED waveform data |

Both need to be proxied through CloudFront for browser access (no CORS support from EarthScope).

Example dataselect request for one day:
```
GET /fdsnws/dataselect/1/query?network=AK&station=FIB&location=--&channel=BHZ&starttime=2025-01-01T00:00:00&endtime=2025-01-02T00:00:00
```

## Estimated implementation effort

| Component | Effort |
|---|---|
| CloudFront CORS proxy configuration | Small |
| FDSN availability + dataselect fetch wrapper | Small |
| Day-chunking + gap detection | Small |
| Download queue (5 concurrent, retries) | Small |
| OPFS cache layer (write/read/scan) | Medium |
| Resume logic (scan for existing days, skip) | Small |
| Progress UI | Small |
| Storage management UI (cached stations, cleanup) | Small |
| miniSEED parsing (seisplotjs integration) | Small (library exists) |
| Integration with ML pipeline | Medium |
| **Total** | **~3-4 days** |
