# Seismic Admin Interface Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a standalone `/seismic-admin` page (v1: raw-data/OPFS management) — a station filter + date range, and per-station raw-data timelines with range-scoped download/delete and disk usage.

**Architecture:** New webpack entry (mirrors `/authoring`) rendering a React app backed by a small MobX admin store. The store enumerates the OPFS raw cache (new range-scoped read methods on `opfs-seismic-cache`), optionally merges a unit's station catalog (`?unit=`), and drives downloads via the existing `SeismicDownloadService` (sequential across stations) and deletes via a new range-scoped OPFS delete. Envelope UI is present but stubbed.

**Tech Stack:** TypeScript, React 17, MobX (`makeAutoObservable`), OPFS, Webpack 5, Jest + React Testing Library.

**Design doc:** `docs/plans/2026-07-07-seismic-admin-design.md`

**Conventions for every task:**
- Run one test file: `npm test -- --no-watchman <path>` (the `--no-watchman` flag is required on this machine).
- Typecheck: `npm run check:types`. Lint: `npm run lint`.
- Tests are colocated `*.test.ts(x)`; jsdom env.
- Commit after each task with the message shown.

---

### Task 1: OPFS enumeration (list stations, range disk usage, range delete)

Add admin-facing reads to the OPFS cache, and extend the in-memory fake with directory iteration + file `size`.

**Files:**
- Modify: `shared/seismic/tile-addressing.ts` (add `parseStationPrefix`)
- Modify: `shared/seismic/fake-opfs.ts`
- Modify: `shared/seismic/opfs-seismic-cache.ts`
- Test: `shared/seismic/tile-addressing.test.ts`, `shared/seismic/opfs-seismic-cache.test.ts`

**Step 1: Add `parseStationPrefix` to tile-addressing.ts (TDD)**

`parseStationPrefix` is the inverse of `getStationPrefix` — it splits `"{network}_{station}"`
back into `{ network, station }`. `listStations` uses it to recover station identity from the
OPFS directory names.

Failing test (append to `shared/seismic/tile-addressing.test.ts`):
```ts
import { getStationPrefix, parseStationPrefix } from "./tile-addressing";

it("parseStationPrefix is the inverse of getStationPrefix", () => {
  expect(parseStationPrefix("AK_K204")).toEqual({ network: "AK", station: "K204" });
  const s = { network: "AK", station: "RC01" };
  expect(parseStationPrefix(getStationPrefix(s))).toEqual(s);
});
```
Run: `npm test -- --no-watchman shared/seismic/tile-addressing.test.ts` → FAIL.

Implement in `shared/seismic/tile-addressing.ts`, next to `getStationPrefix` (`StationId` is
already imported there):
```ts
/** Inverse of getStationPrefix: "{network}_{station}" → { network, station }.
 *  Splits on the first "_" (SEED network/station codes contain no underscore). */
export function parseStationPrefix(prefix: string): StationId {
  const sep = prefix.indexOf("_");
  return { network: prefix.slice(0, sep), station: prefix.slice(sep + 1) };
}
```
Run the test → PASS.

**Step 2: Extend the fake with `entries()` iteration and file `size`**

In `fake-opfs.ts`, give `FakeFileHandle.getFile()` a `size`, and add an async `entries()`/`values()` to `FakeDirHandle` that yields child dirs and files. Sketch:

```ts
// FakeFileHandle.getFile():
async getFile() {
  const bytes = this.store.get(this.key) ?? new ArrayBuffer(0);
  return { size: bytes.byteLength, arrayBuffer: async () => bytes };
}

// FakeDirHandle: track kind and expose iteration
async *entries(): AsyncIterableIterator<[string, FakeDirHandle | FakeFileHandle]> {
  for (const [name, dir] of this.dirs) yield [name, dir];
  for (const name of this.files) yield [name, new FakeFileHandle(name, this.store, `${this.path}/${name}`)];
}
async *values() { for await (const [, h] of this.entries()) yield h; }
```
(`FakeDirHandle` needs a `kind: "directory"` and `FakeFileHandle` a `kind: "file"` so callers can distinguish; real OPFS handles have `.kind`.)

**Step 3: Write the failing tests** (append to `opfs-seismic-cache.test.ts`)

```ts
import { daysInRange, dayIndex, utcDay } from "./seismic-day";

const STA2: StationData = { network: "AK", station: "K204", channel: "HNZ" };

describe("opfs-seismic-cache admin reads", () => {
  it("lists the stations present in the cache", async () => {
    const root = new FakeDirHandle();
    const cache = createOpfsCache(async () => root as any);
    await cache.writeDayChunk(STA, dayIndex(utcDay(2026, 1, 30)), bytes(1));   // AK/K204/HNZ
    await cache.writeDayChunk(STA2, dayIndex(utcDay(2026, 1, 30)), bytes(1));  // same, other channel? use a 2nd station instead
    const stations = await cache.listStations();
    expect(stations).toContainEqual({ network: "AK", station: "K204", channel: "HNZ" });
  });

  it("sums bytes only for cached days within the range", async () => {
    const root = new FakeDirHandle();
    const cache = createOpfsCache(async () => root as any);
    const d30 = dayIndex(utcDay(2026, 1, 30));
    const d1 = dayIndex(utcDay(2026, 2, 1));
    await cache.writeDayChunk(STA, d30, new Uint8Array([1, 2, 3]).buffer);   // 3 bytes, in range
    await cache.writeDayChunk(STA, d1, new Uint8Array([1, 2, 3, 4]).buffer); // 4 bytes, out of range
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
```
(Adjust the first test to use two distinct stations rather than reusing STA2 as shown; the intent is that `listStations` returns each `(network, station, channel)` present.)

**Step 4: Run to verify failure**

Run: `npm test -- --no-watchman shared/seismic/opfs-seismic-cache.test.ts`
Expected: FAIL (methods undefined).

**Step 5: Implement the three methods** in `opfs-seismic-cache.ts`

Add to the `SeismicCache` interface and the returned object (add `parseStationPrefix` to the
existing `tile-addressing` import). Reference implementations:

```ts
// interface additions
listStations(): Promise<StationData[]>;
stationRawBytes(station: StationData, startDay: number, endDay: number): Promise<number>;
deleteDaysInRange(station: StationData, startDay: number, endDay: number): Promise<void>;

// impl
async listStations() {
  const out: StationData[] = [];
  let seismicRoot: FileSystemDirectoryHandle;
  try {
    seismicRoot = await (await getRoot()).getDirectoryHandle(ROOT_DIR, { create: false });
  } catch (err) { if (isNotFound(err)) return out; throw err; }
  for await (const [dirName, stationHandle] of (seismicRoot as any).entries()) {
    if ((stationHandle as any).kind !== "directory") continue;
    const { network, station } = parseStationPrefix(dirName);   // "{network}_{station}"
    for await (const [channel, channelHandle] of (stationHandle as any).entries()) {
      if ((channelHandle as any).kind === "directory") out.push({ network, station, channel });
    }
  }
  return out;
}

async stationRawBytes(station, startDay, endDay) {
  let total = 0;
  for (let day = startDay; day <= endDay; day++) {
    try {
      const dir = await channelYearDir(station, day, false);
      const handle = await dir.getFileHandle(fileName(day), { create: false });
      total += (await handle.getFile()).size;
    } catch (err) { if (!isNotFound(err)) throw err; }
  }
  return total;
}

async deleteDaysInRange(station, startDay, endDay) {
  for (let day = startDay; day <= endDay; day++) {
    try {
      const dir = await channelYearDir(station, day, false);
      await dir.removeEntry(fileName(day));
    } catch (err) { if (!isNotFound(err)) throw err; }
  }
}
```

**Step 6: Run tests + typecheck**

Run: `npm test -- --no-watchman shared/seismic/tile-addressing.test.ts shared/seismic/opfs-seismic-cache.test.ts` → PASS.
Run: `npm run check:types` → clean.

**Step 7: Commit**

```bash
git add shared/seismic/tile-addressing.ts shared/seismic/tile-addressing.test.ts \
  shared/seismic/opfs-seismic-cache.ts shared/seismic/fake-opfs.ts shared/seismic/opfs-seismic-cache.test.ts
git commit -m "Add parseStationPrefix + OPFS admin reads (listStations, range bytes, range delete)"
```

---

### Task 2: Pure admin computations (coverage, missing counts, station merge)

Pure functions the store and UI use — fully testable, no OPFS/React.

**Files:**
- Create: `src/seismic-admin/seismic-admin-utils.ts`
- Test: `src/seismic-admin/seismic-admin-utils.test.ts`

**Step 1: Write the failing tests**

```ts
import { coverageSegments, missingDayCount, mergeStations } from "./seismic-admin-utils";

describe("seismic-admin-utils", () => {
  it("builds run-length coverage segments over [firstDay, lastDay]", () => {
    // days 10..13, cached {10, 12, 13}
    const segs = coverageSegments(new Set([10, 12, 13]), 10, 13);
    expect(segs).toEqual([
      { startDay: 10, endDay: 10, cached: true },
      { startDay: 11, endDay: 11, cached: false },
      { startDay: 12, endDay: 13, cached: true },
    ]);
  });

  it("counts missing days in range", () => {
    expect(missingDayCount(new Set([10, 12]), 10, 13)).toBe(2); // 11, 13 missing
  });

  it("merges OPFS + catalog stations by (network, station, channel)", () => {
    const opfs = [{ network: "AK", station: "K204", channel: "HNZ" }];
    const catalog = [
      { network: "AK", station: "K204", location: "--", channel: "HNZ", label: "Anchorage" },
      { network: "AK", station: "RC01", location: "", channel: "BHZ", label: "Rabbit Creek" },
    ];
    const merged = mergeStations(opfs, catalog);
    // K204 is in both → single entry, catalog supplies label + location, not orphan
    const k204 = merged.find(s => s.station === "K204")!;
    expect(k204).toMatchObject({ network: "AK", station: "K204", channel: "HNZ", location: "--", label: "Anchorage", orphan: false });
    // RC01 is catalog-only → included, not orphan (has location, downloadable)
    expect(merged.find(s => s.station === "RC01")).toMatchObject({ location: "", label: "Rabbit Creek", orphan: false });
  });

  it("marks OPFS-only stations (no catalog match) as orphans", () => {
    const merged = mergeStations([{ network: "AK", station: "XYZ", channel: "HNZ" }], []);
    expect(merged[0]).toMatchObject({ station: "XYZ", orphan: true, location: undefined });
  });
});
```

**Step 2: Run to verify failure** → FAIL (module not found).

**Step 3: Implement `seismic-admin-utils.ts`**

```ts
import { StationData } from "../../shared/seismic/seismic-types";

export interface StationConfigLite {
  network: string; station: string; location?: string; channel: string; label?: string;
}

/** A station shown in the admin: identity + optional catalog-provided location/label. */
export interface AdminStation {
  network: string; station: string; channel: string;
  location?: string;   // from catalog; undefined for OPFS-only orphans
  label?: string;
  orphan: boolean;     // true when OPFS-only (no catalog match) → download disabled
  id: string;          // `${network}_${station}_${channel}`
}

const key = (s: { network: string; station: string; channel: string }) =>
  `${s.network}_${s.station}_${s.channel}`;

/** Run-length spans of cached/uncached days across [firstDay, lastDay]. */
export function coverageSegments(cached: Set<number>, firstDay: number, lastDay: number) {
  const segs: { startDay: number; endDay: number; cached: boolean }[] = [];
  for (let day = firstDay; day <= lastDay; day++) {
    const isCached = cached.has(day);
    const last = segs[segs.length - 1];
    if (last && last.cached === isCached) last.endDay = day;
    else segs.push({ startDay: day, endDay: day, cached: isCached });
  }
  return segs;
}

export function missingDayCount(cached: Set<number>, firstDay: number, lastDay: number): number {
  let n = 0;
  for (let day = firstDay; day <= lastDay; day++) if (!cached.has(day)) n++;
  return n;
}

/** Union OPFS stations with catalog stations, deduped by (network, station, channel). */
export function mergeStations(opfs: StationData[], catalog: StationConfigLite[]): AdminStation[] {
  const byKey = new Map<string, AdminStation>();
  for (const c of catalog) {
    byKey.set(key(c), {
      network: c.network, station: c.station, channel: c.channel,
      location: c.location ?? "", label: c.label, orphan: false, id: key(c),
    });
  }
  for (const o of opfs) {
    const k = key(o);
    if (!byKey.has(k)) {
      byKey.set(k, { network: o.network, station: o.station, channel: o.channel, orphan: true, id: k });
    }
  }
  return [...byKey.values()];
}
```

**Step 4: Run tests → PASS. Step 5: Commit**

```bash
git add src/seismic-admin/seismic-admin-utils.ts src/seismic-admin/seismic-admin-utils.test.ts
git commit -m "Add pure seismic-admin utils: coverage, missing counts, station merge"
```

---

### Task 3: Admin store (state + orchestration)

A MobX store holding date range, merged stations + selection, per-station cache stats, and the download/delete actions. `cache` and a `download-service factory` are injectable for tests.

**Files:**
- Create: `src/seismic-admin/seismic-admin-store.ts`
- Test: `src/seismic-admin/seismic-admin-store.test.ts`

**Step 1: Write the failing tests** (cover the non-UI logic)

```ts
import { SeismicAdminStore } from "./seismic-admin-store";
import { dayIndex, utcDay } from "../../shared/seismic/seismic-day";

function fakeCache(cached: number[] = []) {
  return {
    listStations: jest.fn(async () => [{ network: "AK", station: "K204", channel: "HNZ" }]),
    scanCachedDays: jest.fn(async () => new Set(cached)),
    stationRawBytes: jest.fn(async () => 1234),
    deleteDaysInRange: jest.fn(async () => {}),
  };
}

it("loads stations from OPFS and computes per-station stats for the range", async () => {
  const d30 = dayIndex(utcDay(2026, 1, 30));
  const store = new SeismicAdminStore({ cache: fakeCache([d30]) as any });
  store.setRange("2026-01-30", "2026-02-02");   // 3 days: 30, 31, 1
  await store.refresh();
  const s = store.stations[0];
  expect(store.statsFor(s.id).cachedDays.has(d30)).toBe(true);
  expect(store.statsFor(s.id).bytes).toBe(1234);
  expect(store.statsFor(s.id).missingCount).toBe(2);
});

it("deletes a station's days in range via the cache", async () => {
  const cache = fakeCache([dayIndex(utcDay(2026, 1, 30))]);
  const store = new SeismicAdminStore({ cache: cache as any });
  store.setRange("2026-01-30", "2026-02-02");
  await store.refresh();
  await store.deleteRaw(store.stations[0].id);
  expect(cache.deleteDaysInRange).toHaveBeenCalled();
});

it("runs downloads sequentially across selected stations", async () => {
  // Inject a download-runner that records order and resolves immediately.
  const order: string[] = [];
  const runner = jest.fn(async (station) => { order.push(station.station); });
  const store = new SeismicAdminStore({ cache: fakeCache() as any, downloadStation: runner });
  store.setRange("2026-01-30", "2026-02-02");
  await store.refresh();
  await store.downloadAllSelected();
  expect(runner).toHaveBeenCalledTimes(store.selectedStations.length);
});
```

**Step 2–3: Implement `seismic-admin-store.ts`** (sketch — fill per tests)

Key shape:
```ts
import { makeAutoObservable, runInAction } from "mobx";
import { createOpfsCache, SeismicCache } from "../../shared/seismic/opfs-seismic-cache";
import { daysInRange, dayIndex, lastDayIndex, utcDay } from "../../shared/seismic/seismic-day";
import { SeismicDownloadService } from "../models/stores/seismic-download-service";
import { AdminStation, mergeStations, missingDayCount, StationConfigLite } from "./seismic-admin-utils";

interface Deps {
  cache?: Pick<SeismicCache, "listStations" | "scanCachedDays" | "stationRawBytes" | "deleteDaysInRange">;
  catalog?: StationConfigLite[];
  // one-station download; default uses SeismicDownloadService.ensureRange and awaits completion
  downloadStation?: (station: AdminStation, startSec: number, endSec: number) => Promise<void>;
}

interface StationStats { cachedDays: Set<number>; bytes: number; missingCount: number; }

export class SeismicAdminStore {
  startDate = "2026-01-01";
  endDate = "2026-01-31";
  stations: AdminStation[] = [];
  selected = new Set<string>();           // station ids
  stats = new Map<string, StationStats>();
  // ...constructor(makeAutoObservable, stash deps)...

  get selectedStations() { return this.stations.filter(s => this.selected.has(s.id)); }
  private get firstDay() { return dayIndex(utcDay(...parse startDate...)); }
  private get lastDay()  { return lastDayIndex(...parse endDate...); }

  setRange(start: string, end: string) { this.startDate = start; this.endDate = end; }
  toggle(id: string) { this.selected.has(id) ? this.selected.delete(id) : this.selected.add(id); }

  async refresh() {
    const opfs = await this.cache.listStations();
    const merged = mergeStations(opfs, this.deps.catalog ?? []);
    runInAction(() => { this.stations = merged; if (this.selected.size === 0) merged.forEach(s => this.selected.add(s.id)); });
    for (const s of merged) await this.loadStats(s);
  }

  statsFor(id: string) { return this.stats.get(id)!; }

  private async loadStats(s: AdminStation) {
    const cachedDays = await this.cache.scanCachedDays(s, this.firstDay, this.lastDay);
    const bytes = await this.cache.stationRawBytes(s, this.firstDay, this.lastDay);
    runInAction(() => this.stats.set(s.id, { cachedDays, bytes, missingCount: missingDayCount(cachedDays, this.firstDay, this.lastDay) }));
  }

  async deleteRaw(id: string) {
    const s = this.stations.find(x => x.id === id)!;
    await this.cache.deleteDaysInRange(s, this.firstDay, this.lastDay);
    await this.loadStats(s);
  }

  async downloadAllSelected() {
    for (const s of this.selectedStations) {         // sequential
      if (s.orphan) continue;                          // no location → skip
      await this.download(s);
    }
  }
  private async download(s: AdminStation) { /* downloadStation dep, then loadStats */ }
}
```
The default `downloadStation` builds a `SeismicDownloadService`, calls `ensureRange({network, station, location, channel, startSec, endSec})`, and awaits completion (drain `nextReadyDay()` until `DONE`, or expose a completion promise). Keep it injectable so tests bypass the worker.

**Step 4: Run tests → PASS. Step 5: Commit**

```bash
git add src/seismic-admin/seismic-admin-store.ts src/seismic-admin/seismic-admin-store.test.ts
git commit -m "Add seismic-admin MobX store (stats, sequential download, range delete)"
```

---

### Task 4: Webpack entry + app shell

Wire up `/seismic-admin`. No unit test — verified by typecheck + build.

**Files:**
- Create: `src/seismic-admin/index.tsx`, `src/seismic-admin/index.html`, `src/seismic-admin/components/app.tsx`
- Modify: `webpack.config.js` (entry + one `configHtmlPlugins` block, mirroring `authoring`)

**Step 1:** Add to the `entry` object: `'seismic-admin': './src/seismic-admin/index.tsx',`
**Step 2:** Add an HtmlWebpackPlugin block:
```js
...configHtmlPlugins({
  chunks: ['seismic-admin'],
  filename: 'seismic-admin/index.html',
  template: 'src/seismic-admin/index.html'
}),
```
**Step 3:** `index.html` — copy `src/authoring/index.html`, change `<title>` to "CLUE Seismic Admin".
**Step 4:** `index.tsx`:
```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./components/app";
createRoot(document.getElementById("app")!).render(<App />);
```
**Step 5:** `components/app.tsx` — a placeholder that constructs the store and renders "Seismic Admin" + `store.refresh()` on mount (fleshed out in Task 5-6).

**Step 6:** Run `npm run check:types` → clean. Optionally `npm start` and load `http://localhost:8080/seismic-admin/` to confirm it serves.

**Step 7: Commit**
```bash
git add src/seismic-admin/index.tsx src/seismic-admin/index.html src/seismic-admin/components/app.tsx webpack.config.js
git commit -m "Add /seismic-admin webpack entry and app shell"
```

---

### Task 5: Fixed header (station filter + date range + Apply)

**Files:**
- Create: `src/seismic-admin/components/admin-header.tsx`, `.scss`
- Test: `src/seismic-admin/components/admin-header.test.tsx`

Component: fixed-position header with station checkboxes (from `store.stations`, checked = selected), two date inputs (bound to draft state), and an **Apply** button that commits the draft range (`store.setRange`) and triggers `store.refresh()`. Component test (React Testing Library): renders checkboxes for stations, toggling a checkbox and clicking Apply calls the store; use an observable store or a stub with jest.fn actions.

Commit: `"Add seismic-admin fixed header (filter + date range + apply)"`

---

### Task 6: Per-station section + all-stations summary + confirm modal

**Files:**
- Create: `src/seismic-admin/components/station-section.tsx`, `all-stations-section.tsx`, `raw-timeline.tsx`, `confirm-modal.tsx`, `.scss`
- Test: `src/seismic-admin/components/station-section.test.tsx`, `raw-timeline.test.tsx`

- `raw-timeline.tsx`: renders `coverageSegments(stats.cachedDays, firstDay, lastDay)` as proportional filled/empty spans. Test: given a cached set, the filled spans cover the right fraction.
- `station-section.tsx`: station header; left = raw timeline + "N / M days" + formatted disk usage (`stationRawBytes`); envelope timeline **placeholder** ("unavailable") + "—" counts; right = Fill-envelope (disabled), Download-missing-raw (disabled when `orphan`), Delete (opens confirm modal → `store.deleteRaw`). Test: orphan → download disabled; delete flow calls the store after confirm.
- `all-stations-section.tsx`: aggregate missing-raw-days across selected + stubbed envelope count; Download-all (→ `store.downloadAllSelected`) and Delete-all (one confirm → per-station delete).
- `confirm-modal.tsx`: minimal modal ("Delete raw data for … from … to …?", Cancel/Confirm). Reuse the app's modal infra if convenient, else a small self-contained overlay.

Commit: `"Add seismic-admin station sections, raw timeline, and confirm modal"`

---

### Task 7: Compose the app + optional `?unit=` catalog

**Files:**
- Modify: `src/seismic-admin/components/app.tsx`
- Create: `src/seismic-admin/load-catalog.ts` + test

- `app.tsx`: fixed `<AdminHeader/>` + scrollable body (`<AllStationsSection/>` then `store.selectedStations.map(<StationSection/>)`), wrapped in `observer`. Construct the store once; `store.refresh()` on mount.
- `load-catalog.ts`: read `?unit=` from `window.location.search`; if present, fetch the unit config JSON and extract the `stations` list (see `data-setup.tsx` / `useSettingFromStores("stations", "wave-runner")` for where stations live in unit config — confirm the exact path). Return `StationConfigLite[]`; on any failure, return `[]` (graceful degrade). Pass into the store's deps. Unit-test the parse with a sample config object; mock `fetch`.

Commit: `"Compose seismic-admin app and load optional unit station catalog"`

---

### Task 8: Final verification

**Step 1:** `npm test -- --no-watchman shared/seismic src/seismic-admin` → all PASS.
**Step 2:** `npm run check:types && npm run lint:build` → clean.
**Step 3 (manual):** `npm start`, open `/seismic-admin/` (and `/seismic-admin/?unit=<url>`). Confirm: stations from OPFS (and catalog) list and start selected; adjusting range + Apply updates timelines/counts; Download-missing-raw pulls gap days (needs `?seismicProxy`); disk usage + "N/M days" update; Delete (with confirm) removes only in-range days; orphan stations show download disabled.
**Step 4:** Commit any touch-ups.

---

## Open items deferred (not in this plan)

- Envelope availability (timeline, counts, working "fill" button) — needs a coverage source (S3 manifest / listing / Firestore index).
- Location-in-cache-key fix (orphan stations can't be downloaded because OPFS omits location).
- Download progress polish (per-day progress bars) beyond the store's `completed/total` counts.
