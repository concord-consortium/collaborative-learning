import { makeAutoObservable, runInAction } from "mobx";
import { classifyDayCoverage, DayCoverageState } from "../../shared/seismic/event-database";
import { fetchModelMetadata, ModelListEntry } from "../../shared/seismic/model-metadata";
import { createOpfsCache, SeismicCache } from "../../shared/seismic/opfs-seismic-cache";
import { dayIndex, SECONDS_PER_DAY, utcDayFromString } from "../../shared/seismic/seismic-day";
import { ModelMetadata, SeismicEvent } from "../../shared/seismic/seismic-model-types";
import { StationConfig, StationData, TimeRange } from "../../shared/seismic/seismic-types";
import { getStationChannelPrefix } from "../../shared/seismic/tile-addressing";
import { DONE, SeismicDownloadService } from "../models/stores/seismic/seismic-download-service";
import { getUncoveredRanges, loadEvents } from "../models/stores/seismic/seismic-event-service";
import { loadFilters, saveFilters } from "./utils/admin-persistence";
import { mergeStations, missingDayCount, stationLabel } from "./utils/seismic-admin-utils";

type AdminCache = Pick<SeismicCache, "listStations" | "scanCachedDays" | "stationRawBytes" | "deleteDaysInRange">;

export interface DownloadUpdate {
  completed: number;
  total: number;
  // The day that just landed in OPFS, absent on the final summary update.
  day?: number;
  // Bytes written for that day; 0 when it was already cached.
  bytes?: number;
}

/** Reports a station's download as each day lands. */
export type DownloadProgress = (update: DownloadUpdate) => void;

/** Download one station's missing days into OPFS and wait for completion. Production default;
 *  tests inject their own to bypass the Web Worker.
 */
async function defaultDownloadStation(
  station: StationConfig, startSec: number, endSec: number, onProgress?: DownloadProgress
) {
  const service = new SeismicDownloadService();
  service.ensureRange({
    network: station.network, station: station.station, channel: station.channel,
    location: station.location ?? "", startSec, endSec, proxy: true,
  });
  // Drain the ready queue until the download reports done, reporting each day as it lands.
  let day: number | typeof DONE;
  while ((day = await service.nextReadyDay()) !== DONE) {
    onProgress?.({
      completed: service.completed, total: service.total, day, bytes: service.bytesForDay(day),
    });
  }
  onProgress?.({ completed: service.completed, total: service.total });
}

export interface SeismicAdminDeps {
  cache?: AdminCache;
  stations?: StationConfig[];
  models?: ModelListEntry[];
  fetchMetadata?: (metadataUrl: string) => Promise<ModelMetadata>;
  downloadStation?: (
    station: StationConfig, startSec: number, endSec: number, onProgress?: DownloadProgress
  ) => Promise<void>;
  eventService?: {
    getUncoveredRanges: (s: StationData, model: string, range: TimeRange) => Promise<TimeRange[]>;
    loadEvents: (s: StationData, model: string, range: TimeRange) => Promise<SeismicEvent[]>;
  };
}

export type CoverageLoadState = "pending" | "loaded" | "error";

/** One station × model pair's event coverage, as loaded from the event database. */
export interface CoverageStats {
  state: CoverageLoadState;
  dayStates?: Map<number, DayCoverageState>;
  eventCount?: number;
}

export interface ModelStats {
  eventCount: number;
  coveredDays: Map<string, Set<number>>;
  partialDays: Map<string, Set<number>>;
  coveredDayCount: number;
  partialDayCount: number;
  totalDays: number
}

export function coverageKey(stationKey: string, modelUrl: string) {
  return `${stationKey}|${modelUrl}`;
}

interface StationStats {
  bytes: number;
  cachedDays?: Set<number>;
  missingCount: number;
}

export class SeismicAdminStore {
  startDate = "2026-01-01";
  endDate = "2026-01-31";
  stations = new Map<string, StationConfig>();   // keyed by getStationChannelPrefix
  selectedStations = new Set<string>();          // same keys
  stats = new Map<string, StationStats>();
  models = new Map<string, ModelListEntry>();    // keyed by metadataUrl
  selectedModels = new Set<string>();            // same keys; persisted
  modelMetadata = new Map<string, ModelMetadata | "error">();
  coverage = new Map<string, CoverageStats>();   // keyed by coverageKey(stationKey, modelUrl)
  feedback = "";
  authReady = false;

  private cache: AdminCache;
  // True once a selection has been persisted, so refresh() won't re-select everything.
  private hasSavedStationSelection = false;
  private hasSavedModelSelection = false;

  constructor(private deps: SeismicAdminDeps = {}) {
    this.cache = deps.cache ?? createOpfsCache();

    const saved = loadFilters();
    if (saved.startDate) this.startDate = saved.startDate;
    if (saved.endDate) this.endDate = saved.endDate;
    if (saved.selectedStations) {
      this.selectedStations = new Set(saved.selectedStations);
      this.hasSavedStationSelection = true;
    }

    (deps.models ?? []).forEach(m => this.models.set(m.metadataUrl, m));
    if (saved.selectedModels) {
      // A restored selection may name models the catalog no longer declares.
      this.selectedModels = new Set(saved.selectedModels.filter(url => this.models.has(url)));
      this.hasSavedModelSelection = true;
    } else {
      // Select everything by default, but never override a selection the user saved.
      for (const url of this.models.keys()) this.selectedModels.add(url);
    }

    // `deps` and `cache` are injected dependencies, not observable state.
    makeAutoObservable<SeismicAdminStore, "deps" | "cache">(
      this, { deps: false, cache: false }, { autoBind: true });
  }

  private save() {
    saveFilters({
      startDate: this.startDate, endDate: this.endDate,
      selectedStations: [...this.selectedStations], selectedModels: [...this.selectedModels],
    });
  }

  get selectedStationList() {
    const selectedStationList: StationConfig[] = [];
    this.selectedStations.forEach(key => {
      const station = this.stations.get(key);
      if (station) selectedStationList.push(station);
    });
    return selectedStationList;
  }

  get selectedModelList(): ModelListEntry[] {
    const list: ModelListEntry[] = [];
    this.selectedModels.forEach(url => {
      const model = this.models.get(url);
      if (model) list.push(model);
    });
    return list;
  }

  private get firstSec() {
    return utcDayFromString(this.startDate);
  }

  get firstDay() {
    const { firstSec } = this;
    if (firstSec !== undefined) return dayIndex(firstSec);
  }

  private get lastSec() {
    return utcDayFromString(this.endDate);
  }

  get lastDay() {
    const { lastSec } = this;
    if (lastSec) return dayIndex(lastSec);
  }

  /** endDate is inclusive: the range extends through the end of that UTC day (matches Wave Runner). */
  private get rangeSec(): TimeRange | undefined {
    const { firstSec, lastSec } = this;
    if (firstSec === undefined || lastSec === undefined) return;
    return { start: firstSec, end: lastSec + SECONDS_PER_DAY };
  }

  get selectedMissingRawDays() {
    let total = 0;
    this.selectedStations.forEach(key => {
      total += this.stats.get(key)?.missingCount ?? 0;
    });
    return total;
  }

  get selectedBytes() {
    let total = 0;
    this.selectedStations.forEach(key => {
      total += this.stats.get(key)?.bytes ?? 0;
    });
    return total;
  }

  setRange(start: string, end: string) {
    this.startDate = start;
    this.endDate = end;
    this.save();
    void this.loadAllStats();
    void this.loadAllCoverageStats();
  }

  toggleStation(key: string) {
    if (this.selectedStations.has(key)) {
      this.selectedStations.delete(key);
    } else {
      this.selectedStations.add(key);
    }
    this.hasSavedStationSelection = true;
    this.save();
    void this.loadAllCoverageStats();
  }

  toggleModel(url: string) {
    if (this.selectedModels.has(url)) {
      this.selectedModels.delete(url);
    } else {
      this.selectedModels.add(url);
    }
    this.hasSavedModelSelection = true;
    this.save();
    void this.loadAllCoverageStats();
  }

  /** Resolve (and cache) a model's metadata; undefined when it failed to load. */
  async ensureModelMetadata(url: string): Promise<ModelMetadata | undefined> {
    const cached = this.modelMetadata.get(url);
    if (cached === "error") return undefined;
    if (cached) return cached;
    try {
      const fetcher = this.deps.fetchMetadata ?? fetchModelMetadata;
      const metadata = await fetcher(url);
      runInAction(() => this.modelMetadata.set(url, metadata));
      return metadata;
    } catch (err) {
      console.warn("Failed to load model metadata:", url, err);
      runInAction(() => this.modelMetadata.set(url, "error"));
      return undefined;
    }
  }

  async loadCoverageStats(station: StationConfig, modelUrl: string) {
    const key = coverageKey(getStationChannelPrefix(station), modelUrl);
    const range = this.rangeSec;
    if (!this.authReady || !range) return;
    runInAction(() => this.coverage.set(key, { state: "pending" }));

    const metadata = await this.ensureModelMetadata(modelUrl);
    if (!metadata) {
      runInAction(() => this.coverage.set(key, { state: "error" }));
      return;
    }
    try {
      const svc = this.deps.eventService ?? { getUncoveredRanges, loadEvents };
      const gaps = await svc.getUncoveredRanges(station, metadata.id, range);
      const events = await svc.loadEvents(station, metadata.id, range);
      runInAction(() => this.coverage.set(key, {
        state: "loaded",
        dayStates: classifyDayCoverage(gaps, range),
        eventCount: events.length,
      }));
    } catch (err) {
      console.warn("Failed to load coverage stats:", err);
      runInAction(() => this.coverage.set(key, { state: "error" }));
    }
  }

  /** Sequential on purpose: avoids a request stampede across stations × models. */
  async loadAllCoverageStats() {
    for (const station of this.selectedStationList) {
      for (const url of this.selectedModels) {
        await this.loadCoverageStats(station, url);
      }
    }
  }

  coverageFor(stationKey: string, modelUrl: string): CoverageStats {
    return this.coverage.get(coverageKey(stationKey, modelUrl)) ?? { state: "pending" };
  }

  private pairFullyCovered(stats: CoverageStats | undefined): boolean {
    return stats?.state === "loaded" && !!stats.dayStates &&
      [...stats.dayStates.values()].every(s => s === "covered");
  }

  /** Pending or errored stats are NOT fully covered — unknown ≠ covered. */
  isFullyCovered(stationKey?: string): boolean {
    if (this.selectedModels.size === 0) return false;
    const stationKeys = stationKey ? [stationKey] : [...this.selectedStations];
    if (stationKeys.length === 0) return false;
    return stationKeys.every(sk =>
      [...this.selectedModels].every(url => this.pairFullyCovered(this.coverage.get(coverageKey(sk, url)))));
  }

  get rangeDays() {
    const { firstDay, lastDay } = this;
    return firstDay !== undefined && lastDay !== undefined ? lastDay - firstDay + 1 : 0;
  }

  /** Coverage stats for a single model. When stationKey is present, the stats are just
   *  for that station. When it is absent, stats are for all selected stations.
   */
  modelStats(modelUrl: string, stationKey?: string): ModelStats {
    let eventCount = 0;
    const coveredDays: Map<string, Set<number>> = new Map();
    const partialDays: Map<string, Set<number>> = new Map();
    let coveredDayCount = 0;
    let partialDayCount = 0;
    let totalDays = 0;
    const { rangeDays } = this;

    const stations = stationKey ? new Set([stationKey]) : this.selectedStations;
    stations.forEach(sk => {
      totalDays += rangeDays;
      const stats = this.coverage.get(coverageKey(sk, modelUrl));
      if (stats?.state !== "loaded") return;

      const stationCoveredDays = new Set<number>();
      coveredDays.set(sk, stationCoveredDays);
      const stationPartialDays = new Set<number>();
      partialDays.set(sk, stationPartialDays);
      eventCount += stats.eventCount ?? 0;
      stats.dayStates?.forEach((state, day) => {
        if (state === "covered") {
          stationCoveredDays.add(day);
          coveredDayCount++;
        } else if (state === "partial") {
          stationPartialDays.add(day);
          partialDayCount++;
        }
      });
    });

    return { eventCount, coveredDays, partialDays, coveredDayCount, partialDayCount, totalDays };
  }

  async refresh() {
    const opfs = await this.cache.listStations();
    const merged = mergeStations(opfs, this.deps.stations ?? []);
    runInAction(() => {
      this.stations = merged;
      // A restored selection may name stations that no longer exist.
      for (const key of [...this.selectedStations]) {
        if (!merged.has(key)) this.selectedStations.delete(key);
      }
      // Select everything by default, but never override a selection the user saved.
      if (this.selectedStations.size === 0 && !this.hasSavedStationSelection) {
        for (const key of merged.keys()) this.selectedStations.add(key);
      }
      // A cached metadata failure may have been transient; refresh retries it.
      // Successful entries stay cached.
      for (const [url, value] of [...this.modelMetadata]) {
        if (value === "error") this.modelMetadata.delete(url);
      }
    });
    await this.loadAllStats();
    await this.loadAllCoverageStats();
  }

  async loadAllStats() {
    for (const s of this.stations.values()) await this.loadStats(s);
  }

  get allStats(): StationStats {
    return {
      bytes: this.selectedBytes,
      missingCount: this.selectedMissingRawDays
    };
  }

  statsFor(key: string): StationStats {
    return this.stats.get(key) ?? { bytes: 0, missingCount: 0 };
  }

  private async loadStats(s: StationConfig) {
    const { firstDay, lastDay } = this;
    if (firstDay === undefined || lastDay === undefined) return;

    const cachedDays = await this.cache.scanCachedDays(s, firstDay, lastDay);
    const bytes = await this.cache.stationRawBytes(s, firstDay, lastDay);
    const missingCount = missingDayCount(cachedDays.size, firstDay, lastDay);
    runInAction(() => {
      this.stats.set(getStationChannelPrefix(s), { cachedDays, bytes, missingCount });
    });
  }

  async deleteRaw(key: string) {
    const { firstDay, lastDay } = this;
    const s = this.stations.get(key);
    if (!s || firstDay === undefined || lastDay === undefined) return;

    await this.cache.deleteDaysInRange(s, firstDay, lastDay);
    await this.loadStats(s);
  }

  setFeedback(message: string) {
    this.feedback = message;
  }

  setAuthReady(ready = true) {
    this.authReady = ready;
    // Coverage loads are gated on auth; kick them off only when auth becomes ready.
    if (ready) void this.loadAllCoverageStats();
  }

  async downloadStation(key: string) {
    const s = this.stations.get(key);
    if (!s) return;

    await this.download(s);
    this.setFeedback(`Finished downloading data for ${stationLabel(s)}.`);
  }

  async deleteAllSelected() {
    for (const key of this.selectedStations) await this.deleteRaw(key);
  }

  async downloadAllSelected() {
    // Download stations sequentially to ensure shared-proxy limit is respected
    const stations = this.selectedStationList;
    for (let i = 0; i < stations.length; i++) {
      await this.download(stations[i], `Station ${i + 1} of ${stations.length} — `);
    }
    this.setFeedback(`Finished downloading data for ${stations.length} station${stations.length === 1 ? "" : "s"}.`);
  }

  /** Fold a freshly-downloaded day into a station's stats so its timeline fills in live. */
  markDayCached(key: string, day: number, bytes: number) {
    const stats = this.stats.get(key);
    // Guard against a repeated day: it would double-count bytes and drive missingCount negative.
    if (!stats?.cachedDays || stats.cachedDays.has(day)) return;

    stats.cachedDays.add(day);
    stats.missingCount--;
    stats.bytes += bytes;
  }

  private async download(s: StationConfig, prefix = "") {
    if (this.firstSec === undefined || this.lastSec === undefined) return;

    const run = this.deps.downloadStation ?? defaultDownloadStation;
    const name = stationLabel(s);
    const key = getStationChannelPrefix(s);
    const genericFeedback = `${prefix}Downloading data for ${name}...`;
    this.setFeedback(genericFeedback);
    await run(s, this.firstSec, this.lastSec, ({ completed, total, day, bytes }) => {
      if (day !== undefined) this.markDayCached(key, day, bytes ?? 0);
      // `total` is 0 until the first progress event arrives.
      this.setFeedback(total > 0
        ? `${prefix}Downloading day ${completed} of ${total} for ${name}`
        : genericFeedback);
    });
    // Reconcile against what's actually on disk; the incremental updates above are an estimate.
    await this.loadStats(s);
  }
}
