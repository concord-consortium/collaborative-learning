import { downloadRange, DownloadEvent, DownloaderDeps } from "./seismic-downloader";
import { dayIndex, utcDay } from "./seismic-day";

const RANGE = { network: "AK", station: "K204", location: "--", channel: "HNZ",
  startSec: utcDay(2026, 1, 30), endSec: utcDay(2026, 2, 2) }; // 4 days incl: 30, 31, Feb 1, Feb 2

// Availability covering data through the end of the last day (Feb 2 → start of Feb 3).
const AVAILABLE = [{ start: utcDay(2026, 1, 30), end: utcDay(2026, 2, 3) }];

function collect() {
  const events: DownloadEvent[] = [];
  return { events, onEvent: (e: DownloadEvent) => events.push(e) };
}

function makeDeps(overrides: Partial<DownloaderDeps> = {}): DownloaderDeps {
  const written = new Set<number>();
  return {
    fetchAvailability: async () => AVAILABLE,
    fetchRaw: async () => new ArrayBuffer(1),
    cache: {
      scanCachedDays: async () => new Set<number>(),
      writeDayChunk: async (_s, day) => { written.add(day); },
    },
    ...overrides,
  };
}

describe("downloadRange", () => {
  it("downloads all available, uncached days and emits dayWritten + done", async () => {
    const deps = makeDeps();
    const { events, onEvent } = collect();
    await downloadRange(deps, RANGE, onEvent);

    const written = events.filter(e => e.type === "dayWritten").map(e => (e as any).day).sort();
    expect(written).toEqual([
      dayIndex(utcDay(2026, 1, 30)), dayIndex(utcDay(2026, 1, 31)),
      dayIndex(utcDay(2026, 2, 1)), dayIndex(utcDay(2026, 2, 2)),
    ]);
    expect(events.at(-1)).toEqual({ type: "done" });
  });

  it("reports the byte size of each freshly-written day", async () => {
    const deps = makeDeps({ fetchRaw: async () => new ArrayBuffer(512) });
    const { events, onEvent } = collect();
    await downloadRange(deps, RANGE, onEvent);

    const written = events.filter(e => e.type === "dayWritten");
    expect(written).toHaveLength(4);
    expect(written.every(e => (e as any).bytes === 512)).toBe(true);
  });

  it("omits the byte size for an already-cached day", async () => {
    const d30 = dayIndex(utcDay(2026, 1, 30));
    const deps = makeDeps({
      cache: { scanCachedDays: async () => new Set([d30]), writeDayChunk: async () => {} },
    });
    const { events, onEvent } = collect();
    await downloadRange(deps, RANGE, onEvent);

    const cachedEvent = events.find(e => e.type === "dayWritten" && (e as any).day === d30);
    expect((cachedEvent as any).bytes).toBeUndefined();
  });

  it("skips already-cached days but still reports them as ready", async () => {
    const d30 = dayIndex(utcDay(2026, 1, 30));
    const fetchRaw = jest.fn(async () => new ArrayBuffer(1));
    const deps = makeDeps({
      fetchRaw,
      cache: { scanCachedDays: async () => new Set([d30]), writeDayChunk: async () => {} },
    });
    const { events, onEvent } = collect();
    await downloadRange(deps, RANGE, onEvent);

    // d30 is reported ready without a fetch
    expect(fetchRaw).toHaveBeenCalledTimes(3);
    expect(events.some(e => e.type === "dayWritten" && (e as any).day === d30)).toBe(true);
  });

  it("emits dayEmpty for days with no availability and never fetches them", async () => {
    const d31 = dayIndex(utcDay(2026, 1, 31));
    const fetchRaw = jest.fn(async () => new ArrayBuffer(1));
    const deps = makeDeps({
      fetchRaw,
      // Available only for the 30th and the 1st–2nd; the 31st is a gap
      fetchAvailability: async () => [
        { start: utcDay(2026, 1, 30), end: utcDay(2026, 1, 31) },
        { start: utcDay(2026, 2, 1), end: utcDay(2026, 2, 3) },
      ],
    });
    const { events, onEvent } = collect();
    await downloadRange(deps, RANGE, onEvent);

    expect(events.some(e => e.type === "dayEmpty" && (e as any).day === d31)).toBe(true);
    expect(fetchRaw).toHaveBeenCalledTimes(3); // not the 31st
  });

  it("fetches the final day when the range ends on it (availability window must cover the whole day)", async () => {
    // Mimic the real endpoint: it only reports availability within the requested window.
    const dataStart = utcDay(2026, 1, 30), dataEnd = utcDay(2026, 2, 3); // station has data through Feb 2
    const fetchAvailability = jest.fn(async (q: any) => {
      const qStart = new Date(q.startTime).getTime() / 1000;
      const qEnd = new Date(q.endTime).getTime() / 1000;
      const start = Math.max(qStart, dataStart);
      const end = Math.min(qEnd, dataEnd);
      return end > start ? [{ start, end }] : [];
    });
    const fetchRaw = jest.fn(async () => new ArrayBuffer(1));
    const { events, onEvent } = collect();
    // endSec is midnight of the last wanted day (Feb 2), as the admin and tile pass it.
    await downloadRange(makeDeps({ fetchAvailability, fetchRaw }), { ...RANGE, endSec: utcDay(2026, 2, 2) }, onEvent);

    const feb2 = dayIndex(utcDay(2026, 2, 2));
    expect(events.some(e => e.type === "dayWritten" && (e as any).day === feb2)).toBe(true);
    expect(events.some(e => e.type === "dayEmpty" && (e as any).day === feb2)).toBe(false);
  });

  it("retries a failing day up to maxRetries, then emits dayError", async () => {
    let calls = 0;
    const fetchRaw = jest.fn(async () => { calls++; throw new Error("boom"); });
    const deps = makeDeps({
      fetchRaw,
      fetchAvailability: async () => [{ start: utcDay(2026, 1, 30), end: utcDay(2026, 1, 31) }],
    });
    const { events, onEvent } = collect();
    await downloadRange(deps, { ...RANGE, maxRetries: 3 }, onEvent);

    expect(calls).toBe(3);
    expect(events.some(e => e.type === "dayError")).toBe(true);
    expect(events.at(-1)).toEqual({ type: "done" });
  });

  it("never exceeds the concurrency limit", async () => {
    let active = 0, maxActive = 0;
    const fetchRaw = jest.fn(async () => {
      active++; maxActive = Math.max(maxActive, active);
      await new Promise(r => setTimeout(r, 5));
      active--; return new ArrayBuffer(1);
    });
    const deps = makeDeps({ fetchRaw });
    const { onEvent } = collect();
    await downloadRange(deps, { ...RANGE, concurrency: 2 }, onEvent);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it("emits a top-level error if availability fails", async () => {
    const deps = makeDeps({ fetchAvailability: async () => { throw new Error("no avail"); } });
    const { events, onEvent } = collect();
    await downloadRange(deps, RANGE, onEvent);
    expect(events.some(e => e.type === "error")).toBe(true);
  });
});
