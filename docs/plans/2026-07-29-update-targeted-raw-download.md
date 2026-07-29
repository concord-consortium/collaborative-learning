# Update-Targeted Raw Download Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Seismic admin "Update station" / "Update all stations" downloads only the raw days needed to fill missing envelopes and events, while the "Download missing raw data" buttons keep downloading the full range.

**Architecture:** `processEnvelopeCoverage` becomes self-sufficient like `processUncoveredRanges`: it runs a `SeismicDownloadService` over just the missing-envelope day spans instead of reading a pre-populated OPFS cache. `updateSingleStation` drops its full-range download step, passes `proxy: true`, and wires a new `onDayDownloaded` callback (on both processors) to `markDayCached` so the raw-data timeline fills live; a final `loadStats` reconciles. Design: `docs/plans/2026-07-29-update-targeted-raw-download-design.md`.

**Tech Stack:** TypeScript, MobX, Jest. Run Jest with `--no-watchman` always.

**Verification commands:**
- Single test file: `npm test -- --no-watchman src/models/stores/seismic/seismic-envelope-processor.test.ts`
- Types: `npm run check:types`
- Lint (before committing): `npm run lint:build`

**Key background for the implementer:**
- The downloader emits `dayWritten` for *already-cached* days too (no `bytes` field — see `shared/seismic/seismic-downloader.ts:100-103`), so days already in OPFS still flow through `nextReadyDay()` and nothing re-downloads. `bytesForDay(day)` returns 0 for them.
- `SeismicDownloadService.ensureRange` resets the service; each span must be fully drained before the next `ensureRange`. `endSec` is inclusive: the day containing it is downloaded.
- Days can arrive out of order. The envelope pipeline uses fresh state per day and force-flushes every day; S3 uploads union-merge, so order doesn't matter.
- `markDayCached` (admin store) ignores a day already in `cachedDays`, so a day reported by both the envelope and events steps won't double-count.

---

### Task 1: Shared `DayDownloadService` type + `bytesForDay` on the test fake

Pure refactor (type-level); no new behavior, so no new failing test — existing tests and `check:types` are the safety net.

**Files:**
- Modify: `src/models/stores/seismic/seismic-download-service.ts`
- Modify: `src/models/stores/seismic/seismic-coverage-processor.ts`
- Modify: `src/models/stores/seismic/seismic-coverage-test-fakes.ts`
- Modify: `src/models/stores/seismic/seismic-coverage-processor.test.ts`

**Step 1: Add the shared type to `seismic-download-service.ts`**

After the `ReadyDay` type (line 7), add:

```ts
/** The subset of SeismicDownloadService the coverage/envelope processors use;
 *  tests inject fakes against it. */
export type DayDownloadService = Pick<SeismicDownloadService,
  "ensureRange" | "nextReadyDay" | "readDay" | "cancel" | "emptyDays" | "erroredDays" | "bytesForDay">;
```

(Place it after the class if forward reference bothers you — types may reference the class declared later in the same module, so either position compiles. Put it right below the `ReadyDay` line to keep the exports together; TS hoists type references, so this compiles.)

**Step 2: Use it in `seismic-coverage-processor.ts`**

Replace lines 12–14:

```ts
/** The subset of SeismicDownloadService the processor uses; tests inject fakes against it. */
export type CoverageDownloadService = Pick<SeismicDownloadService,
  "ensureRange" | "nextReadyDay" | "readDay" | "cancel" | "emptyDays" | "erroredDays">;
```

with nothing (delete), change the `downloadService?: CoverageDownloadService;` option to `downloadService?: DayDownloadService;`, and change the import on line 7 to:

```ts
import { DayDownloadService, DONE, SeismicDownloadService } from "./seismic-download-service";
```

**Step 3: Update `seismic-coverage-test-fakes.ts`**

- Change the type-only import (and its comment, which referenced the processor module) to:

```ts
import { DONE } from "./seismic-download-service";
// Type-only import: erased at runtime, so requireActual-ing this module inside a
// jest.mock factory never loads anything mid-mock.
import type { DayDownloadService } from "./seismic-download-service";
```

(Note `DONE` is already imported from there; merge into one value import plus the type import, or `import { DONE, type DayDownloadService }`.)

- In `makeFakeDownloadService`, add a `bytesForDay` mock and update the `satisfies`:

```ts
    readDay: jest.fn(async () => new ArrayBuffer(8)),
    bytesForDay: jest.fn((_day: number) => 0),
    cancel: jest.fn(),
    erroredDays: [] as number[],
    emptyDays: [] as number[],
  } satisfies DayDownloadService;
```

**Step 4: Fix any remaining `CoverageDownloadService` references**

Run: `grep -rn "CoverageDownloadService" src shared` — update or delete each hit (expected: none besides the ones above).

**Step 5: Verify**

Run: `npm run check:types`
Expected: clean.

Run: `npm test -- --no-watchman src/models/stores/seismic/seismic-coverage-processor.test.ts`
Expected: all PASS.

**Step 6: Commit**

```bash
git add src/models/stores/seismic
git commit -m "Extract shared DayDownloadService type; add bytesForDay to the fake."
```

---

### Task 2: `onDayDownloaded` in `processUncoveredRanges`

**Files:**
- Modify: `src/models/stores/seismic/seismic-coverage-processor.ts`
- Test: `src/models/stores/seismic/seismic-coverage-processor.test.ts`

**Step 1: Write the failing test**

Add to the `processUncoveredRanges` describe block:

```ts
  it("reports each landed day through onDayDownloaded with its byte count", async () => {
    const fakeService = makeFakeDownloadService([feb1Day, feb1Day + 1]);
    fakeService.bytesForDay.mockImplementation((d: number) => (d === feb1Day ? 500 : 0));
    const onDayDownloaded = jest.fn();
    await processUncoveredRanges({
      ...makeOptions(fakeService),
      uncovered: [threeDayRange],
      onDayDownloaded,
    });

    expect(onDayDownloaded.mock.calls).toEqual([[feb1Day, 500], [feb1Day + 1, 0]]);
  });
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --no-watchman src/models/stores/seismic/seismic-coverage-processor.test.ts -t "onDayDownloaded"`
Expected: FAIL — `onDayDownloaded` never called (option doesn't exist yet).

**Step 3: Implement**

In `ProcessCoverageOptions`, after `onDayCovered`:

```ts
  /** Fires as each day's raw data lands in OPFS; bytes is 0 for already-cached days. */
  onDayDownloaded?: (day: number, bytes: number) => void;
```

Destructure it in `processUncoveredRanges` (add to the existing destructuring of `options`), and in the drain loop fire it as each day lands:

```ts
      for (;;) {
        const day = await downloadService.nextReadyDay();
        if (day === DONE) break;
        onDayDownloaded?.(day, downloadService.bytesForDay(day));
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- --no-watchman src/models/stores/seismic/seismic-coverage-processor.test.ts`
Expected: all PASS.

**Step 5: Commit**

```bash
git add src/models/stores/seismic/seismic-coverage-processor.ts src/models/stores/seismic/seismic-coverage-processor.test.ts
git commit -m "Report downloaded days from processUncoveredRanges via onDayDownloaded."
```

---

### Task 3: `processEnvelopeCoverage` downloads its own raw data

The seam swap (OPFS `cache` → download service) breaks the whole test file at once, so: rewrite the tests to the new contract first, watch them fail, then implement.

**Files:**
- Modify: `src/models/stores/seismic/seismic-envelope-processor.test.ts`
- Modify: `src/models/stores/seismic/seismic-envelope-processor.ts`

**Step 1: Rewrite the tests against the download-service contract**

In `seismic-envelope-processor.test.ts`:

a. Add imports:

```ts
import { makeFakeDownloadService } from "./seismic-coverage-test-fakes";
```

b. Replace the `cache` line in `makeOptions` with a fake download service serving the test day:

```ts
  function makeOptions() {
    return {
      stationData: station,
      range: oneDayRange,
      uploadTile: jest.fn(async (level: number, tileIndex: number, tile: EnvelopeTileData) => {}),
      listTiles: jest.fn(async () => new Set<number>()),
      fetchMetadata: jest.fn(async () => makeMetadata()),
      downloadService: makeFakeDownloadService([day]),
      parseDay: jest.fn((): RawSegment[] => []),
    };
  }
```

c. **"does nothing when the range is fully covered"** — replace the `cache` assertion:

```ts
    expect(options.fetchMetadata).not.toHaveBeenCalled();
    expect(options.downloadService.ensureRange).not.toHaveBeenCalled();
    expect(options.uploadTile).not.toHaveBeenCalled();
```

d. **"skips a day whose raw file is missing from the cache"** — rename to `"skips a day whose raw file cannot be read back"` and replace the cache mock line with:

```ts
    options.downloadService.readDay.mockResolvedValue(null);
```

(rest of the test unchanged).

e. **"uploads a day-boundary L2 tile once per adjacent day..."** — the two-day range needs both days served; at the top of the test replace `const options = makeOptions();` with:

```ts
    const options = { ...makeOptions(), downloadService: makeFakeDownloadService([day, day + 1]) };
```

f. **"rejects before reading the cache when channel metadata is missing"** and **"...unknown instrument code"** — rename "reading the cache" to "starting a download" and replace the `cache.readDayChunk` assertions with:

```ts
    expect(options.downloadService.ensureRange).not.toHaveBeenCalled();
```

g. **"stops uploading and rejects when uploadTile rejects"** — add a cancel assertion at the end:

```ts
    expect(options.downloadService.cancel).toHaveBeenCalled();
```

h. Add new tests:

```ts
  it("downloads each missing span separately with exact inclusive bounds, forwarding proxy", async () => {
    const options = makeOptions();
    const threeDayRange: TimeRange = { start: dayStart, end: dayStart + 3 * SECONDS_PER_DAY };
    // Middle day fully covered; days 1 and 3 remain missing, forming two one-day spans.
    const covered = new Set(getTileIndicesForViewport(
      dayStart + SECONDS_PER_DAY, dayStart + 2 * SECONDS_PER_DAY, FINEST_LEVEL));
    options.listTiles.mockResolvedValue(covered);

    await processEnvelopeCoverage({ ...options, range: threeDayRange, proxy: true });

    const { ensureRange } = options.downloadService;
    expect(ensureRange).toHaveBeenCalledTimes(2);
    expect(ensureRange).toHaveBeenNthCalledWith(1, expect.objectContaining({
      network: "AK", station: "K204", channel: "HNZ",
      startSec: dayStart, endSec: dayStart, proxy: true,
    }));
    expect(ensureRange).toHaveBeenNthCalledWith(2, expect.objectContaining({
      startSec: dayStart + 2 * SECONDS_PER_DAY, endSec: dayStart + 2 * SECONDS_PER_DAY, proxy: true,
    }));
  });

  it("counts empty and errored days as skipped without parsing them", async () => {
    const options = { ...makeOptions(), downloadService: makeFakeDownloadService([]) };
    options.range = { start: dayStart, end: dayStart + 2 * SECONDS_PER_DAY };
    options.downloadService.emptyDays.push(day);
    options.downloadService.erroredDays.push(day + 1);
    const onProgress = jest.fn();

    const result = await processEnvelopeCoverage({ ...options, onProgress });

    expect(result).toEqual({ uploadedTiles: 0, processedDays: 0, skippedDays: 2, totalDays: 2 });
    expect(options.parseDay).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenLastCalledWith(2, 2);
  });

  it("reports each landed day through onDayDownloaded with its byte count", async () => {
    const options = makeOptions();
    options.downloadService.bytesForDay.mockReturnValue(123);
    const onDayDownloaded = jest.fn();

    await processEnvelopeCoverage({ ...options, onDayDownloaded });

    expect(onDayDownloaded.mock.calls).toEqual([[day, 123]]);
  });

  it("cancels the download service when processing completes", async () => {
    const options = makeOptions();
    await processEnvelopeCoverage(options);
    expect(options.downloadService.cancel).toHaveBeenCalled();
  });
```

Note: the fake's `emptyDays`/`erroredDays` persist across `ensureRange` calls (unlike the real service, which resets). Each new test above uses a single span, so the distinction doesn't bite; don't write multi-span tests that preload `emptyDays`.

**Step 2: Run tests to verify they fail**

Run: `npm test -- --no-watchman src/models/stores/seismic/seismic-envelope-processor.test.ts`
Expected: FAIL — `cache` option gone from tests but required by implementation; type errors for `downloadService`/`proxy`/`onDayDownloaded` options.

**Step 3: Implement**

Rewrite `src/models/stores/seismic/seismic-envelope-processor.ts`:

Imports — remove the OPFS cache import, add:

```ts
import { SECONDS_PER_DAY } from "../../../../shared/seismic/seismic-day";
import { DayDownloadService, DONE, SeismicDownloadService } from "./seismic-download-service";
```

Options — replace the `cache` seam:

```ts
export interface ProcessEnvelopeOptions {
  stationData: StationData;
  /** Unix seconds; caller guarantees day-aligned bounds. */
  range: TimeRange;
  uploadTile: (level: number, tileIndex: number, tile: EnvelopeTileData) => Promise<void>;
  onProgress?: (done: number, total: number) => void;
  /** Fires after each successful upload; finest-level events drive the live timeline fill. */
  onTileUploaded?: (level: number, tileIndex: number) => void;
  /** Fires as each missing day's raw data lands in OPFS; bytes is 0 for already-cached days. */
  onDayDownloaded?: (day: number, bytes: number) => void;
  /** Forwarded to the download service's raw-data fetches. */
  proxy?: boolean;
  /** Test seams; production defaults construct real ones. */
  downloadService?: DayDownloadService;
  listTiles?: (s: StationData) => Promise<Set<number>>;
  fetchMetadata?: (s: StationId) => Promise<ChannelMetadata[]>;
  parseDay?: (buffer: ArrayBuffer) => RawSegment[];
}
```

`defaultParseDay` is unchanged. Replace the body of `processEnvelopeCoverage` (docstring: change "streaming OPFS raw data" to "downloading each missing day's raw data"; keep the generate-envelopes TODO):

```ts
export async function processEnvelopeCoverage(options: ProcessEnvelopeOptions):
  Promise<{ uploadedTiles: number; processedDays: number; skippedDays: number; totalDays: number }> {
  const { stationData, range, uploadTile, onProgress, onTileUploaded, onDayDownloaded, proxy } = options;

  let uploadedTiles = 0;
  let processedDays = 0;
  let skippedDays = 0;

  const tiles = await (options.listTiles ?? listEnvelopeTileIndices)(stationData);
  const spans = missingEnvelopeDaySpans(tiles, range);
  const totalDays = spans.reduce((sum, s) => sum + (s.endDay - s.startDay + 1), 0);

  onProgress?.(0, totalDays);
  // Fully covered: nothing to do — skip the metadata fetch and download-service creation.
  if (!spans.length) return { uploadedTiles, processedDays, skippedDays, totalDays };

  const metadata = await (options.fetchMetadata ?? fetchStationMetadata)(stationData);
  const parseDay = options.parseDay ?? defaultParseDay;

  // instrumentCode is identical across all of a channel's metadata epochs.
  const channelMetadata = getMetadataForChannel(metadata, stationData, range.start);
  if (!channelMetadata) throw new Error(`No metadata for channel ${stationData.channel}`);
  const rangeMax = AMPLITUDE_RANGES[channelMetadata.instrumentCode];
  if (!rangeMax) throw new Error(`Unknown instrument code "${channelMetadata.instrumentCode}"`);

  // flushTiles takes a sync callback, so completed tiles queue here and upload after.
  const pending: { level: number; tileIndex: number; tile: EnvelopeTileData }[] = [];
  const queueTile = (level: number, tileIndex: number, tile: EnvelopeTileData) =>
    pending.push({ level, tileIndex, tile });
  const uploadPending = async () => {
    for (const { level, tileIndex, tile } of pending.splice(0)) {
      await uploadTile(level, tileIndex, tile);
      uploadedTiles++;
      onTileUploaded?.(level, tileIndex);
    }
  };

  // Download just the missing spans, processing each day as it lands. Days may arrive
  // out of order; state is fresh per day and uploads union-merge, so that's fine.
  const downloadService = options.downloadService ?? new SeismicDownloadService();
  try {
    const updateProgress = () => {
      onProgress?.(processedDays + skippedDays
        + downloadService.erroredDays.length + downloadService.emptyDays.length, totalDays);
    };

    for (const span of spans) {
      // ensureRange resets the service, so each span is fully drained before the next starts.
      // endSec is inclusive: the day containing it is downloaded (matches the downloader's daysInRange).
      downloadService.ensureRange({
        ...stationData, startSec: span.startDay * SECONDS_PER_DAY, endSec: span.endDay * SECONDS_PER_DAY, proxy
      });

      for (;;) {
        const day = await downloadService.nextReadyDay();
        if (day === DONE) break;
        onDayDownloaded?.(day, downloadService.bytesForDay(day));

        const buffer = await downloadService.readDay(day);
        if (!buffer) {
          // Written but unreadable: give up on the day this run rather than stall.
          skippedDays++;
          updateProgress();
          continue;
        }
        // Fresh state per day: the forced flush below fully drains it.
        const state = createPipelineState();
        const segments = parseDay(buffer).sort((a, b) => a.startTime - b.startTime);
        for (const seg of segments) {
          // Only scale is epoch-dependent, so it alone is re-resolved per segment.
          const segMetadata = getMetadataForChannel(metadata, stationData, seg.startTime);
          if (!segMetadata) throw new Error(`No metadata for channel ${stationData.channel}`);
          const { scale } = segMetadata;
          const physical = new Float64Array(seg.samples.length);
          for (let i = 0; i < seg.samples.length; i++) physical[i] = seg.samples[i] / scale;
          const { mins, maxs, times } =
            computeEnvelopesFromRaw(physical, seg.sampleRate, LEVEL_SPACINGS[FINEST_LEVEL], seg.startTime);
          for (let i = 0; i < mins.length; i++) {
            processL2Point(state, times[i], quantize(mins[i], rangeMax), quantize(maxs[i], rangeMax));
          }
        }

        // Force-flush every tile each day, including open L0/L1 tiles. The S3 upload path
        // union-merges, so re-uploading the same still-open tile day after day converges to
        // the right values. This keeps already-processed days' L0/L1 contributions from being
        // stranded in memory when a later upload fails or the tab closes, and it lets a midnight-straddling
        // L2 window get both adjacent days' contributions merged in S3 instead of last-write-wins.
        flushTiles(state, queueTile, true);
        await uploadPending();
        processedDays++;
        updateProgress();
      }

      // Empty days (no data at EarthScope) can never get envelopes; errored days are NOT
      // counted as processed, so a later run retries them. Report this span's via the live
      // service arrays first, then fold them into skippedDays so they survive the next
      // span's ensureRange reset.
      updateProgress();
      skippedDays += downloadService.erroredDays.length + downloadService.emptyDays.length;
    }
  } finally {
    downloadService.cancel();
  }

  return { uploadedTiles, processedDays, skippedDays, totalDays };
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- --no-watchman src/models/stores/seismic/seismic-envelope-processor.test.ts`
Expected: all PASS.

Run: `npm run check:types`
Expected: clean (the admin store still compiles — it doesn't pass `cache`).

**Step 5: Commit**

```bash
git add src/models/stores/seismic/seismic-envelope-processor.ts src/models/stores/seismic/seismic-envelope-processor.test.ts
git commit -m "Download missing raw days inside processEnvelopeCoverage."
```

---

### Task 4: `updateSingleStation` stops downloading the whole range

**Files:**
- Modify: `src/seismic-admin/seismic-admin-store.ts` (`updateSingleStation`, ~line 572)
- Test: `src/seismic-admin/seismic-admin-store.test.ts`

**Step 1: Update the existing tests that encode the old flow**

In `seismic-admin-store.test.ts`:

a. `"updateStation downloads the whole range, runs envelopes, then processes each selected model"` (~line 540) — rename and drop `"download"`:

```ts
  it("updateStation runs envelopes then processes each selected model, with no full-range download", async () => {
    const { store, calls, downloadStation } = await primed();
    await store.updateStation(rc01Key);
    expect(calls.filter((c: string) => !c.startsWith("coverage"))).toEqual([
      "envelopes", "process:compact-v1", "process:large-v1",
    ]);
    expect(downloadStation).not.toHaveBeenCalled();
  });
```

b. `"reloads that pair's coverage stats after each model"` (~line 562) — remove `"download",` from the expected array.

c. In the **busy lockout** describe: `"ignores a second update while one is already running"` (~line 851) — change the final assertion to `expect(ctx.downloadStation).not.toHaveBeenCalled();`. `"ignores a download while an update is running"` (~line 866) — the comment and assertion about "the update's own internal download" change to:

```ts
    // The external download entry point was a no-op; updates never full-range download.
    expect(ctx.downloadStation).not.toHaveBeenCalled();
```

d. `"passes the range and a station-bound uploadTile to processEnvelopes"` (~line 695) — add after the range assertion:

```ts
    // Real EarthScope data via the proxy, matching the events flow — never the mock.
    expect(options.proxy).toBe(true);
```

**Step 2: Add the new tests**

In the `update (event generation)` describe:

```ts
  it("fills raw stats live as onDayDownloaded fires during envelopes and events", async () => {
    const day1 = dayIndex(utcDay(2026, 1, 1)!);
    const midRun: Array<{ missing: number; bytes: number }> = [];
    const snapshot = () => {
      const { missingCount, bytes } = ctx.store.statsFor(rc01Key);
      midRun.push({ missing: missingCount, bytes });
    };
    const processEnvelopes = jest.fn(async ({ onDayDownloaded }: any) => {
      onDayDownloaded?.(day1, 500);
      snapshot();
      return { uploadedTiles: 0, processedDays: 1, skippedDays: 0, totalDays: 1 };
    });
    const processCoverage = jest.fn(async ({ onDayDownloaded }: any) => {
      onDayDownloaded?.(day1 + 1, 300);
      snapshot();
      return { processed: 1, skipped: 0, total: 1 };
    });
    const ctx = await primed({ models: [compact], processEnvelopes, processCoverage });

    await ctx.store.updateStation(rc01Key);
    // The 3-day range starts fully missing; each downloaded day fills in live.
    expect(midRun).toEqual([
      { missing: 2, bytes: 500 },
      { missing: 1, bytes: 800 },
    ]);
  });

  it("reconciles raw stats from the cache after the update", async () => {
    const ctx = await primed();
    await ctx.store.updateStation(rc01Key);
    expect(ctx.cache.scanCachedDays).toHaveBeenCalled();
    expect(ctx.cache.stationRawBytes).toHaveBeenCalled();
  });
```

(`dayIndex`, `utcDay`, and `statsFor` are already imported/used elsewhere in this file — check the imports at the top and add `dayIndex` if the update describe doesn't already have it in scope; it's imported at line ~1–20.)

**Step 3: Run tests to verify the new/changed ones fail**

Run: `npm test -- --no-watchman src/seismic-admin/seismic-admin-store.test.ts`
Expected: FAIL — flow tests still see `"download"` first; `options.proxy` undefined; `onDayDownloaded` never fired; reconcile scan not called.

**Step 4: Implement in `updateSingleStation`**

- Delete step 1:

```ts
    // 1) Raw data for the whole range (existing flow, reports its own feedback).
    await this.download(stationData, prefix);
```

- Renumber the remaining step comments (envelopes become 1, events become 2) and note the new behavior on the method docstring:

```ts
  /** Generate + upload missing envelopes, then generate events for each selected model's
   *  uncovered days. Each step downloads only the raw days it needs. Returns false if
   *  anything failed. */
```

- The envelope `run({...})` call gains `proxy: true` and `onDayDownloaded`:

```ts
      await run({
        stationData, range, proxy: true,
        uploadTile: (level, tileIndex, tile) => uploader.uploadTile(stationData, level, tileIndex, tile),
        onProgress: (done, total) => this.setFeedback(
          `${prefix}${getStationLabel(stationData)} — envelopes: day ${done} of ${total}`),
        onDayDownloaded: (day, bytes) => this.markDayCached(key, day, bytes),
        onTileUploaded: (level, tileIndex) => {
          if (level === FINEST_LEVEL) this.markTileUploaded(key, tileIndex);
        },
      });
```

- The events `run({...})` call gains the same callback (after `onDayCovered`):

```ts
          onDayCovered: day => this.markDayCovered(key, url, day),
          onDayDownloaded: (day, bytes) => this.markDayCached(key, day, bytes),
```

- Before the final `return ok;`, reconcile raw stats:

```ts
    // Reconcile with what's actually on disk; both steps may have downloaded raw days
    // and the incremental markDayCached updates above are an estimate.
    await this.loadStats(stationData);
    return ok;
```

**Step 5: Run tests to verify they pass**

Run: `npm test -- --no-watchman src/seismic-admin/seismic-admin-store.test.ts`
Expected: all PASS.

**Step 6: Commit**

```bash
git add src/seismic-admin/seismic-admin-store.ts src/seismic-admin/seismic-admin-store.test.ts
git commit -m "Update flow downloads only raw days needed for missing envelopes/events."
```

---

### Task 5: Full verification

**Step 1: Run the full seismic-related test suites**

Run: `npm test -- --no-watchman src/models/stores/seismic src/seismic-admin shared/seismic`
Expected: all PASS.

**Step 2: Run the whole Jest suite**

Run: `npm test -- --no-watchman`
Expected: all PASS (catches wave-runner and any other indirect consumers).

**Step 3: Lint + types**

Run: `npm run lint:build && npm run check:types`
Expected: both clean.

**Step 4: Commit any stragglers and stop**

If steps 1–3 required fixes, commit them. Then follow superpowers:finishing-a-development-branch.
