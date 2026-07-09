import { SeismicAdminStore } from "./seismic-admin-store";
import { saveFilters } from "./utils/admin-persistence";
import { dayIndex, utcDay } from "../../shared/seismic/seismic-day";

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
  store.setRange("2026-01-30", "2026-02-02");   // 3 days: 30, 31, 1 (end exclusive)
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
  const catalog = [{ network: "AK", station: "K204", location: "--", channel: "HNZ", label: "x" }];
  const store = new SeismicAdminStore({ cache: fakeCache() as any, catalog, downloadStation: runner });
  store.setRange("2026-01-30", "2026-02-02");
  await store.refresh();
  await store.downloadAllSelected();
  expect(runner).toHaveBeenCalledTimes(1);
});

describe("download feedback", () => {
  const catalog = [{ network: "AK", station: "RC01", location: "", channel: "BHZ", label: "Rabbit Creek" }];

  it("reports day progress for a single station, then completion", async () => {
    const seen: string[] = [];
    const downloadStation = jest.fn(async (_s: any, _a: number, _b: number, onProgress?: any) => {
      onProgress?.({ completed: 0, total: 3 });
      seen.push(store.feedback);
      onProgress?.({ completed: 2, total: 3 });
      seen.push(store.feedback);
    });
    const store = new SeismicAdminStore({ cache: fakeCache() as any, catalog, downloadStation });
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
    const store = new SeismicAdminStore({ cache: fakeCache() as any, catalog, downloadStation });
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
    store.setRange("2026-01-30", "2026-02-02");   // 3 days, none cached
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
    saveFilters({ startDate: "2026-01-30", endDate: "2026-02-02", selected: [] });
    const store = new SeismicAdminStore({ cache: fakeCache() as any });
    expect(store.startDate).toBe("2026-01-30");
    expect(store.endDate).toBe("2026-02-02");

    // An explicitly-empty saved selection must survive refresh's select-all default.
    await store.refresh();
    expect(store.selected.size).toBe(0);
  });

  it("selects every station when nothing was ever saved", async () => {
    const store = new SeismicAdminStore({ cache: fakeCache() as any });
    await store.refresh();
    expect(store.selected.size).toBe(1);
  });

  it("drops a saved station that no longer exists", async () => {
    saveFilters({ selected: ["AK_GONE_BHZ"] });
    const store = new SeismicAdminStore({ cache: fakeCache() as any });
    await store.refresh();
    expect(store.selected.size).toBe(0);
  });

  it("persists the range and selection as they change", async () => {
    const store = new SeismicAdminStore({ cache: fakeCache() as any });
    await store.refresh();
    const key = [...store.stations.keys()][0];
    store.setRange("2026-01-30", "2026-02-02");
    store.toggle(key);

    // A fresh store reads back what the first one wrote.
    const reloaded = new SeismicAdminStore({ cache: fakeCache() as any });
    expect(reloaded.startDate).toBe("2026-01-30");
    expect(reloaded.selected.has(key)).toBe(false);
  });
});
