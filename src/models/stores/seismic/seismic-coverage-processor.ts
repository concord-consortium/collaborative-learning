import { miniseed } from "seisplotjs";
import { uncoveredDaySpans } from "../../../../shared/seismic/event-database";
import { dayRange, SECONDS_PER_DAY } from "../../../../shared/seismic/seismic-day";
import { SeismicModelRunner } from "../../../../shared/seismic/seismic-model-runner";
import { ModelMetadata, SeismicEvent } from "../../../../shared/seismic/seismic-model-types";
import { StationData, TimeRange } from "../../../../shared/seismic/seismic-types";
import { DONE, SeismicDownloadService } from "./seismic-download-service";
import { getUncoveredRanges, markCovered, writeEvents } from "./seismic-event-service";

export const DETECTION_THRESHOLD = 0.7;

/** The subset of SeismicDownloadService the processor uses; tests inject fakes against it. */
export type CoverageDownloadService = Pick<SeismicDownloadService,
  "ensureRange" | "nextReadyDay" | "readDay" | "cancel" | "emptyDays" | "erroredDays">;

export interface ProcessCoverageOptions {
  stationData: StationData;
  metadata: ModelMetadata;
  /** Unix seconds; the caller guarantees day-aligned bounds. A mid-window (non-day-aligned)
   *  start silently skips the partial first window's events — the same failure mode
   *  documented on findUncoveredRanges. */
  range: TimeRange;
  /** Pre-resolved uncovered ranges. When absent the processor calls getUncoveredRanges
   *  itself and lets failures propagate (admin path). Wave Runner passes its
   *  fallback-resolved ranges here. */
  uncovered?: TimeRange[];
  onEvents?: (events: SeismicEvent[]) => void;
  onProgress?: (progress: number, total: number) => void;
  /** Test seams; production defaults construct real ones. */
  downloadService?: CoverageDownloadService;
  createRunner?: () => SeismicModelRunner;
}

/**
 * Best-effort persistence of one processed day's results: a failure here must not
 * fail the local run. Events are written before coverage is marked, so a failed
 * event write can't be hidden behind an already-covered day (see markCovered's
 * ordering contract).
 */
async function saveDayResults(station: StationData, modelId: string, day: number, events: SeismicEvent[]) {
  try {
    if (events.length) await writeEvents(station, modelId, events);
    await markCovered(station, modelId, dayRange(day));
  } catch (err) {
    console.warn("Failed to save seismic events/coverage:", err);
  }
}

/** Runs the model over the uncovered parts of range, persisting events + coverage
 *  per day (writeEvents before markCovered; empty days covered, errored days not).
 *  Owns the runner lifecycle (loadModel/dispose). Returns day counts. */
export async function processUncoveredRanges(options: ProcessCoverageOptions):
  Promise<{ processed: number; skipped: number; total: number }> {
  const { stationData, metadata, onEvents, onProgress, range } = options;
  const modelId = metadata.id;

  const uncovered = options.uncovered ?? await getUncoveredRanges(stationData, modelId, range);
  const spans = uncoveredDaySpans(uncovered, range);

  const totalDays = spans.reduce((sum, s) => sum + (s.endDay - s.startDay + 1), 0);
  onProgress?.(0, totalDays);

  // Fully covered: nothing to do — skip runner creation (and its model-weights download).
  if (!spans.length) return { processed: 0, skipped: 0, total: 0 };

  // Bulk-download each uncovered span into OPFS, running the model on each day as it lands.
  // Days may arrive out of order; detection is per-window independent, so that's fine.
  // No-data days come as `dayEmpty` and are simply never yielded.
  const downloadService = options.downloadService ?? new SeismicDownloadService();
  const runner = (options.createRunner ?? (() => new SeismicModelRunner()))();
  await runner.loadModel(metadata);
  try {
    let processed = 0;
    let skippedDays = 0;
    const updateProgress = () => {
      const progress = processed + skippedDays
        + downloadService.erroredDays.length + downloadService.emptyDays.length;
      onProgress?.(progress, totalDays);
    };

    for (const span of spans) {
      // ensureRange resets the service, so each span is fully drained before the next starts.
      // endSec is inclusive: the day containing it is downloaded (matches the downloader's daysInRange).
      downloadService.ensureRange({
        ...stationData, startSec: span.startDay * SECONDS_PER_DAY, endSec: span.endDay * SECONDS_PER_DAY
      });

      for (;;) {
        const day = await downloadService.nextReadyDay();
        if (day === DONE) break;

        const buffer = await downloadService.readDay(day);
        if (!buffer) continue;

        // Parse miniSEED → Seismogram
        const records = miniseed.parseDataRecords(buffer);
        const seismogram = miniseed.merge(records);

        // Run model on this chunk
        const dayEvents: SeismicEvent[] = [];
        await runner.processChunk(
          seismogram,
          {
            onProgress: () => {},
            onEvents: (events: SeismicEvent[]) => {
              dayEvents.push(...events);
              onEvents?.(events);
            },
          },
          DETECTION_THRESHOLD,
        );

        await saveDayResults(stationData, modelId, day, dayEvents);

        processed++;
        updateProgress();
      }

      // A day with no data is still processed — mark it covered so nobody re-checks it.
      // Errored days are NOT marked covered, so a later run retries them.
      for (const day of downloadService.emptyDays) {
        await saveDayResults(stationData, modelId, day, []);
      }
      // Count this span's errored/empty days via the live service arrays first, then fold
      // them into skippedDays so they survive the next span's ensureRange reset.
      updateProgress();
      skippedDays += downloadService.erroredDays.length + downloadService.emptyDays.length;
    }

    return { processed, skipped: skippedDays, total: totalDays };
  } finally {
    downloadService.cancel();
    runner.dispose();
  }
}
