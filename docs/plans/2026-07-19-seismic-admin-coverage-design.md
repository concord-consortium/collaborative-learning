# Seismic Admin Event Coverage — Design

Step 2 of the seismic event database work ([event-database-design.md](../seismic/event-database-design.md), implemented in step 1): integrate shared event coverage into the seismic admin interface (`src/seismic-admin/`).

## Goals

- **Visualize coverage**: per selected station and per selected model, show which parts of the date range have been model-processed (from the Firestore coverage bitmaps).
- **Show event counts**: how many events are stored per station × model in the range.
- **Update**: a third button (beside "Download missing raw data" and "Delete raw data", in both per-station and all-selected sections) that downloads all missing raw data and then generates events for time ranges lacking coverage, for every selected model.
- **Model selection**: header checkboxes mirroring station selection; determines which models' coverage/events are displayed and which the Update button processes.

Out of scope: clearing coverage, deleting events, portal-authenticated admin access.

## Architecture

### Directory reorganization: `src/models/stores/seismic/`

The seismic services move out of the flat `stores/` directory into `src/models/stores/seismic/`:

- `seismic-download-service.ts` (+ test)
- `seismic-download-worker-runner.ts`
- `seismic-query-service.ts` (+ test)
- `seismic-event-service.ts` (+ test)
- **new:** `seismic-coverage-processor.ts` (+ test)

Known importers to update: `stores.ts`, `wave-runner-content.ts` (+ test), `seismic-admin-store.ts`, plus sibling imports among the moved files.

### Shared coverage processor (refactor of Wave Runner)

`seismic-coverage-processor.ts` extracts the span/download/run/persist loop from `wave-runner-content.ts`'s `runModel`:

- **Input**: `stationData`, model `metadata` (ModelMetadata), `range` (TimeRange, Unix seconds), optional pre-resolved `uncovered` ranges, callbacks `onEvents(events)` / `onProgress(processed, total)`, optional injected `SeismicDownloadService` (test seam).
- **Pipeline** (semantics identical to step 1, unchanged): `getUncoveredRanges` (skipped when `uncovered` is provided) → `uncoveredDaySpans` → per-span `ensureRange` with the downloader's **inclusive** end-day convention (`endSec = span.endDay * SECONDS_PER_DAY`) → drain to `DONE` → per day: miniSEED parse → `SeismicModelRunner.processChunk` → best-effort `writeEvents`-then-`markCovered` (`saveDayResults`) → after each span, empty days marked covered, errored days not.
- Owns the `SeismicModelRunner` lifecycle (load/dispose). Exports the shared detection threshold constant (0.7).
- **Returns** `{processed, skipped}` day counts.

`runModel` in `wave-runner-content.ts` becomes a thin MST wrapper: validation, prior-event loading with the offline fallback (it resolves `uncovered` itself — falling back to the full range on Firestore failure — and passes it in), dataset population, progress state. The admin does NOT use the fallback: its purpose is writing to the shared DB, so processor-level Firestore errors propagate.

All 38 existing wave-runner tests stay green through the refactor; the fake download-service/runner/event-service machinery in `wave-runner-content.test.ts` moves to a shared test helper reused by the processor tests.

## Admin integration

### Firebase bootstrap

Admin entry point calls `initializeApp()` ([firebase-config.ts](../../src/lib/firebase-config.ts) — brings `firebaseEnv`/`firestore`/`auth` emulator URL params for free) and `firebase.auth().signInAnonymously()` (the step-1 Decision: anonymous users may read and contribute). An `authReady` flag lands in the store; OPFS features keep working pre-auth; coverage rows show a pending/error state until signed in.

### Model selection

- Model list from the unit config's wave-runner `models` setting (`{label, metadataUrl}` entries), loaded alongside the station catalog in `load-catalog.ts` (respects `curriculumBranch`/`authoringBranch`).
- Header checkboxes styled/behaving like station selection; persisted in the same localStorage filters (`admin-persistence.ts`).
- Metadata JSONs for selected models fetched and cached up front; `metadata.id` is the Firestore `{model}` path key.

### Coverage display

In each station section, under "Local Raw Data": **one row per selected model**:

- Header: `{model label} · N events · X/Y days covered`.
- Day bar reusing the RawTimeline pattern with **three states**: fully covered / partially covered / uncovered, derived from `getUncoveredRanges` gaps by a pure day-classification helper (a day is fully covered if no gap intersects it, uncovered if a gap spans the whole day, else partial).
- Event counts via `loadEvents` over the range, counted client-side (acceptable at admin scale; a year-long range across many stations costs one read per 500 events — deliberate admin action, noted).

The "All selected stations" section shows per-model aggregate text (total events, days covered across stations); no aggregate bar.

### Update button

Per station: (1) run the existing download-missing-raw flow for the whole range; (2) for each selected model, run the coverage processor over the range (only uncovered days are processed; already-downloaded days hit the OPFS cache via `ensureRange`). All-selected: stations sequentially (shared-proxy limit). Feedback line reports station/model/day progress; coverage rows refresh after each model. Disabled when unauthenticated or no models are selected. Update never clears coverage.

### Store changes (`SeismicAdminStore`)

- `models: Map<metadataUrl, ModelListEntry>`, `selectedModels: Set<metadataUrl>` (persisted), model metadata cache.
- Coverage stats per (stationKey, modelId): `{dayStates, eventCount, state: pending|loaded|error}`; loaded on `refresh()`, `setRange()`, and model-selection changes.
- `authReady` flag; `updateStation(key)` / `updateAllSelected()` actions.
- New injectable deps in `SeismicAdminDeps` for the event service and processor (test seams, matching the existing `downloadStation` pattern).

## Error handling

- Firestore/auth failures during display → per-row "coverage unavailable" state + feedback message.
- Update failures for one station/model → report in feedback, continue with the rest, summary at the end.
- Deleting raw data never touches coverage or events.

## Testing

- **Processor**: unit tests using the shared fake machinery (download service, model runner, event service) — span bounds, persist ordering, empty/errored days, injected-`uncovered` path, error propagation.
- **Wave Runner**: existing suite green through the refactor.
- **Admin store**: injected-deps tests for model selection persistence, coverage stat loading, update sequencing and failure continuation.
- **Components**: model-selection header, coverage rows (three states), Update button enable/disable.
