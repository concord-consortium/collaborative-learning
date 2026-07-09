import { makeAutoObservable, runInAction } from "mobx";
import { createOpfsCache, SeismicCache } from "../../shared/seismic/opfs-seismic-cache";
import { dayIndex, lastDayIndex, utcDayFromString } from "../../shared/seismic/seismic-day";
import { StationConfig } from "../../shared/seismic/seismic-types";
import { getStationChannelPrefix } from "../../shared/seismic/tile-addressing";
import { DONE, SeismicDownloadService } from "../models/stores/seismic-download-service";
import { mergeStations, missingDayCount } from "./seismic-admin-utils";

type AdminCache = Pick<SeismicCache, "listStations" | "scanCachedDays" | "stationRawBytes" | "deleteDaysInRange">;

/** Download one station's missing days into OPFS and wait for completion. Production default;
 *  tests inject their own to bypass the Web Worker. */
async function defaultDownloadStation(station: StationConfig, startSec: number, endSec: number) {
  const service = new SeismicDownloadService();
  service.ensureRange({
    network: station.network, station: station.station, channel: station.channel,
    location: station.location ?? "", startSec, endSec,
  });
  // Drain the ready queue until the download reports done.
  while ((await service.nextReadyDay()) !== DONE) { /* wait */ }
}

export interface SeismicAdminDeps {
  cache?: AdminCache;
  catalog?: StationConfig[];
  downloadStation?: (station: StationConfig, startSec: number, endSec: number) => Promise<void>;
}

interface StationStats { cachedDays: Set<number>; bytes: number; missingCount: number; }

export class SeismicAdminStore {
  startDate = "2026-01-01";
  endDate = "2026-01-31";
  stations = new Map<string, StationConfig>();   // keyed by getStationChannelPrefix
  selected = new Set<string>();                  // same keys
  stats = new Map<string, StationStats>();

  private cache: AdminCache;

  constructor(private deps: SeismicAdminDeps = {}) {
    this.cache = deps.cache ?? createOpfsCache();
    // `deps` and `cache` are injected dependencies, not observable state.
    makeAutoObservable<SeismicAdminStore, "deps" | "cache">(
      this, { deps: false, cache: false }, { autoBind: true });
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
    if (this.firstSec) return dayIndex(this.firstSec);
  }

  private get lastSec() {
    return utcDayFromString(this.endDate);
  }

  get lastDay() {
    if (this.lastSec) return lastDayIndex(this.lastSec);
  }

  get selectedMissingRawDays() {
    let total = 0;
    this.selected.forEach(key => {
      total += this.stats.get(key)?.missingCount ?? 0;
    });
    return total;
  }

  setRange(start: string, end: string) {
    this.startDate = start;
    this.endDate = end;
  }

  toggle(key: string) {
    if (this.selected.has(key)) {
      this.selected.delete(key);
    } else {
      this.selected.add(key);
    }
  }

  async refresh() {
    const opfs = await this.cache.listStations();
    const merged = mergeStations(opfs, this.deps.catalog ?? []);
    runInAction(() => {
      this.stations = merged;
      if (this.selected.size === 0) {
        for (const key of merged.keys()) this.selected.add(key);
      }
    });
    for (const s of merged.values()) await this.loadStats(s);
  }

  statsFor(key: string) { return this.stats.get(key)!; }

  private async loadStats(s: StationConfig) {
    if (!(this.firstDay && this.lastDay)) return;

    const cachedDays = await this.cache.scanCachedDays(s, this.firstDay, this.lastDay);
    const bytes = await this.cache.stationRawBytes(s, this.firstDay, this.lastDay);
    const missingCount = missingDayCount(cachedDays.size, this.firstDay, this.lastDay);
    runInAction(() => {
      this.stats.set(getStationChannelPrefix(s), { cachedDays, bytes, missingCount });
    });
  }

  async deleteRaw(key: string) {
    const s = this.stations.get(key);
    if (!(s && this.firstDay && this.lastDay)) return;

    await this.cache.deleteDaysInRange(s, this.firstDay, this.lastDay);
    await this.loadStats(s);
  }

  async downloadStation(key: string) {
    const s = this.stations.get(key);
    if (s) await this.download(s);
  }

  async deleteAllSelected() {
    for (const key of this.selected) await this.deleteRaw(key);
  }

  async downloadAllSelected() {
    // Download stations sequentially to ensure shared-proxy limit is respected
    for (const s of this.selectedStations) await this.download(s);
  }

  private async download(s: StationConfig) {
    if (this.firstSec === undefined || this.lastSec === undefined) return;

    const run = this.deps.downloadStation ?? defaultDownloadStation;
    await run(s, this.firstSec, this.lastSec);
    await this.loadStats(s);
  }
}
