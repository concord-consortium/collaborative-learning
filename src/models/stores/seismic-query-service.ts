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
  EnvelopeTileData, ChannelMetadata, NullableNumberArray, SeismicViewportParams, ViewportQueryResult, RawSegment,
  StationData, StationId, TimeRange, StationQuery
} from "../../../shared/seismic/seismic-types";

type EnvelopeCacheEntry = EnvelopeTileData | "loading" | "missing";
type RawCacheEntry = RawSegment[] | "loading" | "missing";

const MAX_RAW_CACHE_ENTRIES = 100;

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

  /** Tracks access order for rawCache LRU eviction (plain Map, not observable) */
  private rawCacheOrder: Map<string, true> = new Map();

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
    const { stationLocation, startTime, endTime, pixelWidth } = params;
    const level = this.selectLevel(startTime, endTime, pixelWidth);
    const instrumentCode = stationLocation.channel.charAt(1);
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
    this.loadData(callerId, params, level);
  }

  /**
   * Returns the metadata for the station at the specified time.
   */
  async getMetadata(stationData: StationData, timeSec: number): Promise<ChannelMetadata | undefined> {
    const allMetadata = await this.getAllMetadata(stationData);
    return this.getMetadataForChannel(allMetadata, stationData.channel, timeSec);
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

    const amplitudeRange = AMPLITUDE_RANGES[stationData.channel.charAt(1)] ?? 1;
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
          timestamps.push(t);
          mins.push(dequantize(entry.mins[i], amplitudeRange));
          maxs.push(dequantize(entry.maxs[i], amplitudeRange));
        }
      }
    }

    return timestamps.length > 0 ? { timestamps, mins, maxs } : null;
  }

  private async loadData(callerId: string, params: SeismicViewportParams, level: number | "raw"): Promise<void> {
    const { stationLocation, startTime, endTime } = params;
    const startSec = startTime.toSeconds();
    const endSec = endTime.toSeconds();
    const raw = level === "raw";

    let indices: number[];
    if (raw) {
      const firstChunk = this.rawChunkIndex(startSec);
      const lastChunk = this.rawChunkIndex(endSec - 1e-9);
      indices = [];
      for (let ci = firstChunk; ci <= lastChunk; ci++) indices.push(ci);
    } else {
      indices = getTileIndicesForViewport(startSec, endSec, level);
    }

    const toFetch: number[] = [];
    const neededKeys = new Set<string>();
    const getKey = (i: number) => raw ? rawCacheKey(stationLocation, i) : envelopeCacheKey(stationLocation, level, i);
    for (const index of indices) {
      const key = getKey(index);
      neededKeys.add(key);
      const inCache = raw ? this.hasRawCache(key) : this.envelopeCache.has(key);
      if (!inCache) {
        toFetch.push(index);
      }
    }

    // Cancel stale fetches for this caller
    this.cancelStale(callerId, neededKeys);

    if (toFetch.length === 0) return;

    const metadata = raw ? await this.getAllMetadata(stationLocation) : [];

    // Fetch missing tiles
    for (const index of toFetch) {
      const key = getKey(index);
      const controller = new AbortController();
      this.registerInflight(callerId, key, controller);

      if (raw) {
        runInAction(() => { this.setRawCache(key, "loading"); });
      } else {
        runInAction(() => { this.envelopeCache.set(key, "loading"); });
      }

      const catchFunction = (err: any) => {
        if (err.name !== "AbortError") {
          if (raw) {
            runInAction(() => { this.setRawCache(key, "missing"); });
          } else {
            runInAction(() => { this.envelopeCache.set(key, "missing"); });
          }
        }
      };
      const finallyFunction = () => {
        this.removeInflight(callerId, key);
      };

      if (raw) {
        const chunkStartISO = DateTime.fromSeconds(index * RAW_CHUNK_DURATION, { zone: "utc" }).toISO();
        const chunkEndISO = DateTime.fromSeconds((index + 1) * RAW_CHUNK_DURATION, { zone: "utc" }).toISO();
        if (!chunkStartISO || !chunkEndISO) continue;

        this.fetchAndParseRaw(
          { ...stationLocation, startTime: chunkStartISO, endTime: chunkEndISO }, metadata, controller.signal
        ).then(segments => {
          runInAction(() => {
            this.setRawCache(key, segments.length > 0 ? segments : "missing");
          });
        }).catch(catchFunction).finally(finallyFunction);
      } else {
        fetchEnvelopeTile({ stationData: stationLocation, level, tileIndex: index, signal: controller.signal })
          .then(data => {
            runInAction(() => {
              this.envelopeCache.set(key, data ?? "missing");
            });
          }).catch(catchFunction).finally(finallyFunction);
      }
    }
  }

  // --- Private helpers (envelope) ---

  private queryEnvelope(params: SeismicViewportParams, level: number, amplitudeRange: number): ViewportQueryResult {
    const { stationLocation, startTime, endTime } = params;
    const startSec = startTime.toSeconds();
    const endSec = endTime.toSeconds();
    const tileIndices = getTileIndicesForViewport(startSec, endSec, level);
    const spacing = LEVEL_SPACINGS[level];

    const timestamps: NullableNumberArray = [];
    const mins: NullableNumberArray = [];
    const maxs: NullableNumberArray = [];
    let isLoading = false;

    for (const tileIndex of tileIndices) {
      const key = envelopeCacheKey(stationLocation, level, tileIndex);
      const entry = this.envelopeCache.get(key);

      // Fallback to one level coarser if this level is loading
      if (entry === "loading" || entry === undefined) {
        isLoading = true;
        const _range = getTileTimeRange(level, tileIndex);
        const overlapStart = Math.max(_range.start, startSec);
        const overlapEnd = Math.min(_range.end, endSec);
        const fallbackData = this.getFallbackData(level - 1, stationLocation, overlapStart, overlapEnd);
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
          mins.push(dequantize(entry.mins[i], amplitudeRange));
          maxs.push(dequantize(entry.maxs[i], amplitudeRange));
        }
      }
    }

    // Compute actual data range for y-axis auto-scaling
    let dataMax = 0;
    for (let i = 0; i < mins.length; i++) {
      const min = mins[i];
      if (min !== null) dataMax = Math.max(dataMax, Math.abs(min));
      const max = maxs[i];
      if (max !== null) dataMax = Math.max(dataMax, Math.abs(max));
    }
    const autoRange = dataMax > 0 ? dataMax : amplitudeRange;

    return { level, data: [timestamps, mins, maxs], amplitudeRange: autoRange, isLoading };
  }

  // --- Private helpers (raw) ---

  private rawChunkIndex(unixSeconds: number): number {
    return Math.floor(unixSeconds / RAW_CHUNK_DURATION);
  }

  private queryRaw(params: SeismicViewportParams, amplitudeRange: number): ViewportQueryResult {
    const { stationLocation, startTime, endTime } = params;
    const startSec = startTime.toSeconds();
    const endSec = endTime.toSeconds();
    const firstChunk = this.rawChunkIndex(startSec);
    const lastChunk = this.rawChunkIndex(endSec - 1e-9);

    const timestamps: NullableNumberArray = [];
    const values: NullableNumberArray = [];
    let isLoading = false;

    for (let ci = firstChunk; ci <= lastChunk; ci++) {
      const key = rawCacheKey(stationLocation, ci);
      const entry = this.getRawCache(key);

      if (entry === "loading" || entry === undefined) {
        isLoading = true;
        // Attempt fallback to L2 envelope for this chunk's time range
        const start = Math.max(ci * RAW_CHUNK_DURATION, startSec);
        const end = Math.min((ci + 1) * RAW_CHUNK_DURATION, endSec);
        const fallback = this.getFallbackData(2, stationLocation, start, end);
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

    // Compute actual data range for y-axis auto-scaling
    let dataMax = 0;
    for (let i = 0; i < values.length; i++) {
      if (values[i] !== null) dataMax = Math.max(dataMax, Math.abs(values[i]!));
    }
    const autoRange = dataMax > 0 ? dataMax : amplitudeRange;

    return { level: "raw", data: [timestamps, values], amplitudeRange: autoRange, isLoading };
  }

  private async getAllMetadata(stationId: StationId): Promise<ChannelMetadata[]> {
    const { network, station } = stationId;
    const metaKey = `${network}_${station}`;
    let metadata = this.metadataCache.get(metaKey);
    if (!metadata) {
      metadata = await fetchStationMetadata(stationId);
      runInAction(() => { this.metadataCache.set(metaKey, metadata!); });
    }
    return metadata;
  }

  private getMetadataForChannel(
    metadata: ChannelMetadata[], channel: string, timeSec: number
  ): ChannelMetadata | undefined {
    const matching = metadata.filter(m => m.channel === channel);
    for (const m of matching) {
      const start = new Date(m.startTime).getTime() / 1000;
      const end = m.endTime === "" ? Infinity : new Date(m.endTime).getTime() / 1000;
      if (timeSec >= start && timeSec < end) return m;
    }
    // When no time matches, return the last metadata (or undefined if there aren't any)
    return matching[matching.length - 1];
  }

  private async fetchAndParseRaw(
    query: StationQuery, metadata: ChannelMetadata[], signal: AbortSignal
  ): Promise<RawSegment[]> {
    const response = await fetchRawSeismicData(query, { signal });
    const buffer = await response.arrayBuffer();
    const records = miniseed.parseDataRecords(buffer);
    const seismogram = miniseed.merge(records);

    // Extract raw segments from seisplotjs Seismogram
    const segments: RawSegment[] = [];
    if (seismogram && seismogram.segments) {
      for (const seg of seismogram.segments) {
        const segStartTime = seg.startTime.toSeconds();
        const sensitivity = this.getMetadataForChannel(metadata, query.channel, segStartTime)?.scale ?? 1;
        const sampleRate = seg.sampleRate;
        const y = seg.y;
        const samples = new Float64Array(y.length);
        for (let i = 0; i < y.length; i++) {
          samples[i] = y[i] / sensitivity;
        }
        segments.push({ startTime: segStartTime, sampleRate, samples });
      }
    }
    return segments;
  }

  // --- Raw cache LRU helpers ---

  private getRawCache(key: string): RawCacheEntry | undefined {
    const value = this.rawCache.get(key);
    if (value !== undefined) {
      this.rawCacheOrder.delete(key);
      this.rawCacheOrder.set(key, true);
    }
    return value;
  }

  private setRawCache(key: string, value: RawCacheEntry): void {
    this.rawCache.set(key, value);
    this.rawCacheOrder.delete(key);
    this.rawCacheOrder.set(key, true);
    this.evictRawCache();
  }

  private hasRawCache(key: string): boolean {
    return this.rawCache.has(key);
  }

  private deleteRawCache(key: string): void {
    this.rawCache.delete(key);
    this.rawCacheOrder.delete(key);
  }

  private evictRawCache(): void {
    let checked = 0;
    const total = this.rawCacheOrder.size;
    while (this.rawCacheOrder.size > MAX_RAW_CACHE_ENTRIES && checked < total) {
      const oldest = this.rawCacheOrder.keys().next().value;
      if (oldest === undefined) break;
      checked++;
      // Don't evict entries that are still loading
      if (this.rawCache.get(oldest) === "loading") {
        // Move to end so we check the next oldest
        this.rawCacheOrder.delete(oldest);
        this.rawCacheOrder.set(oldest, true);
        continue;
      }
      this.rawCache.delete(oldest);
      this.rawCacheOrder.delete(oldest);
    }
  }

  // --- Cancellation helpers ---

  private cancelStale(callerId: string, neededKeys: Set<string>): void {
    const callerInflight = this.inflightByCallerId.get(callerId);
    if (!callerInflight) return;

    for (const [key, controller] of callerInflight) {
      if (!neededKeys.has(key)) {
        controller.abort();
        callerInflight.delete(key);

        if (this.envelopeCache.get(key) === "loading") {
          this.envelopeCache.delete(key);
        }
        // We use rawCache.get rather than getRawCache here to avoid changing when the key was last accessed
        if (this.rawCache.get(key) === "loading") {
          this.deleteRawCache(key);
        }
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
