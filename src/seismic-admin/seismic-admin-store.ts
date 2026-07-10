import { makeAutoObservable, runInAction } from "mobx";
import { createOpfsCache, SeismicCache } from "../../shared/seismic/opfs-seismic-cache";
import { dayIndex, lastDayIndex, utcDayFromString } from "../../shared/seismic/seismic-day";
import { StationConfig } from "../../shared/seismic/seismic-types";
import { getStationChannelPrefix } from "../../shared/seismic/tile-addressing";
import { DONE, SeismicDownloadService } from "../models/stores/seismic-download-service";
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
  catalog?: StationConfig[];
  downloadStation?: (
    station: StationConfig, startSec: number, endSec: number, onProgress?: DownloadProgress
  ) => Promise<void>;
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
  selected = new Set<string>();                  // same keys
  stats = new Map<string, StationStats>();
  feedback = "";

  private cache: AdminCache;
  // True once a selection has been persisted, so refresh() won't re-select everything.
  private hasSavedSelection = false;

  constructor(private deps: SeismicAdminDeps = {}) {
    this.cache = deps.cache ?? createOpfsCache();

    const saved = loadFilters();
    if (saved.startDate) this.startDate = saved.startDate;
    if (saved.endDate) this.endDate = saved.endDate;
    if (saved.selected) {
      this.selected = new Set(saved.selected);
      this.hasSavedSelection = true;
    }

    // `deps` and `cache` are injected dependencies, not observable state.
    makeAutoObservable<SeismicAdminStore, "deps" | "cache">(
      this, { deps: false, cache: false }, { autoBind: true });
  }

  private save() {
    saveFilters({ startDate: this.startDate, endDate: this.endDate, selected: [...this.selected] });
  }

  get selectedStations() {
    const selectedStations: StationConfig[] = [];
    this.selected.forEach(key => {
      const station = this.stations.get(key);
      if (station) selectedStations.push(station);
    });
    return selectedStations;
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
    if (lastSec) return lastDayIndex(lastSec);
  }

  get selectedMissingRawDays() {
    let total = 0;
    this.selected.forEach(key => {
      total += this.stats.get(key)?.missingCount ?? 0;
    });
    return total;
  }

  get selectedBytes() {
    let total = 0;
    this.selected.forEach(key => {
      total += this.stats.get(key)?.bytes ?? 0;
    });
    return total;
  }

  setRange(start: string, end: string) {
    this.startDate = start;
    this.endDate = end;
    this.save();
    void this.loadAllStats();
  }

  toggle(key: string) {
    if (this.selected.has(key)) {
      this.selected.delete(key);
    } else {
      this.selected.add(key);
    }
    this.hasSavedSelection = true;
    this.save();
  }

  async refresh() {
    const opfs = await this.cache.listStations();
    const merged = mergeStations(opfs, this.deps.catalog ?? []);
    runInAction(() => {
      this.stations = merged;
      // A restored selection may name stations that no longer exist.
      for (const key of [...this.selected]) {
        if (!merged.has(key)) this.selected.delete(key);
      }
      // Select everything by default, but never override a selection the user saved.
      if (this.selected.size === 0 && !this.hasSavedSelection) {
        for (const key of merged.keys()) this.selected.add(key);
      }
    });
    await this.loadAllStats();
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

  async downloadStation(key: string) {
    const s = this.stations.get(key);
    if (!s) return;

    await this.download(s);
    this.setFeedback(`Finished downloading data for ${stationLabel(s)}.`);
  }

  async deleteAllSelected() {
    for (const key of this.selected) await this.deleteRaw(key);
  }

  async downloadAllSelected() {
    // Download stations sequentially to ensure shared-proxy limit is respected
    const stations = this.selectedStations;
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
