# Update downloads only raw data needed for missing envelopes/events

## Problem

In the seismic admin interface, "Update station" / "Update all stations" begins by
downloading *all* missing raw days in the selected range into OPFS, then generates
missing envelopes and events. Raw data should only be fetched for days that actually
need work: days missing envelopes in S3, and days uncovered by the selected models'
event databases. The "Download missing raw data" buttons keep their full-range
behavior.

## Background

`updateSingleStation` (src/seismic-admin/seismic-admin-store.ts) runs three steps:

1. Full-range raw download (feeds step 2).
2. `processEnvelopeCoverage` — reads OPFS day files for days not fully covered in
   S3; days with no raw file are skipped.
3. `processUncoveredRanges` per model — already downloads only its uncovered spans
   via `SeismicDownloadService`.

Step 3 already behaves as desired; step 1 exists only to feed step 2.

## Design

### `processEnvelopeCoverage` (src/models/stores/seismic/seismic-envelope-processor.ts)

Becomes self-sufficient, mirroring `processUncoveredRanges`:

- New options: `proxy?: boolean` and a `downloadService?` test seam
  (`Pick<SeismicDownloadService, "ensureRange" | "nextReadyDay" | "readDay" |
  "cancel" | "emptyDays" | "erroredDays" | "bytesForDay">`). The `cache` seam goes
  away — raw bytes come through `downloadService.readDay`.
- Flow: list tiles → `missingEnvelopeDaySpans` → for each span, `ensureRange` over
  just that span and drain `nextReadyDay`, processing each day through the existing
  pipeline as it lands. Already-cached days still flow through (the worker reports
  them with 0 bytes), so nothing re-downloads.
- Out-of-order day arrival is fine: pipeline state is fresh per day and uploads
  union-merge (the existing midnight-straddle comment covers this).
- Empty/errored days from the service count as `skippedDays` (same accounting
  pattern as the coverage processor); errored days aren't marked covered, so a
  later run retries them.
- New optional `onDayDownloaded?: (day: number, bytes: number) => void` so the
  admin raw-data timeline fills in live for days fetched during update.
- `finally { downloadService.cancel(); }`

### `processUncoveredRanges` (src/models/stores/seismic/seismic-coverage-processor.ts)

- Gains the same optional `onDayDownloaded?: (day, bytes) => void`, fired as each
  day lands from the download service (before the model runs on it).
  `CoverageDownloadService` adds `"bytesForDay"` to its pick.
- Wave Runner's call site is unaffected — the callback is optional.

### `updateSingleStation` (src/seismic-admin/seismic-admin-store.ts)

- Delete step 1 (`await this.download(stationData, prefix)`).
- Pass `proxy: true` to the envelope run and wire `onDayDownloaded` →
  `markDayCached` for both the envelope step and each model's events step.
  `markDayCached` already guards against repeated days, so a day seen in both
  steps won't double-count.
- After envelopes + events finish, `await this.loadStats(stationData)` once to
  reconcile raw stats (events may now download days too).

### Unchanged

- "Download missing raw data" buttons (`downloadStation` / `downloadAllSelected`)
  still download the full range.
- Feedback messages keep their current shape; the "Downloading data for…" phase
  simply disappears from updates.

## Testing

- Envelope processor tests swap the `cache` seam for a fake download service
  (precedent in seismic-coverage-processor.test.ts).
- Coverage processor tests cover `onDayDownloaded`.
- Admin store tests: update-flow tests no longer expect a full-range download; add
  coverage that update only fetches missing-envelope days and that stats reconcile
  afterward.
