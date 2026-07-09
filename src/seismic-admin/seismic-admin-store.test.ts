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
