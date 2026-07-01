# Seismic Bulk Downloader — Design

**Date:** 2026-07-01
**Status:** Approved, ready for implementation planning
**Related:** [browser-seismic-downloader.md](../seismic/browser-seismic-downloader.md), [envelope-tile-cache-design.md](../seismic/envelope-tile-cache-design.md)

## Overview

A ROVER-style browser-based bulk downloader for EarthScope seismic waveform data. It
fetches raw miniSEED day-chunks into the Origin Private File System (OPFS) so ML runs
can operate over large time ranges without re-fetching, and so downloads survive
interruptions via resume. This is the bulk path described in
[browser-seismic-downloader.md](../seismic/browser-seismic-downloader.md) — **not** the
timeline raw-fetch path (that already exists in `SeismicQueryService` with in-memory
2-hour chunks and stays separate).

**In scope:** the full downloader minus UI — availability-based gap detection,
day-chunking, concurrent download queue, retries, OPFS cache, resume, and wiring into
the wave-runner ML pipeline as the concrete driver.

**Out of scope for v1:** Progress UI, Storage-management UI, timeline read-through of
the OPFS store, sub-day resume, and parse-based verification.

## Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Execution context | **Web Worker** | GB-scale downloads must not jank the main thread; OPFS sync access handles are worker-only. |
| Parse vs store | **Store raw bytes only** | Downloader persists miniSEED unparsed; parsing is left to consumers (wave-runner, envelope pipeline). No seisplotjs in the download path. |
| Concurrency | **Configurable, default 5** | Matches EarthScope/ROVER per-IP limit. Tunable down once proxy-side rate limiting / per-invocation IPs exist (see proxy concurrency warning in the source doc). |
| OPFS layout | **Station-first (Option A)** | `/seismic-cache/{network}_{station}/{channel}/{year}/{doy}.mseed`; matches envelope-cache/Firestore conventions; trivial per-station scan and cleanup. |
| Driver | **Wire into ML pipeline now** | wave-runner's day loop is the concrete consumer; resolves its existing raw-access TODO. |
| Coordination | **Per-day streaming prefetch** | Worker emits a "day written" event per chunk; wave-runner runs the model on each day as it lands, overlapping download and inference without shipping large buffers over `postMessage`. |
| Gap detection | **Availability-based** | Query `fdsnws/availability` to download only days that exist; replaces the wave-runner's current 404/"no data" catch heuristic. |
| Retries | **3 per day-chunk** | Same resilience strategy as ROVER. |
| Resume | **OPFS scan** | Cached days are derived by scanning OPFS; no separate index needed at day granularity. |
| Verification pass | **Skipped for v1** | It required parsing, which we deliberately dropped. |

## Module layout

The core orchestration is a **pure, dependency-injected module**; the Worker and the
MobX service are thin shells around it. This keeps OPFS / Worker / seisplotjs concerns
at the edges and makes the orchestration testable in plain Node.

- `shared/seismic/earthscope-client.ts` — **add** `fetchAvailability(...)` (today only
  dataselect + station metadata exist).
- `shared/seismic/opfs-seismic-cache.ts` — **new** OPFS read/write/scan, usable from
  worker *and* main thread.
- `shared/seismic/seismic-downloader.ts` — **new** pure orchestration with injected
  `fetchRaw`, `fetchAvailability`, and a `cache` interface.
- `src/workers/seismic-download-worker.ts` — **new** thin Worker message shell.
- `src/models/stores/seismic-download-service.ts` — **new** MobX client + observable
  progress/resume state.
- `src/plugins/wave-runner/models/wave-runner-content.ts` — **modify** the `runModel`
  loop.

## OPFS cache layer

Layout: `/seismic-cache/{network}_{station}/{channel}/{year}/{doy}.mseed`.
Day identity = **UTC calendar day** (matches dataselect's day-alignment and the
year/doy path). API:

- `writeDayChunk(station, channel, day, bytes)` — worker-side, sync access handle.
- `readDayChunk(station, channel, day) → ArrayBuffer | null` — async, works on the
  main thread (OPFS is shared same-origin).
- `scanCachedDays(station, channel, range) → Set<dayIndex>` — powers resume.
- `deleteStation(...)` — for the later storage-management UI.

## Download worker + orchestration

Worker receives `{ download, station, channel, range, concurrency }` / `{ cancel }`.

Orchestration flow:
1. `fetchAvailability` → list of available days.
2. `scanCachedDays` → already-cached days.
3. **gaps = available − cached**.
4. Promise-pool (default 5, configurable) with **3 retries** per day → write raw bytes
   to OPFS via the cache layer.

Emits: `{ dayWritten, day }`, `{ dayEmpty, day }` (availability gap),
`{ progress, completed, total }`, `{ done }`, `{ error }`.

No parsing, no seisplotjs in this path.

## Main-thread service + wave-runner wiring

`SeismicDownloadService` (MobX) spawns the worker, exposes observable state
(total / completed / in-progress / empty / errored days) for a future UI, and offers
`ensureRange(...)` yielding per-day "ready" signals plus a completion promise.
Cancellation aborts the worker.

wave-runner's `runModel` loop changes to:
1. Call `ensureRange(station, channel, { start, end })`.
2. Per `dayWritten` event → `readDayChunk` from OPFS → parse miniSEED → `processChunk`
   → update progress.
3. `dayEmpty` days are skipped (replaces the current 404/"no data" catch and resolves
   the raw-access TODO).

Download of days *d+1…d+5* continues while the model runs on day *d*.

## Data flow

```
wave-runner.runModel(range)
  └─> downloadService.ensureRange(station, channel, range)
        └─> worker: availability → gaps → concurrent fetch (5, retry×3) → OPFS write
              └─(per day)─> postMessage { dayWritten: d }   (or { dayEmpty: d })
  main thread: on dayWritten(d) → readDayChunk(d) → parse → processChunk → progress
  (download of day d+1..d+5 continues while the model runs on day d)
```

## Error handling

- **Per-day fetch:** 3 retries, then mark the day errored and continue others; surfaced
  in observable state.
- **Availability in mock/local mode:** EarthScope's availability service isn't mocked.
  In non-proxy mode, `fetchAvailability` falls back to "assume all requested days
  available" (or derives from `MOCK_FILES` coverage) so dev/test keeps working. In
  proxy mode, an availability failure errors the run (gaps can't be computed blind).
- **No-data days:** availability gaps are not errors — emitted as `dayEmpty`, skipped.
- **Worker crash / cancel:** service transitions to idle/error; the wave-runner run
  aborts cleanly.
- **OPFS quota exceeded:** caught on write, surfaced as error state (cleanup is the
  later storage-management UI's responsibility).

## Testing

- **`seismic-downloader.ts` (pure):** unit-test gap computation, queue concurrency cap,
  and retry behavior with injected fake `fetchRaw` / `fetchAvailability` / `cache` — no
  real Worker or OPFS needed.
- **OPFS cache layer:** path math + scan/gap logic against an in-memory OPFS fake
  (jsdom has no OPFS).
- **`fetchAvailability`:** response parsing + mock fallback.
- **wave-runner:** mock the download service; assert days are read from cache, the
  model runs, and empty days are skipped.

## Notes / future work

- Sub-day resume, timeline read-through of the OPFS store, the verification pass, and
  both UI surfaces are explicitly deferred.
- The timeline's raw path keeps its intentional 2-hour in-memory chunking and stays
  independent of this store.
