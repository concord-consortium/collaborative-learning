import { miniseed } from "seisplotjs";
import { getMetadataForChannel } from "../../../../shared/seismic/channel-metadata-utils";
import { quantize } from "../../../../shared/seismic/envelope-codec";
import { AMPLITUDE_RANGES, FINEST_LEVEL, LEVEL_SPACINGS } from "../../../../shared/seismic/envelope-config";
import { computeEnvelopesFromRaw } from "../../../../shared/seismic/envelope-compute";
import { listEnvelopeTileIndices, missingEnvelopeDaySpans } from "../../../../shared/seismic/envelope-coverage";
import { createPipelineState, flushTiles, processL2Point } from "../../../../shared/seismic/envelope-pipeline";
import { createOpfsCache, SeismicCache } from "../../../../shared/seismic/opfs-seismic-cache";
import { fetchStationMetadata } from "../../../../shared/seismic/earthscope-client";
import {
  ChannelMetadata, EnvelopeTileData, RawSegment, StationData, StationId, TimeRange
} from "../../../../shared/seismic/seismic-types";

export interface ProcessEnvelopeOptions {
  stationData: StationData;
  /** Unix seconds; caller guarantees day-aligned bounds. */
  range: TimeRange;
  uploadTile: (level: number, tileIndex: number, tile: EnvelopeTileData) => Promise<void>;
  onProgress?: (done: number, total: number) => void;
  /** Fires after each successful upload; finest-level events drive the live timeline fill. */
  onTileUploaded?: (level: number, tileIndex: number) => void;
  /** Test seams; production defaults construct real ones. */
  cache?: Pick<SeismicCache, "readDayChunk">;
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
 * streaming OPFS raw data through the envelope pipeline and merge-uploading each
 * flushed tile.
 */
// TODO: Abstract this function so it's reusable by step 5 in main() of generate-envelopes.ts.
export async function processEnvelopeCoverage(options: ProcessEnvelopeOptions):
  Promise<{ uploadedTiles: number; processedDays: number; skippedDays: number; totalDays: number }> {
  const { stationData, range, uploadTile, onProgress, onTileUploaded } = options;

  let uploadedTiles = 0;
  let processedDays = 0;
  let skippedDays = 0;

  const tiles = await (options.listTiles ?? listEnvelopeTileIndices)(stationData);
  const spans = missingEnvelopeDaySpans(tiles, range);
  const totalDays = spans.reduce((sum, s) => sum + (s.endDay - s.startDay + 1), 0);

  const updateProgress = () => { onProgress?.(processedDays + skippedDays, totalDays); };
  updateProgress();
  if (!spans.length) return { uploadedTiles, processedDays, skippedDays, totalDays };

  const metadata = await (options.fetchMetadata ?? fetchStationMetadata)(stationData);
  const cache = options.cache ?? createOpfsCache();
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

  for (const span of spans) {
    // Each span gets fresh pipeline state; boundary tiles are completed by merge-on-upload.
    const state = createPipelineState();
    for (let day = span.startDay; day <= span.endDay; day++) {
      const buffer = await cache.readDayChunk(stationData, day);
      if (!buffer) {
        // No raw data (unavailable at EarthScope): the day can never get envelopes.
        skippedDays++;
        updateProgress();
        continue;
      }
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
      flushTiles(state, queueTile);
      await uploadPending();
      processedDays++;
      updateProgress();
    }
    flushTiles(state, queueTile, true);
    await uploadPending();
  }

  return { uploadedTiles, processedDays, skippedDays, totalDays };
}
