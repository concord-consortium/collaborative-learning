# Seismic Bulk Downloader Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a ROVER-style browser bulk downloader that fetches EarthScope miniSEED day-chunks into OPFS with availability-based gap detection, a concurrent retrying queue, and resume, then wire it into the wave-runner ML run loop via per-day streaming prefetch.

**Architecture:** A pure, dependency-injected orchestration module (`seismic-downloader.ts`) drives availability → gap → concurrent-fetch → cache-write and emits per-day events. A Web Worker and a MobX service are thin shells around it; OPFS is the shared same-origin medium (worker writes, main thread reads). wave-runner consumes per-day "ready" signals and runs the model on each day as it lands.

**Tech Stack:** TypeScript, MobX (plain `makeAutoObservable`), Web Worker (Webpack 5 native `new Worker(new URL(...))`), OPFS (`navigator.storage.getDirectory()`), seisplotjs (parsing, in wave-runner only), Jest + jest-fetch-mock.

**Design doc:** `docs/plans/2026-07-01-seismic-bulk-downloader-design.md`

**Conventions for every task:**
- Run a single test file with: `npm test -- --no-watchman <path>` (the `--no-watchman` flag is required on this machine).
- Typecheck with: `npm run check:types`. Lint with: `npm run lint`.
- Tests are colocated `*.test.ts`; jsdom environment; use `jest-fetch-mock` for `fetch`.
- Commit after each task with the message shown.

---

### Task 1: UTC day helpers (`seismic-day.ts`)

Pure functions mapping Unix seconds ↔ UTC calendar day, plus day→ISO range and year/doy for OPFS paths. Everything else derives day identity from here.

**Files:**
- Create: `shared/seismic/seismic-day.ts`
- Test: `shared/seismic/seismic-day.test.ts`

**Step 1: Write the failing test**

```ts
// shared/seismic/seismic-day.test.ts
import {
  SECONDS_PER_DAY, utcDay, dayIndex, dayToYearDoy, dayToISORange, daysInRange,
} from "./seismic-day";

describe("seismic-day", () => {
  it("converts a UTC calendar date to unix seconds", () => {
    expect(utcDay(1970, 1, 1)).toBe(0);
    expect(utcDay(2026, 1, 30)).toBe(Date.UTC(2026, 0, 30) / 1000);
  });

  it("computes the UTC day index from unix seconds", () => {
    expect(dayIndex(utcDay(1970, 1, 1))).toBe(0);
    expect(dayIndex(utcDay(1970, 1, 2))).toBe(1);
    expect(dayIndex(utcDay(2026, 1, 30))).toBe(Math.floor(utcDay(2026, 1, 30) / SECONDS_PER_DAY));
    // Any instant within a day maps to the same index
    expect(dayIndex(utcDay(2026, 1, 30) + 3600)).toBe(dayIndex(utcDay(2026, 1, 30)));
  });

  it("converts a day index to UTC year and day-of-year", () => {
    expect(dayToYearDoy(dayIndex(utcDay(2026, 1, 1)))).toEqual({ year: 2026, doy: 1 });
    expect(dayToYearDoy(dayIndex(utcDay(2026, 2, 1)))).toEqual({ year: 2026, doy: 32 });
    expect(dayToYearDoy(dayIndex(utcDay(2024, 12, 31)))).toEqual({ year: 2024, doy: 366 }); // leap year
  });

  it("produces a day-aligned ISO range for a day index", () => {
    const { startISO, endISO } = dayToISORange(dayIndex(utcDay(2026, 1, 30)));
    expect(startISO).toBe("2026-01-30T00:00:00.000Z");
    expect(endISO).toBe("2026-01-31T00:00:00.000Z");
  });

  it("lists the day indices overlapping a [startSec, endSec) range", () => {
    const start = utcDay(2026, 1, 30);
    const end = utcDay(2026, 2, 2); // exclusive
    expect(daysInRange(start, end)).toEqual([
      dayIndex(utcDay(2026, 1, 30)), dayIndex(utcDay(2026, 1, 31)), dayIndex(utcDay(2026, 2, 1)),
    ]);
    // A partial final day is still included
    expect(daysInRange(start, end - 1).length).toBe(3);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --no-watchman shared/seismic/seismic-day.test.ts`
Expected: FAIL (module not found).

**Step 3: Write the implementation**

```ts
// shared/seismic/seismic-day.ts

/** Seconds in a UTC day. Day identity for the bulk cache is the UTC calendar day. */
export const SECONDS_PER_DAY = 86400;

/** UTC calendar date (1-based month) → Unix seconds. */
export function utcDay(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) / 1000;
}

/** Unix seconds → UTC day index (days since the Unix epoch). */
export function dayIndex(unixSec: number): number {
  return Math.floor(unixSec / SECONDS_PER_DAY);
}

/** Day index → UTC calendar year and day-of-year (1-based), for OPFS paths. */
export function dayToYearDoy(day: number): { year: number; doy: number } {
  const startMs = day * SECONDS_PER_DAY * 1000;
  const d = new Date(startMs);
  const year = d.getUTCFullYear();
  const yearStartMs = Date.UTC(year, 0, 1);
  const doy = Math.floor((startMs - yearStartMs) / (SECONDS_PER_DAY * 1000)) + 1;
  return { year, doy };
}

/** Day index → day-aligned ISO start/end (end exclusive), for dataselect requests. */
export function dayToISORange(day: number): { startISO: string; endISO: string } {
  const startISO = new Date(day * SECONDS_PER_DAY * 1000).toISOString();
  const endISO = new Date((day + 1) * SECONDS_PER_DAY * 1000).toISOString();
  return { startISO, endISO };
}

/** All UTC day indices overlapping [startSec, endSec). */
export function daysInRange(startSec: number, endSec: number): number[] {
  const first = dayIndex(startSec);
  const last = dayIndex(endSec - 1e-9); // endSec is exclusive
  const days: number[] = [];
  for (let d = first; d <= last; d++) days.push(d);
  return days;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --no-watchman shared/seismic/seismic-day.test.ts`
Expected: PASS (4 tests).

**Step 5: Commit**

```bash
git add shared/seismic/seismic-day.ts shared/seismic/seismic-day.test.ts
git commit -m "Add UTC day helpers for seismic bulk downloader"
```

---

### Task 2: `fetchAvailability` + mock fallback (earthscope-client)

Add availability querying to the existing client. In proxy mode it hits the FDSN availability service through CloudFront and parses the pipe-delimited text into `[startSec, endSec)` ranges. In mock/local mode (no `seismicProxy`) it falls back to "assume the whole requested range is available" so dev/test keeps working.

**Files:**
- Modify: `shared/seismic/earthscope-client.ts` (append `fetchAvailability`; also replace the private `utcDay` with an import from `./seismic-day` — see Step 3)
- Test: `shared/seismic/earthscope-client.test.ts` (add a `describe("fetchAvailability")` block)

**Step 1: Write the failing test** (append to the existing test file)

```ts
import { fetchRawSeismicData, fetchStationMetadata, fetchAvailability } from "./earthscope-client";
import { utcDay } from "./seismic-day";

// EarthScope availability text: Net|Sta|Loc|Chan|Quality|SampleRate|Earliest|Latest
const AVAILABILITY_TEXT = `#Network|Station|Location|Channel|Quality|SampleRate|Earliest|Latest
AK|K204|--|HNZ|M|100.0|2026-01-30T00:00:00.000000Z|2026-02-01T00:00:00.000000Z
AK|K204|--|HNZ|M|100.0|2026-02-03T00:00:00.000000Z|2026-02-04T00:00:00.000000Z`;

describe("fetchAvailability", () => {
  beforeEach(() => fetchMock.resetMocks());

  it("parses availability ranges into [startSec, endSec) pairs (proxy mode)", async () => {
    // Force proxy mode
    const search = window.location.search;
    history.replaceState(null, "", "?seismicProxy");
    fetchMock.mockResponseOnce(AVAILABILITY_TEXT);

    const ranges = await fetchAvailability("AK", "K204", "--", "HNZ",
      "2026-01-30T00:00:00.000Z", "2026-02-05T00:00:00.000Z");

    expect(ranges).toEqual([
      { startSec: utcDay(2026, 1, 30), endSec: utcDay(2026, 2, 1) },
      { startSec: utcDay(2026, 2, 3), endSec: utcDay(2026, 2, 4) },
    ]);
    history.replaceState(null, "", search);
  });

  it("falls back to the full requested range when not in proxy mode", async () => {
    const ranges = await fetchAvailability("AK", "K204", "--", "HNZ",
      "2026-01-30T00:00:00.000Z", "2026-02-05T00:00:00.000Z");
    expect(ranges).toEqual([
      { startSec: utcDay(2026, 1, 30), endSec: utcDay(2026, 2, 5) },
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --no-watchman shared/seismic/earthscope-client.test.ts`
Expected: FAIL (`fetchAvailability` not exported).

**Step 3: Write the implementation**

First, DRY up the existing date helper: at the top of `earthscope-client.ts` add
`import { utcDay } from "./seismic-day";` and delete the local `function utcDay(...)`
(currently `earthscope-client.ts:41-43`). `MOCK_FILES` keeps calling `utcDay(...)`, now
resolved from the import.

Then append the availability API:

```ts
const AVAILABILITY_PATH = "/earthscope/cached/availability/1/query";

export interface AvailabilityRange {
  /** Inclusive start, seconds since epoch */
  startSec: number;
  /** Exclusive end, seconds since epoch */
  endSec: number;
}

/**
 * Fetch the time ranges for which data actually exists for a station/channel.
 *
 * Proxy mode (`?seismicProxy`): queries the FDSN availability service through
 * CloudFront and parses its pipe-delimited text response.
 *
 * Mock/local mode: the availability service is not mocked, so we assume the
 * entire requested range is available (one range). Callers then attempt every
 * day; the mock dataselect returns "no data" for days it doesn't cover.
 */
export async function fetchAvailability(
  network: string, station: string, location: string, channel: string,
  startTime: string, endTime: string,
  options?: { baseUrl?: string; signal?: AbortSignal }
): Promise<AvailabilityRange[]> {
  if (!isProxyEnabled()) {
    return [{
      startSec: new Date(startTime).getTime() / 1000,
      endSec: new Date(endTime).getTime() / 1000,
    }];
  }
  const base = options?.baseUrl ?? CLOUDFRONT_PROXY_URL;
  const params = new URLSearchParams({
    net: network, sta: station, cha: channel, loc: location || "--",
    start: startTime, end: endTime, format: "text",
  });
  const response = await fetch(`${base}${AVAILABILITY_PATH}?${params}`, { signal: options?.signal });
  if (!response.ok) {
    throw new Error(`availability ${response.status}: ${response.statusText}`);
  }
  return parseAvailabilityText(await response.text());
}

/** Parse the pipe-delimited FDSN availability text into [startSec, endSec) ranges. */
function parseAvailabilityText(text: string): AvailabilityRange[] {
  const ranges: AvailabilityRange[] = [];
  for (const line of text.trim().split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const fields = line.split("|");
    if (fields.length < 8) continue;
    const startSec = new Date(fields[6]).getTime() / 1000;
    const endSec = new Date(fields[7]).getTime() / 1000;
    if (Number.isFinite(startSec) && Number.isFinite(endSec) && endSec > startSec) {
      ranges.push({ startSec, endSec });
    }
  }
  return ranges;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --no-watchman shared/seismic/earthscope-client.test.ts`
Expected: PASS (existing tests + 2 new).

**Step 5: Commit**

```bash
git add shared/seismic/earthscope-client.ts shared/seismic/earthscope-client.test.ts
git commit -m "Add fetchAvailability with mock fallback to earthscope-client"
```

---

### Task 3: OPFS cache layer (`opfs-seismic-cache.ts`)

Station-first OPFS store for raw day-chunks, plus a small in-memory fake for tests (jsdom has no OPFS). The cache takes an injectable root directory handle so tests pass the fake. Writes use `createWritable()` (works on both main thread and worker; simpler and more testable than a sync access handle — a deviation from the design's "sync access handle" note, made for testability).

**Files:**
- Create: `shared/seismic/opfs-seismic-cache.ts`
- Create: `shared/seismic/fake-opfs.ts` (test helper — a minimal in-memory `FileSystemDirectoryHandle`)
- Test: `shared/seismic/opfs-seismic-cache.test.ts`

**Step 1: Write the fake OPFS helper**

```ts
// shared/seismic/fake-opfs.ts
// Minimal in-memory implementation of the OPFS subset used by opfs-seismic-cache.

class FakeFileHandle {
  constructor(public name: string, private store: Map<string, ArrayBuffer>, private key: string) {}
  async createWritable() {
    const store = this.store, key = this.key;
    let buf = new Uint8Array(0);
    return {
      async write(data: ArrayBuffer | Uint8Array) {
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        const next = new Uint8Array(buf.length + bytes.length);
        next.set(buf); next.set(bytes, buf.length); buf = next;
      },
      async close() { store.set(key, buf.buffer.slice(0)); },
    };
  }
  async getFile() {
    const bytes = this.store.get(this.key) ?? new ArrayBuffer(0);
    return { arrayBuffer: async () => bytes };
  }
}

export class FakeDirHandle {
  private dirs = new Map<string, FakeDirHandle>();
  private files = new Set<string>();
  constructor(private path = "", private store = new Map<string, ArrayBuffer>()) {}

  async getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<FakeDirHandle> {
    let dir = this.dirs.get(name);
    if (!dir) {
      if (!opts?.create) throw Object.assign(new Error("NotFound"), { name: "NotFoundError" });
      dir = new FakeDirHandle(`${this.path}/${name}`, this.store);
      this.dirs.set(name, dir);
    }
    return dir;
  }
  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<FakeFileHandle> {
    const key = `${this.path}/${name}`;
    if (!this.files.has(name)) {
      if (!opts?.create) throw Object.assign(new Error("NotFound"), { name: "NotFoundError" });
      this.files.add(name);
    }
    return new FakeFileHandle(name, this.store, key);
  }
  async removeEntry(name: string, _opts?: { recursive?: boolean }): Promise<void> {
    this.dirs.delete(name); this.files.delete(name);
  }
}
```

**Step 2: Write the failing test**

```ts
// shared/seismic/opfs-seismic-cache.test.ts
import { createOpfsCache } from "./opfs-seismic-cache";
import { FakeDirHandle } from "./fake-opfs";
import { dayIndex, utcDay } from "./seismic-day";
const STA = { network: "AK", station: "K204" };
const bytes = (n: number) => new Uint8Array([n, n, n]).buffer;

describe("opfs-seismic-cache", () => {
  it("writes then reads back a day chunk", async () => {
    const cache = createOpfsCache(async () => new FakeDirHandle() as any);
    const day = dayIndex(utcDay(2026, 1, 30));
    await cache.writeDayChunk(STA, "HNZ", day, bytes(7));
    const read = await cache.readDayChunk(STA, "HNZ", day);
    expect(read && new Uint8Array(read)).toEqual(new Uint8Array([7, 7, 7]));
  });

  it("returns null for a day that was never written", async () => {
    const cache = createOpfsCache(async () => new FakeDirHandle() as any);
    expect(await cache.readDayChunk(STA, "HNZ", dayIndex(utcDay(2026, 1, 30)))).toBeNull();
  });

  it("scans only the cached days within a range", async () => {
    const cache = createOpfsCache(async () => new FakeDirHandle() as any);
    const d30 = dayIndex(utcDay(2026, 1, 30));
    const d31 = dayIndex(utcDay(2026, 1, 31));
    const d1 = dayIndex(utcDay(2026, 2, 1));
    await cache.writeDayChunk(STA, "HNZ", d30, bytes(1));
    await cache.writeDayChunk(STA, "HNZ", d1, bytes(1));
    const cached = await cache.scanCachedDays(STA, "HNZ", d30, d1);
    expect(cached).toEqual(new Set([d30, d1]));
    expect(cached.has(d31)).toBe(false);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npm test -- --no-watchman shared/seismic/opfs-seismic-cache.test.ts`
Expected: FAIL (module not found).

**Step 4: Write the implementation**

```ts
// shared/seismic/opfs-seismic-cache.ts
import { dayToYearDoy } from "./seismic-day";

export interface StationId { network: string; station: string; }

export interface SeismicCache {
  writeDayChunk(station: StationId, channel: string, day: number, bytes: ArrayBuffer | Uint8Array): Promise<void>;
  readDayChunk(station: StationId, channel: string, day: number): Promise<ArrayBuffer | null>;
  scanCachedDays(station: StationId, channel: string, startDay: number, endDay: number): Promise<Set<number>>;
  deleteStation(station: StationId): Promise<void>;
}

const ROOT_DIR = "seismic-cache";

function stationDir(station: StationId): string {
  return `${station.network}_${station.station}`;
}

function fileName(day: number): string {
  const { doy } = dayToYearDoy(day);
  return `${String(doy).padStart(3, "0")}.mseed`;
}

/**
 * Create a station-first OPFS cache:
 *   /seismic-cache/{network}_{station}/{channel}/{year}/{doy}.mseed
 *
 * `getRoot` returns the root directory handle; defaults to OPFS. Tests inject a fake.
 */
export function createOpfsCache(
  getRoot: () => Promise<FileSystemDirectoryHandle> = () => navigator.storage.getDirectory()
): SeismicCache {

  async function channelYearDir(station: StationId, channel: string, day: number, create: boolean) {
    const { year } = dayToYearDoy(day);
    let dir = await getRoot();
    for (const name of [ROOT_DIR, stationDir(station), channel, String(year)]) {
      dir = await dir.getDirectoryHandle(name, { create });
    }
    return dir;
  }

  function isNotFound(err: unknown): boolean {
    return err instanceof Error && err.name === "NotFoundError";
  }

  return {
    async writeDayChunk(station, channel, day, data) {
      const dir = await channelYearDir(station, channel, day, true);
      const handle = await dir.getFileHandle(fileName(day), { create: true });
      const writable = await handle.createWritable();
      await writable.write(data instanceof Uint8Array ? data : new Uint8Array(data));
      await writable.close();
    },

    async readDayChunk(station, channel, day) {
      try {
        const dir = await channelYearDir(station, channel, day, false);
        const handle = await dir.getFileHandle(fileName(day), { create: false });
        const file = await handle.getFile();
        return await file.arrayBuffer();
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },

    async scanCachedDays(station, channel, startDay, endDay) {
      const cached = new Set<number>();
      for (let day = startDay; day <= endDay; day++) {
        try {
          const dir = await channelYearDir(station, channel, day, false);
          await dir.getFileHandle(fileName(day), { create: false });
          cached.add(day);
        } catch (err) {
          if (!isNotFound(err)) throw err;
        }
      }
      return cached;
    },

    async deleteStation(station) {
      try {
        const root = await (await getRoot()).getDirectoryHandle(ROOT_DIR, { create: false });
        await root.removeEntry(stationDir(station), { recursive: true });
      } catch (err) {
        if (!isNotFound(err)) throw err;
      }
    },
  };
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- --no-watchman shared/seismic/opfs-seismic-cache.test.ts`
Expected: PASS (3 tests).

**Step 6: Commit**

```bash
git add shared/seismic/opfs-seismic-cache.ts shared/seismic/fake-opfs.ts shared/seismic/opfs-seismic-cache.test.ts
git commit -m "Add station-first OPFS cache for seismic day-chunks"
```

---

### Task 4: Pure orchestration (`seismic-downloader.ts`)

The heart of the system: availability → gaps → concurrent retrying fetch → cache write → per-day events. Fully dependency-injected, no Worker/OPFS/seisplotjs. This is where the important logic lives, so it gets the most tests.

**Files:**
- Create: `shared/seismic/seismic-downloader.ts`
- Test: `shared/seismic/seismic-downloader.test.ts`

**Step 1: Write the failing tests**

```ts
// shared/seismic/seismic-downloader.test.ts
import { downloadRange, DownloadEvent, DownloaderDeps } from "./seismic-downloader";
import { dayIndex, utcDay } from "./seismic-day";
const RANGE = { network: "AK", station: "K204", location: "--", channel: "HNZ",
  startSec: utcDay(2026, 1, 30), endSec: utcDay(2026, 2, 3) }; // 4 days: 30,31,1,2

function collect() {
  const events: DownloadEvent[] = [];
  return { events, onEvent: (e: DownloadEvent) => events.push(e) };
}

function makeDeps(overrides: Partial<DownloaderDeps> = {}): DownloaderDeps {
  const written = new Set<number>();
  return {
    fetchAvailability: async () => [{ startSec: RANGE.startSec, endSec: RANGE.endSec }],
    fetchRaw: async () => new Uint8Array([1]).buffer,
    cache: {
      scanCachedDays: async () => new Set<number>(),
      writeDayChunk: async (_s, _c, day) => { written.add(day); },
    },
    ...overrides,
  } as DownloaderDeps;
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

  it("skips already-cached days but still reports them as ready", async () => {
    const d30 = dayIndex(utcDay(2026, 1, 30));
    const fetchRaw = jest.fn(async () => new Uint8Array([1]).buffer);
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
    const fetchRaw = jest.fn(async () => new Uint8Array([1]).buffer);
    const deps = makeDeps({
      fetchRaw,
      // Available only for the 30th and the 1st–2nd; the 31st is a gap
      fetchAvailability: async () => [
        { startSec: utcDay(2026, 1, 30), endSec: utcDay(2026, 1, 31) },
        { startSec: utcDay(2026, 2, 1), endSec: utcDay(2026, 2, 3) },
      ],
    });
    const { events, onEvent } = collect();
    await downloadRange(deps, RANGE, onEvent);

    expect(events.some(e => e.type === "dayEmpty" && (e as any).day === d31)).toBe(true);
    expect(fetchRaw).toHaveBeenCalledTimes(3); // not the 31st
  });

  it("retries a failing day up to maxRetries, then emits dayError", async () => {
    let calls = 0;
    const fetchRaw = jest.fn(async () => { calls++; throw new Error("boom"); });
    const deps = makeDeps({
      fetchRaw,
      fetchAvailability: async () => [{ startSec: utcDay(2026, 1, 30), endSec: utcDay(2026, 1, 31) }],
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
      active--; return new Uint8Array([1]).buffer;
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --no-watchman shared/seismic/seismic-downloader.test.ts`
Expected: FAIL (module not found).

**Step 3: Write the implementation**

```ts
// shared/seismic/seismic-downloader.ts
import { AvailabilityRange } from "./earthscope-client";
import { StationId } from "./opfs-seismic-cache";
import { daysInRange, dayIndex, dayToISORange } from "./seismic-day";

export interface DownloaderDeps {
  fetchAvailability(
    network: string, station: string, location: string, channel: string,
    startISO: string, endISO: string, signal?: AbortSignal
  ): Promise<AvailabilityRange[]>;
  fetchRaw(
    network: string, station: string, location: string, channel: string,
    startISO: string, endISO: string, signal?: AbortSignal
  ): Promise<ArrayBuffer>;
  cache: {
    scanCachedDays(station: StationId, channel: string, startDay: number, endDay: number): Promise<Set<number>>;
    writeDayChunk(station: StationId, channel: string, day: number, bytes: ArrayBuffer): Promise<void>;
  };
}

export interface DownloadParams {
  network: string; station: string; location: string; channel: string;
  startSec: number; endSec: number;
  concurrency?: number; maxRetries?: number; signal?: AbortSignal;
}

export type DownloadEvent =
  | { type: "dayWritten"; day: number }
  | { type: "dayEmpty"; day: number }
  | { type: "dayError"; day: number; error: string }
  | { type: "progress"; completed: number; total: number }
  | { type: "done" }
  | { type: "error"; error: string };

const DEFAULT_CONCURRENCY = 5;
const DEFAULT_MAX_RETRIES = 3;

/** True if any availability range overlaps the given UTC day. */
function dayIsAvailable(day: number, ranges: AvailabilityRange[]): boolean {
  const { startISO, endISO } = dayToISORange(day);
  const startSec = new Date(startISO).getTime() / 1000;
  const endSec = new Date(endISO).getTime() / 1000;
  return ranges.some(r => r.startSec < endSec && r.endSec > startSec);
}

/**
 * Download every available, uncached day-chunk in [startSec, endSec) into the cache,
 * emitting one event per day. Does not throw for per-day failures — those become
 * `dayError` events; a fatal error (e.g. availability failure) becomes `error`.
 */
export async function downloadRange(
  deps: DownloaderDeps,
  params: DownloadParams,
  onEvent: (event: DownloadEvent) => void
): Promise<void> {
  const { network, station, location, channel, startSec, endSec } = params;
  const stationId: StationId = { network, station };
  const concurrency = params.concurrency ?? DEFAULT_CONCURRENCY;
  const maxRetries = params.maxRetries ?? DEFAULT_MAX_RETRIES;

  try {
    const { startISO, endISO } = { startISO: new Date(startSec * 1000).toISOString(),
                                   endISO: new Date(endSec * 1000).toISOString() };
    const ranges = await deps.fetchAvailability(network, station, location, channel, startISO, endISO, params.signal);

    const allDays = daysInRange(startSec, endSec);
    const availableDays = allDays.filter(d => dayIsAvailable(d, ranges));
    const emptyDays = allDays.filter(d => !dayIsAvailable(d, ranges));
    for (const day of emptyDays) onEvent({ type: "dayEmpty", day });

    const firstDay = availableDays[0];
    const lastDay = availableDays[availableDays.length - 1];
    const cached = availableDays.length
      ? await deps.cache.scanCachedDays(stationId, channel, firstDay, lastDay)
      : new Set<number>();

    const total = availableDays.length;
    let completed = 0;
    const emitProgress = () => onEvent({ type: "progress", completed, total });

    // Already-cached days are ready immediately.
    for (const day of availableDays) {
      if (cached.has(day)) {
        completed++;
        onEvent({ type: "dayWritten", day });
      }
    }
    if (cached.size) emitProgress();

    const gaps = availableDays.filter(d => !cached.has(d));

    const downloadDay = async (day: number) => {
      const { startISO: dStart, endISO: dEnd } = dayToISORange(day);
      let lastErr = "";
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (params.signal?.aborted) return;
        try {
          const bytes = await deps.fetchRaw(network, station, location, channel, dStart, dEnd, params.signal);
          await deps.cache.writeDayChunk(stationId, channel, day, bytes);
          completed++;
          onEvent({ type: "dayWritten", day });
          emitProgress();
          return;
        } catch (err) {
          lastErr = err instanceof Error ? err.message : String(err);
        }
      }
      onEvent({ type: "dayError", day, error: lastErr });
    };

    await runPool(gaps, concurrency, downloadDay);
    onEvent({ type: "done" });
  } catch (err) {
    onEvent({ type: "error", error: err instanceof Error ? err.message : String(err) });
  }
}

/** Run `worker` over `items` with at most `limit` concurrent invocations. */
async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await worker(items[i]);
    }
  });
  await Promise.all(runners);
}
```

Note: `dayIndex` is imported for symmetry with tests but not required by the implementation — remove the unused import if lint flags it.

**Step 4: Run tests to verify they pass**

Run: `npm test -- --no-watchman shared/seismic/seismic-downloader.test.ts`
Expected: PASS (7 tests).

**Step 5: Typecheck + lint**

Run: `npm run check:types` then `npm run lint`
Expected: no new errors. Remove any unused import lint flags.

**Step 6: Commit**

```bash
git add shared/seismic/seismic-downloader.ts shared/seismic/seismic-downloader.test.ts
git commit -m "Add pure seismic download orchestration (availability, gaps, pool, retries)"
```

---

### Task 5: Web Worker shell (`seismic-download-worker.ts`)

A thin message shell: wires the real deps (`fetchAvailability`, `fetchRawSeismicData` → `ArrayBuffer`, `createOpfsCache()`) into `downloadRange`, forwards every `DownloadEvent` via `postMessage`, and supports cancel via an `AbortController`. No unit test (Worker/OPFS env); it is exercised through Task 6's service test via an injected runner.

**Files:**
- Create: `src/workers/seismic-download-worker.ts`

**Step 1: Write the worker**

```ts
// src/workers/seismic-download-worker.ts
/// <reference lib="webworker" />
import { fetchAvailability, fetchRawSeismicData } from "../../shared/seismic/earthscope-client";
import { createOpfsCache } from "../../shared/seismic/opfs-seismic-cache";
import { downloadRange, DownloadParams, DownloaderDeps } from "../../shared/seismic/seismic-downloader";

export interface DownloadRequest { type: "download"; params: DownloadParams; }
export interface CancelRequest { type: "cancel"; }
export type WorkerRequest = DownloadRequest | CancelRequest;

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let abort: AbortController | null = null;

const deps: DownloaderDeps = {
  fetchAvailability: (net, sta, loc, cha, start, end, signal) =>
    fetchAvailability(net, sta, loc, cha, start, end, { signal }),
  fetchRaw: async (net, sta, loc, cha, start, end, signal) => {
    const response = await fetchRawSeismicData(net, sta, loc, cha, start, end, { signal });
    return response.arrayBuffer();
  },
  cache: createOpfsCache(),
};

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  if (msg.type === "cancel") {
    abort?.abort();
    return;
  }
  if (msg.type === "download") {
    abort = new AbortController();
    await downloadRange(deps, { ...msg.params, signal: abort.signal }, e => ctx.postMessage(e));
  }
};
```

**Step 2: Typecheck**

Run: `npm run check:types`
Expected: no errors. (If `webworker` lib types are missing, confirm `"webworker"` is acceptable via the triple-slash reference; no tsconfig change should be needed for a single file.)

**Step 3: Commit**

```bash
git add src/workers/seismic-download-worker.ts
git commit -m "Add seismic download Web Worker shell"
```

---

### Task 6: MobX download service (`seismic-download-service.ts`)

Main-thread client: spawns the worker, exposes observable progress/resume state for a future UI, and offers `ensureRange` + a `nextReadyDay()` queue so the wave-runner's MST flow can `yield` day-by-day. A `runner` function is injectable so tests bypass the real Worker by driving events directly.

**Files:**
- Create: `src/models/stores/seismic-download-service.ts`
- Test: `src/models/stores/seismic-download-service.test.ts`

**Step 1: Write the failing test**

```ts
// src/models/stores/seismic-download-service.test.ts
import { SeismicDownloadService, DONE } from "./seismic-download-service";
import { DownloadEvent, DownloadParams } from "../../../shared/seismic/seismic-downloader";

const PARAMS: DownloadParams = {
  network: "AK", station: "K204", location: "--", channel: "HNZ",
  startSec: Date.UTC(2026, 0, 30) / 1000, endSec: Date.UTC(2026, 1, 1) / 1000,
};

// A runner that replays a fixed script of events on the next tick.
function scriptedRunner(script: DownloadEvent[]) {
  return (_params: DownloadParams, onEvent: (e: DownloadEvent) => void) => {
    (async () => { for (const e of script) { await Promise.resolve(); onEvent(e); } })();
  };
}

describe("SeismicDownloadService", () => {
  it("yields ready days in order, then DONE", async () => {
    const service = new SeismicDownloadService(scriptedRunner([
      { type: "progress", completed: 0, total: 2 },
      { type: "dayWritten", day: 100 },
      { type: "dayEmpty", day: 101 },
      { type: "dayWritten", day: 102 },
      { type: "done" },
    ]));

    service.ensureRange(PARAMS);
    const got: (number | typeof DONE)[] = [];
    for (;;) {
      const d = await service.nextReadyDay();
      got.push(d);
      if (d === DONE) break;
    }
    expect(got).toEqual([100, 102, DONE]);
  });

  it("tracks observable progress and errored days", async () => {
    const service = new SeismicDownloadService(scriptedRunner([
      { type: "progress", completed: 1, total: 2 },
      { type: "dayError", day: 100, error: "boom" },
      { type: "done" },
    ]));
    service.ensureRange(PARAMS);
    // Drain
    while ((await service.nextReadyDay()) !== DONE) { /* no-op */ }
    expect(service.completed).toBe(1);
    expect(service.total).toBe(2);
    expect(service.erroredDays).toContain(100);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --no-watchman src/models/stores/seismic-download-service.test.ts`
Expected: FAIL (module not found).

**Step 3: Write the implementation**

```ts
// src/models/stores/seismic-download-service.ts
import { makeAutoObservable, runInAction } from "mobx";
import { DownloadEvent, DownloadParams } from "../../../shared/seismic/seismic-downloader";

export const DONE = Symbol("download-done");
export type ReadyDay = number | typeof DONE;

/** Drives a download and forwards events. The default runner uses the Web Worker;
 *  tests inject a runner that replays scripted events. */
export type DownloadRunner = (
  params: DownloadParams,
  onEvent: (event: DownloadEvent) => void,
  cancel: { onCancel: (fn: () => void) => void }
) => void;

function defaultRunner(): DownloadRunner {
  return (params, onEvent, cancel) => {
    const worker = new Worker(new URL("../../workers/seismic-download-worker.ts", import.meta.url));
    worker.onmessage = (e: MessageEvent<DownloadEvent>) => {
      onEvent(e.data);
      if (e.data.type === "done" || e.data.type === "error") worker.terminate();
    };
    cancel.onCancel(() => { worker.postMessage({ type: "cancel" }); worker.terminate(); });
    worker.postMessage({ type: "download", params });
  };
}

export class SeismicDownloadService {
  total = 0;
  completed = 0;
  isDownloading = false;
  error: string | null = null;
  readonly erroredDays: number[] = [];
  readonly emptyDays: number[] = [];

  private readyQueue: number[] = [];
  private waiters: Array<(day: ReadyDay) => void> = [];
  private finished = false;
  private cancelFn: (() => void) | null = null;

  constructor(private runner: DownloadRunner = defaultRunner()) {
    makeAutoObservable(this, { erroredDays: false, emptyDays: false }, { autoBind: true });
  }

  ensureRange(params: DownloadParams): void {
    this.reset();
    this.isDownloading = true;
    this.runner(params, this.handleEvent, { onCancel: fn => { this.cancelFn = fn; } });
  }

  /** Resolves with the next ready day index, or DONE when the download finishes. */
  nextReadyDay(): Promise<ReadyDay> {
    if (this.readyQueue.length) return Promise.resolve(this.readyQueue.shift() as number);
    if (this.finished) return Promise.resolve(DONE);
    return new Promise<ReadyDay>(resolve => { this.waiters.push(resolve); });
  }

  cancel(): void {
    this.cancelFn?.();
    this.finish();
  }

  private handleEvent(event: DownloadEvent): void {
    runInAction(() => {
      switch (event.type) {
        case "progress": this.completed = event.completed; this.total = event.total; break;
        case "dayWritten": this.pushReady(event.day); break;
        case "dayEmpty": this.emptyDays.push(event.day); break;
        case "dayError": this.erroredDays.push(event.day); break;
        case "error": this.error = event.error; this.finish(); break;
        case "done": this.finish(); break;
      }
    });
  }

  private pushReady(day: number): void {
    const waiter = this.waiters.shift();
    if (waiter) waiter(day);
    else this.readyQueue.push(day);
  }

  private finish(): void {
    this.isDownloading = false;
    this.finished = true;
    for (const waiter of this.waiters.splice(0)) waiter(DONE);
  }

  private reset(): void {
    this.total = 0; this.completed = 0; this.error = null; this.finished = false;
    this.readyQueue = []; this.waiters = [];
    this.erroredDays.length = 0; this.emptyDays.length = 0;
  }
}
```

Note: the injected test runner has signature `(params, onEvent)`; the third `cancel` arg is optional at call sites — adjust the test's `scriptedRunner` to accept and ignore it, or make the third parameter optional in the type. Keep the type as written and have `scriptedRunner` take `(_p, onEvent)` (extra arg ignored by JS).

**Step 4: Run test to verify it passes**

Run: `npm test -- --no-watchman src/models/stores/seismic-download-service.test.ts`
Expected: PASS (2 tests).

**Step 5: Typecheck + commit**

```bash
npm run check:types
git add src/models/stores/seismic-download-service.ts src/models/stores/seismic-download-service.test.ts
git commit -m "Add MobX seismic download service with per-day ready queue"
```

---

### Task 7: Wire into the wave-runner run loop

Replace the inline per-day `fetchRawSeismicData` loop with the download service + OPFS reads. Days now arrive as they're downloaded (possibly out of order — fine, since detection is per-window independent). No-data days come as `dayEmpty` and are simply never yielded. This resolves the TODO at [wave-runner-content.ts:268](../../src/plugins/wave-runner/models/wave-runner-content.ts#L268).

**Files:**
- Modify: `src/plugins/wave-runner/models/wave-runner-content.ts` (the `runModel` flow, ~lines 238–299, and imports)
- Test: `src/plugins/wave-runner/models/wave-runner-content.test.ts` (add a run-loop test)

**Step 1: Write the failing test**

Add a test that injects a fake download service + fake cache and asserts the model runs on each ready day. Because the content model constructs its own service today, first make the service injectable:

- Add a module-level default and an override setter, mirroring existing plugin patterns. At the top of `wave-runner-content.ts`:

```ts
import { SeismicDownloadService, DONE } from "../../../models/stores/seismic-download-service";
import { createOpfsCache } from "../../../../shared/seismic/opfs-seismic-cache";

// Injection seam for tests.
let downloadServiceFactory = () => new SeismicDownloadService();
let seismicCacheFactory = () => createOpfsCache();
export function __setSeismicDownloadDepsForTests(
  service: () => SeismicDownloadService, cache: () => ReturnType<typeof createOpfsCache>
) { downloadServiceFactory = service; seismicCacheFactory = cache; }
```

Test (sketch — adapt to existing test setup/model construction in the file):

```ts
import { __setSeismicDownloadDepsForTests } from "./wave-runner-content";
import { DONE } from "../../../models/stores/seismic-download-service";

it("runs the model on each downloaded day", async () => {
  const days = [100, 101];
  let i = 0;
  const fakeService = {
    ensureRange: jest.fn(),
    nextReadyDay: jest.fn(async () => (i < days.length ? days[i++] : DONE)),
    cancel: jest.fn(),
  };
  const fakeCache = { readDayChunk: jest.fn(async () => new Uint8Array([/* valid miniSEED */]).buffer) };
  __setSeismicDownloadDepsForTests(() => fakeService as any, () => fakeCache as any);

  // ...construct a wave-runner content model with a placeholder model + a station + date range,
  // call runModel(), await it, and assert fakeCache.readDayChunk was called twice and
  // updateChunkProgress reached completion. Mock miniseed.parseDataRecords/merge and
  // runner.processChunk as needed to avoid needing real miniSEED bytes.
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --no-watchman src/plugins/wave-runner/models/wave-runner-content.test.ts`
Expected: FAIL (injection seam / new loop not present).

**Step 3: Rewrite the run loop** (replace lines ~257–299)

```ts
        const msPerDay = 86400000;
        const totalDays = Math.ceil((endMs - startMs) / msPerDay);
        self.updateChunkProgress(0, totalDays);

        const downloadService = downloadServiceFactory();
        const cache = seismicCacheFactory();
        const stationId = { network, station };

        downloadService.ensureRange({
          network, station, location, channel,
          startSec: startMs / 1000, endSec: endMs / 1000,
        });

        let processed = 0;
        for (;;) {
          const day: number | typeof DONE = yield downloadService.nextReadyDay();
          if (day === DONE) break;

          const buffer: ArrayBuffer | null = yield cache.readDayChunk(stationId, channel, day);
          if (!buffer) { continue; }

          const records = miniseed.parseDataRecords(buffer);
          const seismogram = miniseed.merge(records);

          yield runner.processChunk(
            seismogram,
            { onProgress: () => {}, onEvents: (events: SeismicEvent[]) => self.addDetectedEvents(events) },
            detectionThreshold,
          );
          processed++;
          self.updateChunkProgress(processed, totalDays);
        }
```

Remove the now-unused inline `fetchRawSeismicData` import from this file if nothing else uses it. Keep the `miniseed` import (still used for parsing).

**Step 4: Run test to verify it passes**

Run: `npm test -- --no-watchman src/plugins/wave-runner/models/wave-runner-content.test.ts`
Expected: PASS.

**Step 5: Full check + commit**

```bash
npm run check:types && npm run lint
git add src/plugins/wave-runner/models/wave-runner-content.ts src/plugins/wave-runner/models/wave-runner-content.test.ts
git commit -m "Wire wave-runner run loop to OPFS bulk downloader"
```

---

### Task 8: Final verification

**Step 1: Run the full seismic test set**

Run: `npm test -- --no-watchman shared/seismic src/models/stores/seismic-download-service.test.ts src/plugins/wave-runner`
Expected: all PASS.

**Step 2: Typecheck + build-lint**

Run: `npm run check:types && npm run lint:build`
Expected: no errors.

**Step 3: Manual smoke (optional, requires dev server)**

Load the wave-runner tile with `?seismicProxy` against a station/date range and confirm a run downloads days into OPFS (DevTools → Application → Storage → OPFS shows `seismic-cache/…`) and detections appear. Re-run the same range and confirm cached days are skipped (no new fetches).

**Step 4: Commit any final touch-ups**

```bash
git commit -am "Finalize seismic bulk downloader wiring" # only if there are pending changes
```

---

## Open items deferred (not in this plan)

- Progress UI and Storage-management UI.
- Timeline read-through of the OPFS store.
- Sub-day resume and parse-based verification pass.
- Confirming the exact CloudFront proxy path for the availability service (`/earthscope/cached/availability/1/query` is assumed to mirror the dataselect path — verify against the deployed proxy before classroom use).
