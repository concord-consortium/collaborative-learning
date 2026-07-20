import { coverageKey, SeismicAdminStore } from "./seismic-admin-store";
import { saveFilters } from "./utils/admin-persistence";
import { dayIndex, SECONDS_PER_DAY, utcDay } from "../../shared/seismic/seismic-day";
import { getStationChannelPrefix } from "../../shared/seismic/tile-addressing";

function fakeCache(cached: number[] = []) {
  return {
    listStations: jest.fn(async () => [{ network: "AK", station: "K204", channel: "HNZ" }]),
    scanCachedDays: jest.fn(async () => new Set(cached)),
    stationRawBytes: jest.fn(async () => 1234),
    deleteDaysInRange: jest.fn(async () => {}),
  };
}

beforeEach(() => window.localStorage.clear());

it("loads stations from OPFS and computes per-station stats for the range", async () => {
  const d30 = dayIndex(utcDay(2026, 1, 30));
  const store = new SeismicAdminStore({ cache: fakeCache([d30]) as any });
  store.setRange("2026-01-30", "2026-02-01");   // 3 days: 30, 31, 1
  await store.refresh();
  const key = [...store.stations.keys()][0];
  expect(store.statsFor(key).cachedDays?.has(d30)).toBe(true);
  expect(store.statsFor(key).bytes).toBe(1234);
  expect(store.statsFor(key).missingCount).toBe(2);
});

it("deletes a station's days in range via the cache", async () => {
  const cache = fakeCache([dayIndex(utcDay(2026, 1, 30))]);
  const store = new SeismicAdminStore({ cache: cache as any });
  store.setRange("2026-01-30", "2026-02-02");
  await store.refresh();
  await store.deleteRaw([...store.stations.keys()][0]);
  expect(cache.deleteDaysInRange).toHaveBeenCalled();
});

it("downloads selected stations sequentially", async () => {
  const runner = jest.fn(async () => {});
  const stations = [{ network: "AK", station: "K204", location: "", channel: "HNZ", label: "x" }];
  const store = new SeismicAdminStore({ cache: fakeCache() as any, stations, downloadStation: runner });
  store.setRange("2026-01-30", "2026-02-02");
  await store.refresh();
  await store.downloadAllSelected();
  expect(runner).toHaveBeenCalledTimes(1);
});

describe("download feedback", () => {
  const stations = [{ network: "AK", station: "RC01", location: "", channel: "BHZ", label: "Rabbit Creek" }];

  it("reports day progress for a single station, then completion", async () => {
    const seen: string[] = [];
    const downloadStation = jest.fn(async (_s: any, _a: number, _b: number, onProgress?: any) => {
      onProgress?.({ completed: 0, total: 3 });
      seen.push(store.feedback);
      onProgress?.({ completed: 2, total: 3 });
      seen.push(store.feedback);
    });
    const store = new SeismicAdminStore({ cache: fakeCache() as any, stations, downloadStation });
    await store.refresh();

    await store.downloadStation([...store.stations.keys()].find(k => k.includes("RC01"))!);
    expect(seen).toEqual([
      "Downloading day 0 of 3 for Rabbit Creek",
      "Downloading day 2 of 3 for Rabbit Creek",
    ]);
    expect(store.feedback).toBe("Finished downloading data for Rabbit Creek.");
  });

  it("prefixes each station's progress when downloading all selected", async () => {
    const seen: string[] = [];
    const downloadStation = jest.fn(async (_s: any, _a: number, _b: number, onProgress?: any) => {
      onProgress?.({ completed: 1, total: 2 });
      seen.push(store.feedback);
    });
    const store = new SeismicAdminStore({ cache: fakeCache() as any, stations, downloadStation });
    await store.refresh();

    await store.downloadAllSelected();
    // K204 (from OPFS) and RC01 (from the catalog) are both selected.
    expect(seen).toEqual([
      "Station 1 of 2 — Downloading day 1 of 2 for AK K204 HNZ",
      "Station 2 of 2 — Downloading day 1 of 2 for Rabbit Creek",
    ]);
    expect(store.feedback).toBe("Finished downloading data for 2 stations.");
  });

  it("is idle before any download", () => {
    const store = new SeismicAdminStore({ cache: fakeCache() as any });
    expect(store.feedback).toBe("");
  });
});

describe("live stats updates", () => {
  const d30 = dayIndex(utcDay(2026, 1, 30));

  /** Snapshot the mutable stats entry, since it's updated in place. */
  const snapshot = (store: SeismicAdminStore, key: string) => {
    const s = store.statsFor(key);
    return { days: s.cachedDays?.size, bytes: s.bytes, missing: s.missingCount };
  };

  it("folds each downloaded day into the station's stats as it lands", async () => {
    const seen: any[] = [];
    let key = "";
    const downloadStation = jest.fn(async (_s: any, _a: number, _b: number, onProgress?: any) => {
      onProgress?.({ completed: 1, total: 3, day: d30, bytes: 500 });
      seen.push(snapshot(store, key));
      // A repeated day must not double-count bytes or drive missingCount negative.
      onProgress?.({ completed: 1, total: 3, day: d30, bytes: 500 });
      seen.push(snapshot(store, key));
    });
    const store = new SeismicAdminStore({ cache: fakeCache() as any, downloadStation });
    store.setRange("2026-01-30", "2026-02-01");   // 3 days, none cached
    await store.refresh();
    key = [...store.stations.keys()][0];

    await store.downloadStation(key);
    // starts at 0 cached / 1234 bytes / 3 missing, then the one day lands
    expect(seen[0]).toEqual({ days: 1, bytes: 1734, missing: 2 });
    expect(seen[1]).toEqual({ days: 1, bytes: 1734, missing: 2 });
  });

  it("ignores a day for a station with no stats loaded", () => {
    const store = new SeismicAdminStore({ cache: fakeCache() as any });
    expect(() => store.markDayCached("AK_NONE/BHZ", d30, 500)).not.toThrow();
  });
});

describe("persisted filters", () => {
  it("restores the saved range and selection", async () => {
    saveFilters({ startDate: "2026-01-30", endDate: "2026-02-02", selectedStations: [] });
    const store = new SeismicAdminStore({ cache: fakeCache() as any });
    expect(store.startDate).toBe("2026-01-30");
    expect(store.endDate).toBe("2026-02-02");

    // An explicitly-empty saved selection must survive refresh's select-all default.
    await store.refresh();
    expect(store.selectedStations.size).toBe(0);
  });

  it("selects every station when nothing was ever saved", async () => {
    const store = new SeismicAdminStore({ cache: fakeCache() as any });
    await store.refresh();
    expect(store.selectedStations.size).toBe(1);
  });

  it("drops a saved station that no longer exists", async () => {
    saveFilters({ selectedStations: ["AK_GONE_BHZ"] });
    const store = new SeismicAdminStore({ cache: fakeCache() as any });
    await store.refresh();
    expect(store.selectedStations.size).toBe(0);
  });

  it("persists the range and selection as they change", async () => {
    const store = new SeismicAdminStore({ cache: fakeCache() as any });
    await store.refresh();
    const key = [...store.stations.keys()][0];
    store.setRange("2026-01-30", "2026-02-02");
    store.toggleStation(key);

    // A fresh store reads back what the first one wrote.
    const reloaded = new SeismicAdminStore({ cache: fakeCache() as any });
    expect(reloaded.startDate).toBe("2026-01-30");
    expect(reloaded.selectedStations.has(key)).toBe(false);
  });
});

describe("model selection", () => {
  const twoModels = [
    { label: "Compact", metadataUrl: "https://x/compact.json" },
    { label: "Large", metadataUrl: "https://x/large.json" },
  ];

  it("selects all models by default and toggles/persists selection", () => {
    const store = new SeismicAdminStore({ cache: fakeCache() as any, models: twoModels });
    expect([...store.selectedModels]).toEqual(twoModels.map(m => m.metadataUrl));
    expect(store.selectedModelList).toEqual(twoModels);

    store.toggleModel(twoModels[0].metadataUrl);
    expect(store.selectedModels.has(twoModels[0].metadataUrl)).toBe(false);
    expect(store.selectedModelList).toEqual([twoModels[1]]);

    // A fresh store reads back what the first one wrote.
    const reloaded = new SeismicAdminStore({ cache: fakeCache() as any, models: twoModels });
    expect([...reloaded.selectedModels]).toEqual([twoModels[1].metadataUrl]);

    // Toggling back on persists too.
    store.toggleModel(twoModels[0].metadataUrl);
    expect(store.selectedModels.has(twoModels[0].metadataUrl)).toBe(true);
  });

  it("restores a saved model selection, pruning unknown urls, without re-selecting all", () => {
    saveFilters({ selectedModels: [twoModels[0].metadataUrl, "https://x/gone.json"] });
    const store = new SeismicAdminStore({ cache: fakeCache() as any, models: twoModels });
    expect([...store.selectedModels]).toEqual([twoModels[0].metadataUrl]);
  });

  it("keeps an explicitly-empty saved model selection empty", () => {
    saveFilters({ selectedModels: [] });
    const store = new SeismicAdminStore({ cache: fakeCache() as any, models: twoModels });
    expect(store.selectedModels.size).toBe(0);
  });

  it("ensureModelMetadata fetches once per url, caches, and records errors", async () => {
    const metadata = { id: "compact-v1" } as any;
    const fetchMetadata = jest.fn().mockResolvedValueOnce(metadata);
    const store = new SeismicAdminStore({ cache: fakeCache() as any, models: twoModels, fetchMetadata });

    // The observable map wraps stored objects, so compare by value; the call
    // count below is what proves the second read came from the cache.
    expect(await store.ensureModelMetadata(twoModels[0].metadataUrl)).toEqual(metadata);
    expect(await store.ensureModelMetadata(twoModels[0].metadataUrl)).toEqual(metadata);
    expect(fetchMetadata).toHaveBeenCalledTimes(1);

    fetchMetadata.mockRejectedValueOnce(new Error("nope"));
    expect(await store.ensureModelMetadata(twoModels[1].metadataUrl)).toBeUndefined();
    // The error is cached: no re-fetch on the second ask.
    expect(await store.ensureModelMetadata(twoModels[1].metadataUrl)).toBeUndefined();
    expect(fetchMetadata).toHaveBeenCalledTimes(2);
  });

  it("refresh clears cached metadata errors so they retry, keeping successes cached", async () => {
    const metadata = { id: "compact-v1" } as any;
    const fetchMetadata = jest.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(metadata);
    const store = new SeismicAdminStore({ cache: fakeCache() as any, models: twoModels, fetchMetadata });

    // A transient failure is cached as an error...
    expect(await store.ensureModelMetadata(twoModels[0].metadataUrl)).toBeUndefined();
    // ...until the next refresh, which becomes the retry path.
    await store.refresh();
    expect(await store.ensureModelMetadata(twoModels[0].metadataUrl)).toEqual(metadata);
    expect(fetchMetadata).toHaveBeenCalledTimes(2);

    // A successful entry stays cached across refresh: no third fetch.
    await store.refresh();
    expect(await store.ensureModelMetadata(twoModels[0].metadataUrl)).toEqual(metadata);
    expect(fetchMetadata).toHaveBeenCalledTimes(2);
  });
});

describe("coverage stats", () => {
  const rc01 = { network: "AK", station: "RC01", location: "", channel: "BHZ", label: "Rabbit Creek" };
  const rc02 = { network: "AK", station: "RC02", location: "", channel: "BHZ", label: "Rabbit Creek 2" };
  const model = { label: "Compact", metadataUrl: "https://x/compact.json" };
  const metadata = { id: "compact-v1" } as any;
  const rc01Key = getStationChannelPrefix(rc01);
  const rc02Key = getStationChannelPrefix(rc02);
  const day0 = utcDay(2026, 1, 1)!;

  /** A cache with no OPFS stations, so the store's stations come only from deps. */
  const emptyCache = () => ({
    listStations: jest.fn(async () => []),
    scanCachedDays: jest.fn(async () => new Set<number>()),
    stationRawBytes: jest.fn(async () => 0),
    deleteDaysInRange: jest.fn(async () => {}),
  });

  function makeCoverageStore(overrides: any = {}) {
    const eventService = {
      getUncoveredRanges: jest.fn(async (_s: any, _m: string, _r: any) =>
        [] as Array<{ start: number; end: number }>),
      loadEvents: jest.fn(async (_s: any, _m: string, _r: any) => [] as any[]),
    };
    const fetchMetadata = jest.fn(async () => metadata);
    const store = new SeismicAdminStore({
      cache: emptyCache() as any, stations: [rc01], models: [model],
      fetchMetadata, eventService, ...overrides,
    });
    return { store, eventService, fetchMetadata };
  }

  const flush = () => new Promise(resolve => setTimeout(resolve, 0));

  it("loadCoverageStats stores loaded dayStates and eventCount under stationKey|modelUrl", async () => {
    const { store, eventService } = makeCoverageStore();
    eventService.loadEvents.mockResolvedValue([{ windowStart: 1 }, { windowStart: 2 }] as any);
    store.setAuthReady();
    store.setRange("2026-01-01", "2026-01-03");
    await store.loadCoverageStats(rc01, model.metadataUrl);

    const stats = store.coverage.get(coverageKey(rc01Key, model.metadataUrl));
    expect(stats?.state).toBe("loaded");
    expect(stats?.eventCount).toBe(2);
    expect(stats?.dayStates?.size).toBe(3);
    expect([...stats!.dayStates!.values()]).toEqual(["covered", "covered", "covered"]);
  });

  it("passes the endDate-inclusive range to the event service", async () => {
    const { store, eventService } = makeCoverageStore();
    store.setAuthReady();
    store.setRange("2026-01-01", "2026-01-03");
    await store.loadCoverageStats(rc01, model.metadataUrl);

    // endDate is inclusive: the range extends through the end of Jan 3 UTC.
    const range = { start: utcDay(2026, 1, 1), end: utcDay(2026, 1, 4) };
    expect(eventService.getUncoveredRanges).toHaveBeenCalledWith(rc01, "compact-v1", range);
    expect(eventService.loadEvents).toHaveBeenCalledWith(rc01, "compact-v1", range);
  });

  it("records an error state when the event service rejects", async () => {
    const { store, eventService } = makeCoverageStore();
    eventService.getUncoveredRanges.mockRejectedValue(new Error("offline"));
    store.setAuthReady();
    await store.loadCoverageStats(rc01, model.metadataUrl);

    expect(store.coverage.get(coverageKey(rc01Key, model.metadataUrl))).toEqual({ state: "error" });
  });

  it("records an error state when metadata fails to load", async () => {
    const { store, eventService, fetchMetadata } = makeCoverageStore();
    fetchMetadata.mockRejectedValue(new Error("nope"));
    store.setAuthReady();
    await store.loadCoverageStats(rc01, model.metadataUrl);

    expect(store.coverage.get(coverageKey(rc01Key, model.metadataUrl))).toEqual({ state: "error" });
    expect(eventService.getUncoveredRanges).not.toHaveBeenCalled();
  });

  it("does nothing before authReady", async () => {
    const { store, eventService } = makeCoverageStore();
    await store.loadCoverageStats(rc01, model.metadataUrl);

    expect(store.coverage.size).toBe(0);
    expect(eventService.getUncoveredRanges).not.toHaveBeenCalled();
  });

  it("setAuthReady triggers a coverage load for selected station × model pairs", async () => {
    const { store, eventService } = makeCoverageStore({ stations: [rc01, rc02] });
    await store.refresh();
    expect(store.selectedStations.size).toBe(2);

    store.setAuthReady();
    await flush();
    expect(eventService.getUncoveredRanges).toHaveBeenCalledTimes(2);
    expect(store.coverage.get(coverageKey(rc01Key, model.metadataUrl))?.state).toBe("loaded");
    expect(store.coverage.get(coverageKey(rc02Key, model.metadataUrl))?.state).toBe("loaded");

    // Becoming un-ready must not trigger another load.
    eventService.getUncoveredRanges.mockClear();
    store.setAuthReady(false);
    await flush();
    expect(eventService.getUncoveredRanges).not.toHaveBeenCalled();
  });

  it("coverageFor returns pending for unknown keys", () => {
    const { store } = makeCoverageStore();
    expect(store.coverageFor("AK_NONE/BHZ", model.metadataUrl)).toEqual({ state: "pending" });
  });

  describe("isFullyCovered", () => {
    it("is true when every selected pair is loaded with all days covered", async () => {
      const { store } = makeCoverageStore();
      store.setRange("2026-01-01", "2026-01-03");
      await store.refresh();
      store.setAuthReady();
      await flush();
      expect(store.isFullyCovered()).toBe(true);
      expect(store.isFullyCovered(rc01Key)).toBe(true);
    });

    it("is false when any pair is partial, pending, or error", async () => {
      // partial: a sub-day gap
      const partial = makeCoverageStore();
      partial.eventService.getUncoveredRanges.mockResolvedValue([{ start: day0 + 600, end: day0 + 1200 }]);
      partial.store.setRange("2026-01-01", "2026-01-03");
      await partial.store.refresh();
      partial.store.setAuthReady();
      await flush();
      expect(partial.store.isFullyCovered()).toBe(false);

      // pending: authReady but nothing loaded yet
      const pending = makeCoverageStore();
      await pending.store.refresh();
      expect(pending.store.isFullyCovered()).toBe(false);

      // error: the event service rejects
      const errored = makeCoverageStore();
      errored.eventService.getUncoveredRanges.mockRejectedValue(new Error("offline"));
      await errored.store.refresh();
      errored.store.setAuthReady();
      await flush();
      expect(errored.store.isFullyCovered()).toBe(false);
    });

    it("is false when no models are selected", async () => {
      const { store } = makeCoverageStore({ models: [] });
      await store.refresh();
      store.setAuthReady();
      expect(store.isFullyCovered()).toBe(false);
    });

    it("is false when no stations are selected", () => {
      const { store } = makeCoverageStore();
      store.setAuthReady();
      expect(store.selectedStations.size).toBe(0);
      expect(store.isFullyCovered()).toBe(false);
    });

    it("scopes to one station when a key is given", async () => {
      const { store, eventService } = makeCoverageStore({ stations: [rc01, rc02] });
      // rc02 has an uncovered day; rc01 is fully covered.
      eventService.getUncoveredRanges.mockImplementation(async (s: any) =>
        s.station === "RC02" ? [{ start: day0, end: day0 + SECONDS_PER_DAY }] : []);
      store.setRange("2026-01-01", "2026-01-03");
      await store.refresh();
      store.setAuthReady();
      await flush();

      expect(store.isFullyCovered(rc01Key)).toBe(true);
      expect(store.isFullyCovered(rc02Key)).toBe(false);
      expect(store.isFullyCovered()).toBe(false);
    });
  });

  it("modelAggregate sums event counts and covered days across selected stations", async () => {
    const { store, eventService } = makeCoverageStore({ stations: [rc01, rc02] });
    // rc01: all 3 days covered, 2 events; rc02: one whole-day gap → 2 covered days, 1 event.
    eventService.getUncoveredRanges.mockImplementation(async (s: any) =>
      s.station === "RC02" ? [{ start: day0, end: day0 + SECONDS_PER_DAY }] : []);
    eventService.loadEvents.mockImplementation(async (s: any) =>
      s.station === "RC02" ? [{ windowStart: 1 }] : [{ windowStart: 1 }, { windowStart: 2 }]);
    store.setRange("2026-01-01", "2026-01-03");
    await store.refresh();
    store.setAuthReady();
    await flush();

    expect(store.modelAggregate(model.metadataUrl)).toEqual({ eventCount: 3, coveredDays: 5, totalDays: 6 });
  });
});

it("authReady defaults false and is set by setAuthReady", () => {
  const store = new SeismicAdminStore({ cache: fakeCache() as any });
  expect(store.authReady).toBe(false);
  store.setAuthReady();
  expect(store.authReady).toBe(true);
  store.setAuthReady(false);
  expect(store.authReady).toBe(false);
});
