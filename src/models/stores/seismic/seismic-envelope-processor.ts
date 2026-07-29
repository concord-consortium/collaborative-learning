import { miniseed } from "seisplotjs";
import { getMetadataForChannel } from "../../../../shared/seismic/channel-metadata-utils";
import { quantize } from "../../../../shared/seismic/envelope-codec";
import { AMPLITUDE_RANGES, FINEST_LEVEL, LEVEL_SPACINGS } from "../../../../shared/seismic/envelope-config";
import { computeEnvelopesFromRaw } from "../../../../shared/seismic/envelope-compute";
import { listEnvelopeTileIndices, missingEnvelopeDaySpans } from "../../../../shared/seismic/envelope-coverage";
import { createPipelineState, flushTiles, processL2Point } from "../../../../shared/seismic/envelope-pipeline";
import { fetchStationMetadata } from "../../../../shared/seismic/earthscope-client";
import { SECONDS_PER_DAY } from "../../../../shared/seismic/seismic-day";
import {
  ChannelMetadata, EnvelopeTileData, RawSegment, StationData, StationId, TimeRange
} from "../../../../shared/seismic/seismic-types";
import { DayDownloadService, DONE, SeismicDownloadService } from "./seismic-download-service";

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

/** Parse one OPFS day file into raw-count segments (sensitivity applied later). */
function defaultParseDay(buffer: ArrayBuffer): RawSegment[] {
  const records = miniseed.parseDataRecords(buffer);
  const seismogram = miniseed.merge(records);
  const segments: RawSegment[] = [];
  for (const seg of seismogram?.segments ?? []) {
    segments.push({
      startTime: seg.startTime.toSeconds(),
      sampleRate: seg.sampleRate,
      samples: new Float64Array(seg.y),
    });
  }
  return segments;
}

/**
 * Generate envelope tiles for every day in range not already fully covered in S3,
 * downloading each missing day's raw data through the envelope pipeline and
 * merge-uploading each flushed tile.
 */
// TODO: Abstract this function so it's reusable by step 5 in main() of generate-envelopes.ts.
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
