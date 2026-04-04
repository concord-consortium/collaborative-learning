import { makeAutoObservable, observable, runInAction } from "mobx";
import { DateTime } from "luxon";
import {
  LEVEL_SPACINGS, AMPLITUDE_RANGES, NO_DATA_SENTINEL, RAW_CHUNK_DURATION
} from "../../../shared/seismic/envelope-config";
import { dequantize } from "../../../shared/seismic/envelope-codec";
import { getTileIndicesForViewport, getTileTimeRange } from "../../../shared/seismic/tile-addressing";
import { fetchEnvelopeTile } from "../../../shared/seismic/envelope-fetcher";
import { fetchRawSeismicData, fetchStationMetadata } from "../../../shared/seismic/earthscope-client";
import { miniseed } from "seisplotjs";
import {
  EnvelopeTileData, ChannelMetadata, NullableNumberArray,
  SeismicViewportParams, ViewportQueryResult, RawSegment, StationData, TimeRange
} from "../../../shared/seismic/seismic-types";

type EnvelopeCacheEntry = EnvelopeTileData | "loading" | "missing";
type RawCacheEntry = RawSegment[] | "loading" | "missing";

const valueScalar = 2;

export function envelopeCacheKey(stationData: StationData, level: number, tileIndex: number) {
  const { network, station, channel } = stationData;
  return `${network}_${station}/${channel}/L${level}/${tileIndex}`;
}

export function rawCacheKey(stationData: StationData, chunkIndex: number) {
  const { network, station, channel } = stationData;
  return `${network}_${station}/${channel}/raw/${chunkIndex}`;
}

export class SeismicQueryService {
  /** Envelope tile cache keyed by "{network}_{station}/{channel}/L{level}/{tileIndex}" */
  envelopeCache: Map<string, EnvelopeCacheEntry> = observable.map();

  /** Raw data cache keyed by "{network}_{station}/{channel}/raw/{chunkIndex}" */
  rawCache: Map<string, RawCacheEntry> = observable.map();

  /** Station metadata cache keyed by "{network}_{station}" */
  metadataCache: Map<string, ChannelMetadata[]> = observable.map();

  /** In-flight AbortControllers keyed by callerId */
  private inflightByCallerId: Map<string, Map<string, AbortController>> = new Map();

  constructor() {
    makeAutoObservable(this, {
      envelopeCache: observable,
      rawCache: observable,
      metadataCache: observable,
    });
  }

  /**
   * Select the appropriate data level for the given viewport.
   * Returns 0, 1, 2 for envelope levels, or "raw" for raw data.
   */
  selectLevel(startTime: DateTime, endTime: DateTime, pixelWidth: number): number | "raw" {
    const secondsPerPixel = (endTime.toSeconds() - startTime.toSeconds()) / pixelWidth;
    for (let level = 0; level < LEVEL_SPACINGS.length; level++) {
      if (secondsPerPixel >= LEVEL_SPACINGS[level]) return level;
    }
    return "raw";
  }

  /**
   * Returns current best-available data for the viewport.
   * Called from MobX observer components so cache reads are tracked.
   */
  query(params: SeismicViewportParams): ViewportQueryResult {
    const { stationData, startTime, endTime, pixelWidth } = params;
    const level = this.selectLevel(startTime, endTime, pixelWidth);
    const instrumentCode = stationData.channel.charAt(1);
    const amplitudeRange = AMPLITUDE_RANGES[instrumentCode] ?? 1;

    if (level === "raw") {
      return this.queryRaw(params, amplitudeRange);
    }
    return this.queryEnvelope(params, level, amplitudeRange);
  }

  /**
   * Triggers fetches for missing data. Cancels stale fetches from previous
   * call with the same callerId.
   */
  loadViewport(callerId: string, params: SeismicViewportParams): void {
    const { startTime, endTime, pixelWidth } = params;
    const level = this.selectLevel(startTime, endTime, pixelWidth);

    if (level === "raw") {
      this.loadRaw(callerId, params);
    } else {
      this.loadEnvelope(callerId, params, level);
    }
  }

  // --- Private helpers (general) ---

  private addNull(time: number, timestamps: NullableNumberArray, v1: NullableNumberArray, v2?: NullableNumberArray) {
    timestamps.push(time);
    v1.push(null);
    v2?.push(null);
  }

  private fillNull(
    range: TimeRange, spacing: number, timestamps: NullableNumberArray, v1: NullableNumberArray,
    v2?: NullableNumberArray, minStart?: number, maxEnd?: number
  ) {
    const tileStart = minStart !== undefined ? Math.max(range.start, minStart) : range.start;
    const tileEnd = maxEnd !== undefined ? Math.min(range.end, maxEnd) : range.end;
    for (let t = tileStart; t < tileEnd; t += spacing) {
      this.addNull(t, timestamps, v1, v2);
    }
  }

  private getFallbackData(
    level: number, stationData: StationData, start: number, end: number
  ): { timestamps: NullableNumberArray, mins: NullableNumberArray, maxs: NullableNumberArray } | null {
    if (level < 0) return null;

    const spacing = LEVEL_SPACINGS[level];
    const tileIndices = getTileIndicesForViewport(start, end, level);

    const timestamps: NullableNumberArray = [];
    const mins: NullableNumberArray = [];
    const maxs: NullableNumberArray = [];

    for (const fbTileIndex of tileIndices) {
      const key = envelopeCacheKey(stationData, level, fbTileIndex);
      const entry = this.envelopeCache.get(key);
      if (!entry || entry === "loading" || entry === "missing") {
        return this.getFallbackData(level - 1, stationData, start, end);
      }

      const range = getTileTimeRange(level, fbTileIndex);
      for (let i = 0; i < entry.mins.length; i++) {
        const t = range.start + i * spacing;
        if (t < start || t >= end) continue;
        if (entry.mins[i] === NO_DATA_SENTINEL) {
          this.addNull(t, timestamps, mins, maxs);
        } else {
          const amplitudeRange = AMPLITUDE_RANGES[stationData.channel.charAt(1)] ?? 1;
          timestamps.push(t);
          mins.push(dequantize(entry.mins[i], amplitudeRange) * valueScalar);
          maxs.push(dequantize(entry.maxs[i], amplitudeRange) * valueScalar);
        }
      }
    }

    return timestamps.length > 0 ? { timestamps, mins, maxs } : null;
  }

  // --- Private helpers (envelope) ---

  private queryEnvelope(params: SeismicViewportParams, level: number, amplitudeRange: number): ViewportQueryResult {
    const { stationData, startTime, endTime } = params;
    const startSec = startTime.toSeconds();
    const endSec = endTime.toSeconds();
    const tileIndices = getTileIndicesForViewport(startSec, endSec, level);
    const spacing = LEVEL_SPACINGS[level];

    const timestamps: NullableNumberArray = [];
    const mins: NullableNumberArray = [];
    const maxs: NullableNumberArray = [];
    let isLoading = false;

    for (const tileIndex of tileIndices) {
      const key = envelopeCacheKey(stationData, level, tileIndex);
      const entry = this.envelopeCache.get(key);

      // Fallback to one level coarser if this level is loading
      if (entry === "loading" || entry === undefined) {
        isLoading = true;
        const _range = getTileTimeRange(level, tileIndex);
        const overlapStart = Math.max(_range.start, startSec);
        const overlapEnd = Math.min(_range.end, endSec);
        const fallbackData = this.getFallbackData(level - 1, stationData, overlapStart, overlapEnd);
        if (fallbackData) {
          timestamps.push(...fallbackData.timestamps);
          mins.push(...fallbackData.mins);
          maxs.push(...fallbackData.maxs);
          continue;
        }
        // No fallback — insert nulls for this tile's time range
        this.fillNull(getTileTimeRange(level, tileIndex), spacing, timestamps, mins, maxs, startSec, endSec);
        continue;
      }

      if (entry === "missing") {
        this.fillNull(getTileTimeRange(level, tileIndex), spacing, timestamps, mins, maxs, startSec, endSec);
        continue;
      }

      // Real data — dequantize and add to arrays
      const range = getTileTimeRange(level, tileIndex);
      for (let i = 0; i < entry.mins.length; i++) {
        const t = range.start + i * spacing;
        if (t < startSec || t >= endSec) continue;
        if (entry.mins[i] === NO_DATA_SENTINEL) {
          this.addNull(t, timestamps, mins, maxs);
        } else {
          timestamps.push(t);
          mins.push(dequantize(entry.mins[i], amplitudeRange) * valueScalar);
          maxs.push(dequantize(entry.maxs[i], amplitudeRange) * valueScalar);
        }
      }
    }

    return { level, data: [timestamps, mins, maxs], amplitudeRange, isLoading };
  }

  private loadEnvelope(callerId: string, params: SeismicViewportParams, level: number): void {
    const { stationData, startTime, endTime } = params;
    const startSec = startTime.toSeconds();
    const endSec = endTime.toSeconds();
    const tileIndices = getTileIndicesForViewport(startSec, endSec, level);

    // Determine which tiles need fetching
    const toFetch: number[] = [];
    const neededKeys = new Set<string>();
    for (const tileIndex of tileIndices) {
      const key = envelopeCacheKey(stationData, level, tileIndex);
      neededKeys.add(key);
      if (!this.envelopeCache.has(key)) {
        toFetch.push(tileIndex);
      }
    }

    // Cancel stale fetches for this caller
    this.cancelStale(callerId, neededKeys);

    // Fetch missing tiles
    for (const tileIndex of toFetch) {
      const key = envelopeCacheKey(stationData, level, tileIndex);
      const controller = new AbortController();
      this.registerInflight(callerId, key, controller);

      runInAction(() => { this.envelopeCache.set(key, "loading"); });

      fetchEnvelopeTile({ stationData, level, tileIndex, signal: controller.signal }).then(data => {
        runInAction(() => {
          this.envelopeCache.set(key, data ?? "missing");
        });
      }).catch(err => {
        if (err.name !== "AbortError") {
          runInAction(() => { this.envelopeCache.set(key, "missing"); });
        }
      }).finally(() => {
        this.removeInflight(callerId, key);
      });
    }
  }

  // --- Private helpers (raw) ---

  private rawChunkIndex(unixSeconds: number): number {
    return Math.floor(unixSeconds / RAW_CHUNK_DURATION);
  }

  private queryRaw(params: SeismicViewportParams, amplitudeRange: number): ViewportQueryResult {
    const { stationData, startTime, endTime } = params;
    const startSec = startTime.toSeconds();
    const endSec = endTime.toSeconds();
    const firstChunk = this.rawChunkIndex(startSec);
    const lastChunk = this.rawChunkIndex(endSec - 1e-9);

    const timestamps: NullableNumberArray = [];
    const values: NullableNumberArray = [];
    let isLoading = false;

    for (let ci = firstChunk; ci <= lastChunk; ci++) {
      const key = rawCacheKey(stationData, ci);
      const entry = this.rawCache.get(key);

      if (entry === "loading" || entry === undefined) {
        isLoading = true;
        // Attempt fallback to L2 envelope for this chunk's time range
        const start = Math.max(ci * RAW_CHUNK_DURATION, startSec);
        const end = Math.min((ci + 1) * RAW_CHUNK_DURATION, endSec);
        const fallback = this.getFallbackData(2, stationData, start, end);
        if (fallback) {
          // Envelope fallback — push as interleaved min/max approximation (use midpoint)
          for (let i = 0; i < fallback.timestamps.length; i++) {
            timestamps.push(fallback.timestamps[i]);
            const min = fallback.mins[i];
            const max = fallback.maxs[i];
            values.push(min !== null && max !== null ? (min + max) / 2 : null);
          }
        }
        continue;
      }

      if (entry === "missing") continue;

      // Real segment data
      for (const segment of entry) {
        for (let i = 0; i < segment.samples.length; i++) {
          const t = segment.startTime + i / segment.sampleRate;
          if (t < startSec || t >= endSec) continue;
          timestamps.push(t);
          values.push(segment.samples[i]);
        }
      }
    }

    return { level: "raw", data: [timestamps, values], amplitudeRange, isLoading };
  }

  private async loadRaw(callerId: string, params: SeismicViewportParams): Promise<void> {
    const { stationData, location, startTime, endTime } = params;
    const startSec = startTime.toSeconds();
    const endSec = endTime.toSeconds();
    const firstChunk = this.rawChunkIndex(startSec);
    const lastChunk = this.rawChunkIndex(endSec - 1e-9);

    const neededKeys = new Set<string>();
    const toFetch: number[] = [];
    for (let ci = firstChunk; ci <= lastChunk; ci++) {
      const key = rawCacheKey(stationData, ci);
      neededKeys.add(key);
      if (!this.rawCache.has(key)) {
        toFetch.push(ci);
      }
    }

    this.cancelStale(callerId, neededKeys);

    if (toFetch.length === 0) return;

    // Ensure station metadata is cached so we have the sensitivity
    const sensitivity = await this.getSensitivity(stationData);

    for (const chunkIndex of toFetch) {
      const key = rawCacheKey(stationData, chunkIndex);
      const controller = new AbortController();
      this.registerInflight(callerId, key, controller);

      runInAction(() => { this.rawCache.set(key, "loading"); });

      const chunkStartSec = chunkIndex * RAW_CHUNK_DURATION;
      const chunkEndSec = (chunkIndex + 1) * RAW_CHUNK_DURATION;
      const chunkStartDT = DateTime.fromSeconds(chunkStartSec, { zone: "utc" });
      const chunkEndDT = DateTime.fromSeconds(chunkEndSec, { zone: "utc" });
      const chunkStartISO = chunkStartDT.toISO();
      const chunkEndISO = chunkEndDT.toISO();
      if (!chunkStartISO || !chunkEndISO) continue;

      this.fetchAndParseRaw(
        stationData, location, chunkStartISO, chunkEndISO, sensitivity, controller.signal
      ).then(segments => {
        runInAction(() => {
          this.rawCache.set(key, segments.length > 0 ? segments : "missing");
        });
      }).catch(err => {
        if (err.name !== "AbortError") {
          runInAction(() => { this.rawCache.set(key, "missing"); });
        }
      }).finally(() => {
        this.removeInflight(callerId, key);
      });
    }
  }

  private async getSensitivity({ network, station, channel }: StationData): Promise<number> {
    const metaKey = `${network}_${station}`;
    let metadata = this.metadataCache.get(metaKey);
    if (!metadata) {
      metadata = await fetchStationMetadata(network, station);
      runInAction(() => { this.metadataCache.set(metaKey, metadata!); });
    }
    const channelMeta = metadata.find(m => m.channel === channel);
    return channelMeta?.scale ?? 1;
  }

  private async fetchAndParseRaw(
    { network, station, channel }: StationData, location: string, startISO: string, endISO: string,
    sensitivity: number, signal: AbortSignal
  ): Promise<RawSegment[]> {
    const response = await fetchRawSeismicData(
      network, station, location, channel, startISO, endISO, { signal }
    );
    const buffer = await response.arrayBuffer();
    const records = miniseed.parseDataRecords(buffer);
    const seismogram = miniseed.merge(records);

    // Extract raw segments from seisplotjs Seismogram
    const segments: RawSegment[] = [];
    if (seismogram && seismogram.segments) {
      for (const seg of seismogram.segments) {
        const segStartTime = seg.startTime.toSeconds();
        const sampleRate = seg.sampleRate;
        const y = seg.y;
        const samples = new Float64Array(y.length);
        for (let i = 0; i < y.length; i++) {
          samples[i] = y[i] / sensitivity * valueScalar;
        }
        segments.push({ startTime: segStartTime, sampleRate, samples });
      }
    }
    return segments;
  }

  // --- Cancellation helpers ---

  private cancelStale(callerId: string, neededKeys: Set<string>): void {
    const callerInflight = this.inflightByCallerId.get(callerId);
    if (!callerInflight) return;

    for (const [key, controller] of callerInflight) {
      if (!neededKeys.has(key)) {
        controller.abort();
        callerInflight.delete(key);
      }
    }
  }

  private registerInflight(callerId: string, key: string, controller: AbortController): void {
    let callerMap = this.inflightByCallerId.get(callerId);
    if (!callerMap) {
      callerMap = new Map();
      this.inflightByCallerId.set(callerId, callerMap);
    }
    callerMap.set(key, controller);
  }

  private removeInflight(callerId: string, key: string): void {
    const callerMap = this.inflightByCallerId.get(callerId);
    if (callerMap) {
      callerMap.delete(key);
      if (callerMap.size === 0) {
        this.inflightByCallerId.delete(callerId);
      }
    }
  }
}
