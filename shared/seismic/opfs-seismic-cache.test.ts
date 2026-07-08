import { createOpfsCache } from "./opfs-seismic-cache";
import { FakeDirHandle } from "./fake-opfs";
import { dayIndex, utcDay } from "./seismic-day";
import { StationData } from "./seismic-types";

const STA: StationData = { network: "AK", station: "K204", channel: "HNZ" };
const bytes = (n: number) => new Uint8Array([n, n, n]).buffer;

describe("opfs-seismic-cache", () => {
  it("writes then reads back a day chunk", async () => {
    const root = new FakeDirHandle();
    const cache = createOpfsCache(async () => root as any);
    const day = dayIndex(utcDay(2026, 1, 30));
    await cache.writeDayChunk(STA, day, bytes(7));
    const read = await cache.readDayChunk(STA, day);
    expect(read && new Uint8Array(read)).toEqual(new Uint8Array([7, 7, 7]));
  });

  it("returns null for a day that was never written", async () => {
    const root = new FakeDirHandle();
    const cache = createOpfsCache(async () => root as any);
    expect(await cache.readDayChunk(STA, dayIndex(utcDay(2026, 1, 30)))).toBeNull();
  });

  it("scans only the cached days within a range", async () => {
    const root = new FakeDirHandle();
    const cache = createOpfsCache(async () => root as any);
    const d30 = dayIndex(utcDay(2026, 1, 30));
    const d31 = dayIndex(utcDay(2026, 1, 31));
    const d1 = dayIndex(utcDay(2026, 2, 1));
    await cache.writeDayChunk(STA, d30, bytes(1));
    await cache.writeDayChunk(STA, d1, bytes(1));
    const cached = await cache.scanCachedDays(STA, d30, d1);
    expect(cached).toEqual(new Set([d30, d1]));
    expect(cached.has(d31)).toBe(false);
  });

  it("lists the (network, station, channel) present in the cache", async () => {
    const root = new FakeDirHandle();
    const cache = createOpfsCache(async () => root as any);
    const day = dayIndex(utcDay(2026, 1, 30));
    await cache.writeDayChunk(STA, day, bytes(1));                                     // AK/K204/HNZ
    await cache.writeDayChunk({ network: "AK", station: "RC01", channel: "BHZ" }, day, bytes(1));
    const stations = await cache.listStations();
    expect(stations).toContainEqual({ network: "AK", station: "K204", channel: "HNZ" });
    expect(stations).toContainEqual({ network: "AK", station: "RC01", channel: "BHZ" });
  });

  it("sums bytes only for cached days within the range", async () => {
    const root = new FakeDirHandle();
    const cache = createOpfsCache(async () => root as any);
    const d30 = dayIndex(utcDay(2026, 1, 30));
    const d1 = dayIndex(utcDay(2026, 2, 1));
    await cache.writeDayChunk(STA, d30, new Uint8Array([1, 2, 3]).buffer);    // 3 bytes, in range
    await cache.writeDayChunk(STA, d1, new Uint8Array([1, 2, 3, 4]).buffer);  // 4 bytes, out of range
    expect(await cache.stationRawBytes(STA, d30, d30)).toBe(3);
  });

  it("deletes only day files within the range", async () => {
    const root = new FakeDirHandle();
    const cache = createOpfsCache(async () => root as any);
    const d30 = dayIndex(utcDay(2026, 1, 30));
    const d1 = dayIndex(utcDay(2026, 2, 1));
    await cache.writeDayChunk(STA, d30, bytes(1));
    await cache.writeDayChunk(STA, d1, bytes(1));
    await cache.deleteDaysInRange(STA, d30, d30);
    expect(await cache.readDayChunk(STA, d30)).toBeNull();
    expect(await cache.readDayChunk(STA, d1)).not.toBeNull();
  });
});
