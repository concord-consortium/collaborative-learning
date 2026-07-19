# Seismic Event Database Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the Firestore-backed seismic event database from [event-database-design.md](../seismic/event-database-design.md) — coverage bitmaps + event storage — and wire Wave Runner's `runModel` to use it (load prior events, skip covered days, persist new events + coverage).

**Architecture:** Pure logic (constants, chunk/window index math, Firestore path builders, bitmap operations, gap scanning) goes in `shared/seismic/event-database.ts` so it is jest-testable without Firebase and reusable by the seismic admin interface later (step 2). Firestore I/O (transactions, batches, queries) goes in `src/models/stores/seismic-event-service.ts` as plain exported async functions using the Firebase 8 **namespaced** API (`firebase.firestore()`, `firebase.firestore.Blob`, …), following the design doc. Security rules are added to `firestore.rules` with emulator tests in `firebase-test/`. Wave Runner's `runModel` is modified to only download/process days that intersect uncovered ranges, and to write events + coverage per completed day.

**Tech Stack:** TypeScript 4.9, Firebase 8 (namespaced API), Jest, `@firebase/rules-unit-testing` v1 (emulator), MobX State Tree (wave-runner content model).

**Branch:** work happens on the current branch `clue-465-events-library`.

**Conventions (repo-specific — read before starting):**
- Jest on this machine: ALWAYS pass `--no-watchman`, e.g. `npm test -- --no-watchman path/to/test.ts`.
- Commit messages: plain sentence style (e.g. "Add seismic event database helpers."), matching `git log`. End every commit message with:
  ```
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  ```
- Time units: `TimeRange` (from `shared/seismic/seismic-types.ts`) is Unix **seconds**. `SeismicEvent` (from `shared/seismic/seismic-model-types.ts`) uses epoch **ms**. Coverage math is done in seconds; ms appears only at Firestore `Timestamp` boundaries and event doc IDs.
- The design doc is the spec: `docs/seismic/event-database-design.md`. If this plan and the doc conflict, flag it — don't silently pick one.

---

### Task 1: Pure module — constants and index math

**Files:**
- Create: `shared/seismic/event-database.ts`
- Test: `shared/seismic/event-database.test.ts`

**Step 1: Write the failing test**

```typescript
// shared/seismic/event-database.test.ts
import {
  BYTES_PER_CHUNK, CHUNK_DURATION_S, COVERAGE_EPOCH, WINDOW_DURATION_S, WINDOWS_PER_CHUNK,
  getChunkEnd, getChunkIndex, getChunkStart, getWindowIndex
} from "./event-database";

describe("event-database constants", () => {
  it("has the values from the design doc", () => {
    expect(COVERAGE_EPOCH).toBe(Date.UTC(2020, 0, 1) / 1000);
    expect(CHUNK_DURATION_S).toBe(30 * 24 * 60 * 60);
    expect(WINDOW_DURATION_S).toBe(600);
    expect(WINDOWS_PER_CHUNK).toBe(4320);
    expect(BYTES_PER_CHUNK).toBe(540);
  });
});

describe("chunk and window index math", () => {
  it("maps the epoch to chunk 0, window 0", () => {
    expect(getChunkIndex(COVERAGE_EPOCH)).toBe(0);
    expect(getWindowIndex(COVERAGE_EPOCH)).toBe(0);
  });

  it("maps a time just before the second chunk to chunk 0, last window", () => {
    const t = COVERAGE_EPOCH + CHUNK_DURATION_S - 1;
    expect(getChunkIndex(t)).toBe(0);
    expect(getWindowIndex(t)).toBe(WINDOWS_PER_CHUNK - 1);
  });

  it("maps the start of the second chunk to chunk 1, window 0", () => {
    const t = COVERAGE_EPOCH + CHUNK_DURATION_S;
    expect(getChunkIndex(t)).toBe(1);
    expect(getWindowIndex(t)).toBe(0);
  });

  it("chunk start/end invert chunk index", () => {
    expect(getChunkStart(0)).toBe(COVERAGE_EPOCH);
    expect(getChunkEnd(0)).toBe(COVERAGE_EPOCH + CHUNK_DURATION_S);
    expect(getChunkStart(13)).toBe(COVERAGE_EPOCH + 13 * CHUNK_DURATION_S);
    expect(getChunkIndex(getChunkStart(7))).toBe(7);
  });

  it("a mid-2024 timestamp lands in the expected chunk", () => {
    const t = Date.UTC(2024, 2, 18) / 1000; // 2024-03-18
    const expectedChunk = Math.floor((t - COVERAGE_EPOCH) / CHUNK_DURATION_S);
    expect(getChunkIndex(t)).toBe(expectedChunk);
    expect(getChunkStart(expectedChunk)).toBeLessThanOrEqual(t);
    expect(getChunkEnd(expectedChunk)).toBeGreaterThan(t);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --no-watchman shared/seismic/event-database.test.ts`
Expected: FAIL — cannot find module `./event-database`.

**Step 3: Write minimal implementation**

```typescript
// shared/seismic/event-database.ts
/**
 * Seismic event database: pure constants, index math, Firestore path builders,
 * and coverage-bitmap helpers.
 */

/** Coverage epoch: Jan 1 2020 UTC. All coverage math is in seconds. */
export const COVERAGE_EPOCH = Date.UTC(2020, 0, 1) / 1000;
export const CHUNK_DURATION_S = 30 * 24 * 60 * 60; // 30 days
export const WINDOW_DURATION_S = 10 * 60; // 10 minutes
export const WINDOWS_PER_CHUNK = CHUNK_DURATION_S / WINDOW_DURATION_S; // 4320
export const BYTES_PER_CHUNK = Math.ceil(WINDOWS_PER_CHUNK / 8); // 540

export function getChunkIndex(timeSec: number): number {
  return Math.floor((timeSec - COVERAGE_EPOCH) / CHUNK_DURATION_S);
}

export function getChunkStart(chunkIndex: number): number {
  return chunkIndex * CHUNK_DURATION_S + COVERAGE_EPOCH;
}

export function getChunkEnd(chunkIndex: number): number {
  return getChunkStart(chunkIndex + 1);
}

export function getWindowIndex(timeSec: number): number {
  const chunkStart = getChunkStart(getChunkIndex(timeSec));
  return Math.floor((timeSec - chunkStart) / WINDOW_DURATION_S);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --no-watchman shared/seismic/event-database.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add shared/seismic/event-database.ts shared/seismic/event-database.test.ts
git commit -m "Add seismic event database constants and index math."
```

---

### Task 2: Pure module — Firestore path builders and event doc IDs

**Files:**
- Modify: `shared/seismic/event-database.ts`
- Test: `shared/seismic/event-database.test.ts`

**Step 1: Write the failing tests** (append to the test file)

```typescript
import { StationData } from "./seismic-types";
import { SeismicEvent } from "./seismic-model-types";
import { coveragePath, eventDocId, eventsPath, modelPath } from "./event-database";

const stationData: StationData = { network: "AK", station: "K204", channel: "BHZ", location: "00" };
const blankLocation: StationData = { network: "AK", station: "K204", channel: "BHZ" };

describe("Firestore path builders", () => {
  it("builds the model container path", () => {
    expect(modelPath(stationData, "compact-v1"))
      .toBe("services/seismic/stations/AK_K204/locations/00/channels/BHZ/models/compact-v1");
  });

  it("encodes a blank location as --", () => {
    expect(modelPath(blankLocation, "compact-v1"))
      .toBe("services/seismic/stations/AK_K204/locations/--/channels/BHZ/models/compact-v1");
  });

  it("builds coverage and events paths from the model path", () => {
    expect(coveragePath(stationData, "compact-v1", 76))
      .toBe(`${modelPath(stationData, "compact-v1")}/coverage/76`);
    expect(eventsPath(stationData, "compact-v1"))
      .toBe(`${modelPath(stationData, "compact-v1")}/events`);
  });
});

describe("eventDocId", () => {
  it("combines windowStart (ms) and eventType", () => {
    const event: SeismicEvent = {
      windowStart: 1710720000000, windowEnd: 1710720060000, eventType: "earthquake", confidence: 0.9
    };
    expect(eventDocId(event)).toBe("1710720000000_earthquake");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --no-watchman shared/seismic/event-database.test.ts`
Expected: FAIL — `modelPath` etc. not exported.

**Step 3: Implement** (append to `event-database.ts`)

```typescript
import { StationData } from "./seismic-types";
import { SeismicEvent } from "./seismic-model-types";
import { encodeLocation, getStationPrefix } from "./tile-addressing";

/** Firestore path to a station+location+channel+model container document. */
export function modelPath(stationData: StationData, model: string): string {
  return `services/seismic/stations/${getStationPrefix(stationData)}` +
    `/locations/${encodeLocation(stationData.location)}` +
    `/channels/${stationData.channel}/models/${model}`;
}

/** Firestore path to a coverage chunk document. */
export function coveragePath(stationData: StationData, model: string, chunkIndex: number): string {
  return `${modelPath(stationData, model)}/coverage/${chunkIndex}`;
}

/** Firestore path to a model's events collection. */
export function eventsPath(stationData: StationData, model: string): string {
  return `${modelPath(stationData, model)}/events`;
}

/** Event document ID: windowStart (epoch ms) + eventType. Deduplicates re-detections. */
export function eventDocId(event: SeismicEvent): string {
  return `${event.windowStart}_${event.eventType}`;
}
```

(Move the imports to the top of the file with the existing ones.)

**Step 4: Run test to verify it passes**

Run: `npm test -- --no-watchman shared/seismic/event-database.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add shared/seismic/event-database.ts shared/seismic/event-database.test.ts
git commit -m "Add seismic event database path builders and event doc IDs."
```

---

### Task 3: Pure module — bitmap and gap-scan helpers

**Files:**
- Modify: `shared/seismic/event-database.ts`
- Test: `shared/seismic/event-database.test.ts`

These are the pure cores of the design doc's `markCovered` / `getUncoveredRanges`, factored out so the Firestore service stays thin and the admin UI can reuse them.

**Step 1: Write the failing tests** (append)

```typescript
import {
  findUncoveredRanges, groupWindowsByChunk, isWindowCovered, setWindowBits, uncoveredDaySpans
} from "./event-database";
import { TimeRange } from "./seismic-types";

describe("groupWindowsByChunk", () => {
  it("groups a range within one chunk", () => {
    const range: TimeRange = { start: COVERAGE_EPOCH, end: COVERAGE_EPOCH + 3 * WINDOW_DURATION_S };
    const groups = groupWindowsByChunk(range);
    expect([...groups.keys()]).toEqual([0]);
    expect(groups.get(0)).toEqual([0, 1, 2]);
  });

  it("splits a range that crosses a chunk boundary", () => {
    const range: TimeRange = {
      start: COVERAGE_EPOCH + CHUNK_DURATION_S - WINDOW_DURATION_S,
      end: COVERAGE_EPOCH + CHUNK_DURATION_S + WINDOW_DURATION_S
    };
    const groups = groupWindowsByChunk(range);
    expect(groups.get(0)).toEqual([WINDOWS_PER_CHUNK - 1]);
    expect(groups.get(1)).toEqual([0]);
  });
});

describe("setWindowBits / isWindowCovered", () => {
  it("sets and reads bits", () => {
    const bitmap = new Uint8Array(BYTES_PER_CHUNK);
    setWindowBits(bitmap, [0, 7, 8, 4319]);
    expect(isWindowCovered(bitmap, 0)).toBe(true);
    expect(isWindowCovered(bitmap, 7)).toBe(true);
    expect(isWindowCovered(bitmap, 8)).toBe(true);
    expect(isWindowCovered(bitmap, 4319)).toBe(true);
    expect(isWindowCovered(bitmap, 1)).toBe(false);
    expect(isWindowCovered(bitmap, 4318)).toBe(false);
  });

  it("is idempotent", () => {
    const bitmap = new Uint8Array(BYTES_PER_CHUNK);
    setWindowBits(bitmap, [5]);
    const copy = new Uint8Array(bitmap);
    setWindowBits(bitmap, [5]);
    expect(bitmap).toEqual(copy);
  });
});

describe("findUncoveredRanges", () => {
  const range = (startWindows: number, endWindows: number): TimeRange => ({
    start: COVERAGE_EPOCH + startWindows * WINDOW_DURATION_S,
    end: COVERAGE_EPOCH + endWindows * WINDOW_DURATION_S
  });

  it("returns the whole range when no bitmaps exist", () => {
    expect(findUncoveredRanges(new Map(), range(0, 6))).toEqual([range(0, 6)]);
  });

  it("returns nothing when the range is fully covered", () => {
    const bitmap = new Uint8Array(BYTES_PER_CHUNK);
    setWindowBits(bitmap, [0, 1, 2, 3, 4, 5]);
    expect(findUncoveredRanges(new Map([[0, bitmap]]), range(0, 6))).toEqual([]);
  });

  it("finds an interior gap", () => {
    const bitmap = new Uint8Array(BYTES_PER_CHUNK);
    setWindowBits(bitmap, [0, 1, 4, 5]);
    expect(findUncoveredRanges(new Map([[0, bitmap]]), range(0, 6))).toEqual([range(2, 4)]);
  });

  it("finds leading and trailing gaps", () => {
    const bitmap = new Uint8Array(BYTES_PER_CHUNK);
    setWindowBits(bitmap, [2, 3]);
    expect(findUncoveredRanges(new Map([[0, bitmap]]), range(0, 6)))
      .toEqual([range(0, 2), range(4, 6)]);
  });

  it("merges a gap spanning a chunk boundary", () => {
    const bitmap0 = new Uint8Array(BYTES_PER_CHUNK);
    setWindowBits(bitmap0, [WINDOWS_PER_CHUNK - 2]); // covered except the last window
    const start = COVERAGE_EPOCH + (WINDOWS_PER_CHUNK - 2) * WINDOW_DURATION_S;
    const end = COVERAGE_EPOCH + CHUNK_DURATION_S + 2 * WINDOW_DURATION_S;
    // chunk 1 has no bitmap: gap runs from last window of chunk 0 into chunk 1
    expect(findUncoveredRanges(new Map([[0, bitmap0]]), { start, end }))
      .toEqual([{ start: COVERAGE_EPOCH + (WINDOWS_PER_CHUNK - 1) * WINDOW_DURATION_S, end }]);
  });
});

describe("uncoveredDaySpans", () => {
  const DAY = 86400;
  const day0 = COVERAGE_EPOCH; // COVERAGE_EPOCH is midnight UTC, so day-aligned
  const dayIdx = day0 / DAY;

  it("returns no spans when there are no gaps", () => {
    expect(uncoveredDaySpans([], { start: day0, end: day0 + 3 * DAY })).toEqual([]);
  });

  it("maps a sub-day gap to its containing day", () => {
    const gaps: TimeRange[] = [{ start: day0 + 600, end: day0 + 1200 }];
    expect(uncoveredDaySpans(gaps, { start: day0, end: day0 + 3 * DAY }))
      .toEqual([{ startDay: dayIdx, endDay: dayIdx }]);
  });

  it("merges gaps on adjacent days into one span", () => {
    const gaps: TimeRange[] = [
      { start: day0 + 600, end: day0 + 1200 },
      { start: day0 + DAY + 600, end: day0 + DAY + 1200 }
    ];
    expect(uncoveredDaySpans(gaps, { start: day0, end: day0 + 3 * DAY }))
      .toEqual([{ startDay: dayIdx, endDay: dayIdx + 1 }]);
  });

  it("keeps non-adjacent days as separate spans", () => {
    const gaps: TimeRange[] = [
      { start: day0, end: day0 + 600 },
      { start: day0 + 2 * DAY, end: day0 + 2 * DAY + 600 }
    ];
    expect(uncoveredDaySpans(gaps, { start: day0, end: day0 + 3 * DAY }))
      .toEqual([{ startDay: dayIdx, endDay: dayIdx }, { startDay: dayIdx + 2, endDay: dayIdx + 2 }]);
  });

  it("clamps a gap ending exactly on a day boundary to the previous day", () => {
    const gaps: TimeRange[] = [{ start: day0, end: day0 + DAY }];
    expect(uncoveredDaySpans(gaps, { start: day0, end: day0 + 3 * DAY }))
      .toEqual([{ startDay: dayIdx, endDay: dayIdx }]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --no-watchman shared/seismic/event-database.test.ts`
Expected: FAIL — helpers not exported.

**Step 3: Implement** (append to `event-database.ts`; import `dayIndex` from `./seismic-day`)

```typescript
import { dayIndex } from "./seismic-day";
import { TimeRange } from "./seismic-types";

/**
 * Group the 10-minute windows of a time range by coverage chunk.
 * `range` should be window-aligned (day-aligned ranges always are).
 */
export function groupWindowsByChunk(range: TimeRange): Map<number, number[]> {
  const chunkUpdates = new Map<number, number[]>();
  for (let t = range.start; t < range.end; t += WINDOW_DURATION_S) {
    const chunk = getChunkIndex(t);
    const window = getWindowIndex(t);
    if (!chunkUpdates.has(chunk)) chunkUpdates.set(chunk, []);
    chunkUpdates.get(chunk)!.push(window);
  }
  return chunkUpdates;
}

/** OR the given window bits into the bitmap (mutates). Idempotent. */
export function setWindowBits(bitmap: Uint8Array, windows: number[]): void {
  for (const w of windows) {
    bitmap[Math.floor(w / 8)] |= (1 << (w % 8));
  }
}

export function isWindowCovered(bitmap: Uint8Array, window: number): boolean {
  return (bitmap[Math.floor(window / 8)] & (1 << (window % 8))) !== 0;
}

/**
 * Scan pre-fetched coverage bitmaps for uncovered sub-ranges of `range`.
 * `bitmaps` maps chunkIndex → bitmap; a missing entry means an unwritten
 * (fully uncovered) chunk. Returns disjoint, sorted gaps.
 */
export function findUncoveredRanges(bitmaps: Map<number, Uint8Array>, range: TimeRange): TimeRange[] {
  const startChunk = getChunkIndex(range.start);
  const endChunk = getChunkIndex(range.end);

  const gaps: TimeRange[] = [];
  let currentGapStart: number | null = null;

  for (let chunk = startChunk; chunk <= endChunk; chunk++) {
    const bitmap = bitmaps.get(chunk);
    const chunkStart = getChunkStart(chunk);
    for (let w = 0; w < WINDOWS_PER_CHUNK; w++) {
      const windowTime = chunkStart + w * WINDOW_DURATION_S;
      if (windowTime < range.start || windowTime >= range.end) continue;

      const covered = !!bitmap && isWindowCovered(bitmap, w);
      if (!covered && currentGapStart === null) {
        currentGapStart = windowTime;
      } else if (covered && currentGapStart !== null) {
        gaps.push({ start: currentGapStart, end: windowTime });
        currentGapStart = null;
      }
    }
  }
  if (currentGapStart !== null) {
    gaps.push({ start: currentGapStart, end: Math.min(range.end, getChunkEnd(endChunk)) });
  }
  return gaps;
}

export interface DaySpan {
  startDay: number; // UTC day index (days since Unix epoch), inclusive
  endDay: number;   // inclusive
}

/**
 * Convert uncovered ranges into merged spans of UTC day indices, clamped to `range`.
 * The download/model pipeline is day-based, so a day is processed iff it
 * intersects an uncovered range. Assumes `gaps` are disjoint and sorted
 * (as returned by findUncoveredRanges).
 */
export function uncoveredDaySpans(gaps: TimeRange[], range: TimeRange): DaySpan[] {
  const spans: DaySpan[] = [];
  for (const gap of gaps) {
    const start = Math.max(gap.start, range.start);
    const end = Math.min(gap.end, range.end);
    if (end <= start) continue;
    const startDay = dayIndex(start);
    const endDay = dayIndex(end - 1); // end is exclusive
    const last = spans[spans.length - 1];
    if (last && startDay <= last.endDay + 1) {
      last.endDay = Math.max(last.endDay, endDay);
    } else {
      spans.push({ startDay, endDay });
    }
  }
  return spans;
}
```

(Consolidate imports at the top of the file.)

**Step 4: Run test to verify it passes**

Run: `npm test -- --no-watchman shared/seismic/event-database.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add shared/seismic/event-database.ts shared/seismic/event-database.test.ts
git commit -m "Add coverage bitmap and gap-scan helpers to seismic event database."
```

---

### Task 4: Firestore service — markCovered and getUncoveredRanges

**Files:**
- Create: `src/models/stores/seismic-event-service.ts`
- Test: `src/models/stores/seismic-event-service.test.ts`

The firebase mock pattern to follow is [src/lib/firestore.test.ts](../../src/lib/firestore.test.ts) — `jest.mock("firebase/app", () => ({ firestore: ... }))`. Because the service uses `firebase.firestore` both as a function and as a namespace (`firebase.firestore.Blob`), the mock's `firestore` needs statics attached via `Object.assign`.

**Step 1: Write the failing test**

```typescript
// src/models/stores/seismic-event-service.test.ts
import { StationData, TimeRange } from "../../../shared/seismic/seismic-types";
import {
  BYTES_PER_CHUNK, COVERAGE_EPOCH, WINDOW_DURATION_S, coveragePath, isWindowCovered
} from "../../../shared/seismic/event-database";

// ---- minimal in-memory fake of the firebase v8 slice the service uses ----
const mockStore = new Map<string, any>();
const mockCommitSizes: number[] = [];
const mockAuthState: { currentUser: { uid: string } | null } = { currentUser: { uid: "test-user" } };

class MockBlob {
  bytes: Uint8Array;
  constructor(bytes: Uint8Array) { this.bytes = new Uint8Array(bytes); }
  static fromUint8Array(a: Uint8Array) { return new MockBlob(a); }
  toUint8Array() { return new Uint8Array(this.bytes); }
}

jest.mock("firebase/app", () => {
  const snapFor = (path: string) => ({
    exists: mockStore.has(path),
    data: () => mockStore.get(path),
  });
  const docRef = (path: string): any => ({
    path,
    id: path.split("/").pop(),
    get: async () => snapFor(path),
  });
  const makeQuery = (collectionPath: string, c: any = {}): any => ({
    where: (field: string, op: string, value: any) =>
      makeQuery(collectionPath, { ...c, wheres: [...(c.wheres ?? []), { field, op, value }] }),
    orderBy: (field: string) => makeQuery(collectionPath, { ...c, orderBy: field }),
    limit: (n: number) => makeQuery(collectionPath, { ...c, limit: n }),
    startAfter: (snap: any) => makeQuery(collectionPath, { ...c, startAfter: snap.id }),
    get: async () => {
      const val = (v: any) => v?.toMillis?.() ?? v;
      let docs = [...mockStore.entries()]
        .filter(([p]) => p.startsWith(`${collectionPath}/`) && !p.slice(collectionPath.length + 1).includes("/"))
        .map(([p, data]) => ({ id: p.slice(collectionPath.length + 1), data: () => data }));
      for (const w of c.wheres ?? []) {
        docs = docs.filter(d => w.op === ">=" ? val(d.data()[w.field]) >= val(w.value)
                                              : val(d.data()[w.field]) < val(w.value));
      }
      if (c.orderBy) docs.sort((a, b) => val(a.data()[c.orderBy]) - val(b.data()[c.orderBy]));
      if (c.startAfter) docs = docs.slice(docs.findIndex(d => d.id === c.startAfter) + 1);
      if (c.limit) docs = docs.slice(0, c.limit);
      return { docs };
    },
  });
  const firestoreInstance = {
    doc: docRef,
    collection: (path: string) => Object.assign(makeQuery(path), { doc: (id: string) => docRef(`${path}/${id}`) }),
    runTransaction: async (fn: any) => fn({
      get: async (ref: any) => ({ exists: mockStore.has(ref.path), data: () => mockStore.get(ref.path) }),
      set: (ref: any, data: any) => { mockStore.set(ref.path, data); },
    }),
    batch: () => {
      const writes: Array<[any, any]> = [];
      return {
        set: (ref: any, data: any) => { writes.push([ref, data]); },
        commit: async () => {
          writes.forEach(([ref, data]) => mockStore.set(ref.path, data));
          mockCommitSizes.push(writes.length);
        },
      };
    },
  };
  const firestore = Object.assign(() => firestoreInstance, {
    Blob: MockBlob,
    Timestamp: { fromMillis: (ms: number) => ({ toMillis: () => ms }) },
    FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
  });
  return { firestore, auth: () => mockAuthState };
});

import { getUncoveredRanges, markCovered } from "./seismic-event-service";

const stationData: StationData = { network: "AK", station: "K204", channel: "BHZ", location: "00" };
const model = "compact-v1";

beforeEach(() => {
  mockStore.clear();
  mockCommitSizes.length = 0;
  mockAuthState.currentUser = { uid: "test-user" };
});

describe("markCovered", () => {
  it("creates a coverage doc with the range's bits set", async () => {
    const range: TimeRange = { start: COVERAGE_EPOCH, end: COVERAGE_EPOCH + 3 * WINDOW_DURATION_S };
    await markCovered(stationData, model, range);

    const doc = mockStore.get(coveragePath(stationData, model, 0));
    expect(doc).toBeDefined();
    expect(doc.updatedAt).toBe("SERVER_TIMESTAMP");
    const bitmap = doc.bitmap.toUint8Array();
    expect(bitmap.length).toBe(BYTES_PER_CHUNK);
    expect(isWindowCovered(bitmap, 0)).toBe(true);
    expect(isWindowCovered(bitmap, 2)).toBe(true);
    expect(isWindowCovered(bitmap, 3)).toBe(false);
  });

  it("ORs new bits into an existing bitmap", async () => {
    await markCovered(stationData, model, { start: COVERAGE_EPOCH, end: COVERAGE_EPOCH + WINDOW_DURATION_S });
    await markCovered(stationData, model,
      { start: COVERAGE_EPOCH + 2 * WINDOW_DURATION_S, end: COVERAGE_EPOCH + 3 * WINDOW_DURATION_S });

    const bitmap = mockStore.get(coveragePath(stationData, model, 0)).bitmap.toUint8Array();
    expect(isWindowCovered(bitmap, 0)).toBe(true);
    expect(isWindowCovered(bitmap, 1)).toBe(false);
    expect(isWindowCovered(bitmap, 2)).toBe(true);
  });
});

describe("getUncoveredRanges", () => {
  it("returns the full range when nothing is covered", async () => {
    const range: TimeRange = { start: COVERAGE_EPOCH, end: COVERAGE_EPOCH + 6 * WINDOW_DURATION_S };
    expect(await getUncoveredRanges(stationData, model, range)).toEqual([range]);
  });

  it("returns only the gaps after marking coverage", async () => {
    const covered: TimeRange = {
      start: COVERAGE_EPOCH + 2 * WINDOW_DURATION_S, end: COVERAGE_EPOCH + 4 * WINDOW_DURATION_S
    };
    await markCovered(stationData, model, covered);
    const range: TimeRange = { start: COVERAGE_EPOCH, end: COVERAGE_EPOCH + 6 * WINDOW_DURATION_S };
    expect(await getUncoveredRanges(stationData, model, range)).toEqual([
      { start: range.start, end: covered.start },
      { start: covered.end, end: range.end },
    ]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --no-watchman src/models/stores/seismic-event-service.test.ts`
Expected: FAIL — cannot find module `./seismic-event-service`.

**Step 3: Implement**

```typescript
// src/models/stores/seismic-event-service.ts
import firebase from "firebase/app";
import "firebase/firestore";
import {
  BYTES_PER_CHUNK, coveragePath, findUncoveredRanges, getChunkIndex, groupWindowsByChunk, setWindowBits
} from "../../../shared/seismic/event-database";
import { StationData, TimeRange } from "../../../shared/seismic/seismic-types";

/**
 * Firestore I/O for the seismic event database.
 */

/** Mark a (window-aligned) time range as processed. One transaction per 30-day chunk. */
export async function markCovered(stationData: StationData, model: string, range: TimeRange): Promise<void> {
  const firestore = firebase.firestore();
  for (const [chunkIndex, windows] of groupWindowsByChunk(range)) {
    const docRef = firestore.doc(coveragePath(stationData, model, chunkIndex));
    await firestore.runTransaction(async (txn) => {
      const snap = await txn.get(docRef);
      const bitmap = snap.exists
        ? (snap.data()!.bitmap as firebase.firestore.Blob).toUint8Array()
        : new Uint8Array(BYTES_PER_CHUNK);
      setWindowBits(bitmap, windows);
      txn.set(docRef, {
        bitmap: firebase.firestore.Blob.fromUint8Array(bitmap),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
  }
}

/** Fetch coverage bitmaps for a range and return its uncovered sub-ranges. */
export async function getUncoveredRanges(
  stationData: StationData, model: string, range: TimeRange
): Promise<TimeRange[]> {
  const firestore = firebase.firestore();
  const bitmaps = new Map<number, Uint8Array>();
  const startChunk = getChunkIndex(range.start);
  const endChunk = getChunkIndex(range.end);
  for (let chunk = startChunk; chunk <= endChunk; chunk++) {
    const snap = await firestore.doc(coveragePath(stationData, model, chunk)).get();
    if (snap.exists) {
      bitmaps.set(chunk, (snap.data()!.bitmap as firebase.firestore.Blob).toUint8Array());
    }
  }
  return findUncoveredRanges(bitmaps, range);
}
```

Note: `toUint8Array()` on the real SDK returns a fresh array, so mutating it with `setWindowBits` is safe.

**Step 4: Run test to verify it passes**

Run: `npm test -- --no-watchman src/models/stores/seismic-event-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/models/stores/seismic-event-service.ts src/models/stores/seismic-event-service.test.ts
git commit -m "Add seismic event service coverage read/write."
```

---

### Task 5: Firestore service — writeEvents and loadEvents

**Files:**
- Modify: `src/models/stores/seismic-event-service.ts`
- Test: `src/models/stores/seismic-event-service.test.ts`

**Step 1: Write the failing tests** (append; the fake from Task 4 already supports batches and queries)

```typescript
import { SeismicEvent } from "../../../shared/seismic/seismic-model-types";
import { eventsPath } from "../../../shared/seismic/event-database";
import { loadEvents, writeEvents } from "./seismic-event-service";

const msRange = (startMs: number, endMs: number): TimeRange => ({ start: startMs / 1000, end: endMs / 1000 });

const makeEvent = (windowStartMs: number, eventType = "earthquake"): SeismicEvent => ({
  windowStart: windowStartMs, windowEnd: windowStartMs + 60000, eventType, confidence: 0.9
});

describe("writeEvents", () => {
  it("writes event docs with denormalized fields and createdBy", async () => {
    const event = makeEvent(1710720000000);
    await writeEvents(stationData, model, [event]);

    const doc = mockStore.get(`${eventsPath(stationData, model)}/1710720000000_earthquake`);
    expect(doc).toMatchObject({
      station: "AK_K204", location: "00", channel: "BHZ", model,
      eventType: "earthquake", confidence: 0.9,
      createdBy: "test-user", createdAt: "SERVER_TIMESTAMP",
    });
    expect(doc.windowStart.toMillis()).toBe(1710720000000);
    expect(doc.windowEnd.toMillis()).toBe(1710720060000);
  });

  it("splits writes into batches of at most 500", async () => {
    const events = Array.from({ length: 501 }, (_, i) => makeEvent(1710720000000 + i * 60000));
    await writeEvents(stationData, model, events);
    expect(mockCommitSizes).toEqual([500, 1]);
  });

  it("throws when unauthenticated", async () => {
    mockAuthState.currentUser = null;
    await expect(writeEvents(stationData, model, [makeEvent(1710720000000)])).rejects.toThrow();
  });
});

describe("loadEvents", () => {
  it("returns events in the range, ordered by windowStart", async () => {
    await writeEvents(stationData, model,
      [makeEvent(1710720120000), makeEvent(1710720000000), makeEvent(1710730000000)]);

    const events = await loadEvents(stationData, model, msRange(1710720000000, 1710725000000));
    expect(events.map(e => e.windowStart)).toEqual([1710720000000, 1710720120000]);
    expect(events[0]).toEqual(makeEvent(1710720000000));
  });

  it("pages through more than pageSize events", async () => {
    const all = Array.from({ length: 5 }, (_, i) => makeEvent(1710720000000 + i * 60000));
    await writeEvents(stationData, model, all);

    const events = await loadEvents(stationData, model, msRange(1710720000000, 1710725000000), 2);
    expect(events).toHaveLength(5);
    expect(events.map(e => e.windowStart)).toEqual(all.map(e => e.windowStart));
  });
});
```

(Also move `mockStore`/`mockCommitSizes`/`mockAuthState` usage as needed — they are module-scope in the test file.)

**Step 2: Run test to verify it fails**

Run: `npm test -- --no-watchman src/models/stores/seismic-event-service.test.ts`
Expected: FAIL — `writeEvents`/`loadEvents` not exported.

**Step 3: Implement** (append to the service; extend the shared-module import with `eventDocId`, `eventsPath`; import `SeismicEvent`, `encodeLocation`, `getStationPrefix`)

```typescript
import { SeismicEvent } from "../../../shared/seismic/seismic-model-types";
import { encodeLocation, getStationPrefix } from "../../../shared/seismic/tile-addressing";

const MAX_BATCH_SIZE = 500; // Firestore write-batch limit

function getAuthenticatedUid(): string {
  const user = firebase.auth().currentUser;
  if (!user) {
    throw new Error("User must be authenticated to write events");
  }
  return user.uid;
}

/** Write detected events. Doc IDs dedupe re-detections; batches split at the Firestore limit. */
export async function writeEvents(
  stationData: StationData, model: string, events: SeismicEvent[]
): Promise<void> {
  const firestore = firebase.firestore();
  const createdBy = getAuthenticatedUid();
  const eventsRef = firestore.collection(eventsPath(stationData, model));
  for (let i = 0; i < events.length; i += MAX_BATCH_SIZE) {
    const batch = firestore.batch();
    for (const event of events.slice(i, i + MAX_BATCH_SIZE)) {
      batch.set(eventsRef.doc(eventDocId(event)), {
        station: getStationPrefix(stationData),
        location: encodeLocation(stationData.location),
        channel: stationData.channel,
        model,
        windowStart: firebase.firestore.Timestamp.fromMillis(event.windowStart),
        windowEnd: firebase.firestore.Timestamp.fromMillis(event.windowEnd),
        eventType: event.eventType,
        confidence: event.confidence,
        createdBy,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

/** Load stored events with windowStart in `range`, paging through large result sets. */
export async function loadEvents(
  stationData: StationData, model: string, range: TimeRange, pageSize = 500
): Promise<SeismicEvent[]> {
  const eventsRef = firebase.firestore().collection(eventsPath(stationData, model));
  const events: SeismicEvent[] = [];
  let lastDoc: firebase.firestore.QueryDocumentSnapshot | undefined;

  while (true) {
    let q = eventsRef
      .where("windowStart", ">=", firebase.firestore.Timestamp.fromMillis(range.start * 1000))
      .where("windowStart", "<", firebase.firestore.Timestamp.fromMillis(range.end * 1000))
      .orderBy("windowStart")
      .limit(pageSize);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    for (const d of snap.docs) {
      events.push({
        windowStart: d.data().windowStart.toMillis(),
        windowEnd: d.data().windowEnd.toMillis(),
        eventType: d.data().eventType,
        confidence: d.data().confidence,
      });
    }
    if (snap.docs.length < pageSize) break;
    lastDoc = snap.docs[snap.docs.length - 1] as firebase.firestore.QueryDocumentSnapshot;
  }
  return events;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --no-watchman src/models/stores/seismic-event-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/models/stores/seismic-event-service.ts src/models/stores/seismic-event-service.test.ts
git commit -m "Add seismic event service event write and load."
```

---

### Task 6: Security rules + emulator tests

**Files:**
- Modify: `firestore.rules` (add seismic block near the end, after the `match /test/{userId}` block, still inside `match /databases/{database}/documents`)
- Create: `firebase-test/src/seismic-rules.test.ts`

**Environment note:** the emulator tests need Node 16.x and Java (see CLAUDE.md). Run them with `cd firebase-test && npm run test:exec`. If this environment can't run them (wrong Node/no Java), still write them, run the rest of the plan, and flag clearly at the end that rules tests were NOT executed and must be run in CI or a compatible environment before deploying rules. Deploying rules (`npm run deploy:firestore:rules`) is NOT part of this plan — the user decides when.

**Step 1: Add the rules** (from the design doc, verbatim semantics)

```javascript
    //
    // seismic event database (see docs/seismic/event-database-design.md)
    // Anonymous users are allowed to read and contribute (see design doc Decision).
    //
    match /services/seismic/stations/{station}/locations/{location}/channels/{channel}/models/{model} {

      match /events/{eventId} {
        allow read: if isAuthed();
        allow write: if isAuthed()
                     && request.resource.data.createdBy == request.auth.uid
                     && request.resource.data.station == station
                     && request.resource.data.location == location
                     && request.resource.data.channel == channel
                     && request.resource.data.model == model;
      }

      match /coverage/{chunkId} {
        allow read: if isAuthed();
        allow write: if isAuthed()
                     && request.resource.data.bitmap is bytes
                     && request.resource.data.updatedAt is timestamp;
      }
    }
```

(Uses the file's existing `isAuthed()` helper rather than repeating `request.auth != null`.)

**Step 2: Write the emulator tests**

First read `firebase-test/src/setup-rules-tests.ts` for the exact helper signatures (`initFirestore`, `expectReadToFail/Succeed`, `expectWriteToFail/Succeed`, `prepareEachTest`, `tearDownTests`) and how an *unauthenticated* app is created (look at how existing tests exercise unauthenticated access; `genericAuth` is a plain `{ uid }` with no portal claims — that's our anonymous user). Then follow the structure of `comment-tags-rules.test.ts`:

```typescript
// firebase-test/src/seismic-rules.test.ts
import firebase from "firebase";
import {
  expectDeleteToFail, expectReadToFail, expectReadToSucceed, expectWriteToFail, expectWriteToSucceed,
  genericAuth, initFirestore, prepareEachTest, tearDownTests
} from "./setup-rules-tests";

describe("Firestore security rules: seismic event database", () => {

  let db: firebase.firestore.Firestore;

  const kModelPath = "services/seismic/stations/AK_K204/locations/00/channels/BHZ/models/compact-v1";
  const kEventPath = `${kModelPath}/events/1710720000000_earthquake`;
  const kCoveragePath = `${kModelPath}/coverage/76`;

  const validEvent = () => ({
    station: "AK_K204", location: "00", channel: "BHZ", model: "compact-v1",
    windowStart: firebase.firestore.Timestamp.fromMillis(1710720000000),
    windowEnd: firebase.firestore.Timestamp.fromMillis(1710720060000),
    eventType: "earthquake", confidence: 0.9,
    createdBy: genericAuth.uid,
    createdAt: firebase.firestore.Timestamp.now(),
  });

  const validCoverage = () => ({
    bitmap: firebase.firestore.Blob.fromUint8Array(new Uint8Array(540)),
    updatedAt: firebase.firestore.Timestamp.now(),
  });

  beforeEach(async () => {
    await prepareEachTest();
  });

  afterAll(async () => {
    await tearDownTests();
  });

  describe("events", () => {
    it("unauthenticated users cannot read or write", async () => {
      db = initFirestore(); // check setup helper: no-auth app
      await expectReadToFail(db, kEventPath);
      await expectWriteToFail(db, kEventPath, validEvent());
    });

    it("an authenticated (anonymous) user can write a valid event and read it back", async () => {
      db = initFirestore(genericAuth);
      await expectWriteToSucceed(db, kEventPath, validEvent());
      await expectReadToSucceed(db, kEventPath);
    });

    it("rejects an event whose createdBy is not the requesting uid", async () => {
      db = initFirestore(genericAuth);
      await expectWriteToFail(db, kEventPath, { ...validEvent(), createdBy: "someone-else" });
    });

    it("rejects an event whose denormalized fields don't match the path", async () => {
      db = initFirestore(genericAuth);
      await expectWriteToFail(db, kEventPath, { ...validEvent(), station: "AK_OTHER" });
      await expectWriteToFail(db, kEventPath, { ...validEvent(), location: "10" });
      await expectWriteToFail(db, kEventPath, { ...validEvent(), channel: "BNZ" });
      await expectWriteToFail(db, kEventPath, { ...validEvent(), model: "other-model" });
    });

    it("does not allow deleting events", async () => {
      db = initFirestore(genericAuth);
      await expectWriteToSucceed(db, kEventPath, validEvent());
      await expectDeleteToFail(db, kEventPath); // check setup helper name; add one if missing
    });
  });

  describe("coverage", () => {
    it("unauthenticated users cannot read or write", async () => {
      db = initFirestore();
      await expectReadToFail(db, kCoveragePath);
      await expectWriteToFail(db, kCoveragePath, validCoverage());
    });

    it("an authenticated user can write valid coverage and read it back", async () => {
      db = initFirestore(genericAuth);
      await expectWriteToSucceed(db, kCoveragePath, validCoverage());
      await expectReadToSucceed(db, kCoveragePath);
    });

    it("rejects coverage with a non-bytes bitmap or missing timestamp", async () => {
      db = initFirestore(genericAuth);
      await expectWriteToFail(db, kCoveragePath, { ...validCoverage(), bitmap: [1, 2, 3] });
      await expectWriteToFail(db, kCoveragePath, { ...validCoverage(), updatedAt: "not-a-timestamp" });
      await expectWriteToFail(db, kCoveragePath, { bitmap: validCoverage().bitmap });
    });
  });
});
```

Adjust helper names/signatures to what `setup-rules-tests.ts` actually exports (e.g., there may be no `expectDeleteToFail` — add a small helper there if needed, following the style of the existing ones; there may also be a specific way to make an unauthenticated app).

**Step 3: Run the rules tests (if the environment allows)**

Run: `cd firebase-test && npm run test:exec`
Expected: PASS (all suites — this runs the pre-existing rules tests too, which must stay green).
If the environment can't run them, note it and move on.

**Step 4: Commit**

```bash
git add firestore.rules firebase-test/src/seismic-rules.test.ts firebase-test/src/setup-rules-tests.ts
git commit -m "Add seismic event database security rules and tests."
```

---

### Task 7: Wave Runner — dedupe detected events

`runModel` will now merge previously stored events (from `loadEvents`) with freshly detected ones. A day that intersects a partially covered region is reprocessed whole, so the same event can arrive twice (once loaded, once re-detected). Firestore dedupes via doc IDs; the local list needs the same key.

**Files:**
- Modify: `src/plugins/wave-runner/models/wave-runner-content.ts` (the `addDetectedEvents` action)
- Test: `src/plugins/wave-runner/models/wave-runner-content.test.ts`

**Step 1: Read the existing test file** to learn its content-model setup helpers, then add a failing test:

```typescript
it("addDetectedEvents drops events duplicating an existing windowStart+eventType", () => {
  const content = /* create content per existing test helpers */;
  const evt = { windowStart: 1710720000000, windowEnd: 1710720060000, eventType: "earthquake", confidence: 0.9 };
  content.addDetectedEvents([evt]);
  content.addDetectedEvents([{ ...evt, confidence: 0.8 }, { ...evt, eventType: "traffic" }]);
  expect(content.detectedEvents).toHaveLength(2);
  expect(content.detectedEvents.map((e: any) => e.eventType)).toEqual(["earthquake", "traffic"]);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --no-watchman src/plugins/wave-runner/models/wave-runner-content.test.ts`
Expected: FAIL — 3 events retained.

**Step 3: Implement** — in `addDetectedEvents` ([wave-runner-content.ts:148](../../src/plugins/wave-runner/models/wave-runner-content.ts#L148)), filter out duplicates using the same key as `eventDocId`:

```typescript
addDetectedEvents(events: SeismicEvent[]) {
  const seen = new Set(self.detectedEvents.map(eventDocId));
  const fresh = events.filter(evt => {
    const key = eventDocId(evt);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  self.detectedEvents = [...self.detectedEvents, ...fresh];
},
```

(import `eventDocId` from `../../../../shared/seismic/event-database`.)

**Step 4: Run test to verify it passes**

Run: `npm test -- --no-watchman src/plugins/wave-runner/models/wave-runner-content.test.ts`
Expected: PASS (including all pre-existing tests).

**Step 5: Commit**

```bash
git add src/plugins/wave-runner/models/wave-runner-content.ts src/plugins/wave-runner/models/wave-runner-content.test.ts
git commit -m "Dedupe detected events in Wave Runner content model."
```

---

### Task 8: Wave Runner — wire runModel to the event database

**Files:**
- Modify: `src/plugins/wave-runner/models/wave-runner-content.ts` (the `runModel` flow, currently ~line 205)
- Test: `src/plugins/wave-runner/models/wave-runner-content.test.ts`

**Behavior (the spec for this task):**
1. After validating dates, compute `rangeSec: TimeRange = { start: startMs / 1000, end: endMs / 1000 }` and `modelId = metadata.id`.
2. Try `loadEvents(station, modelId, rangeSec)` → `addDetectedEvents(prior)`, and `getUncoveredRanges(station, modelId, rangeSec)`. If either throws (offline, unauthenticated, rules), log `console.warn` and fall back to `uncovered = [rangeSec]` with no prior events — the run must still work fully locally.
3. Convert `uncovered` to day spans with `uncoveredDaySpans(uncovered, rangeSec)`. If empty, skip downloading entirely (everything already covered; dataset gets the loaded events).
4. `totalDays` = total days across spans (drives existing progress UI).
5. For each span **sequentially**: `downloadService.ensureRange({ ...station, startSec: span.startDay * SECONDS_PER_DAY, endSec: (span.endDay + 1) * SECONDS_PER_DAY })` (note: `ensureRange` resets the service, so each span must be fully drained via `nextReadyDay()`/`DONE` before the next starts). Process each ready day exactly as today.
6. Per successfully processed day: collect that day's events in a local array via the `onEvents` callback (in addition to `addDetectedEvents`), then best-effort persist:
   ```typescript
   try {
     if (dayEvents.length) yield writeEvents(station, modelId, dayEvents);
     yield markCovered(station, modelId, { start: day * SECONDS_PER_DAY, end: (day + 1) * SECONDS_PER_DAY });
   } catch (err) {
     console.warn("Failed to save seismic events/coverage:", err);
   }
   ```
7. After each span drains, also best-effort `markCovered` each day in `downloadService.emptyDays` (no data for that day is a processed result — that's the point of coverage), and accumulate errored/empty counts into the progress calculation as today. **Errored days are NOT marked covered.**
8. Everything after the loop (dataset population from `self.detectedEvents`, error handling, `finally`) stays as-is — prior + new events all flow through `detectedEvents`.

Import from `./seismic-event-service` (via `../../../models/stores/seismic-event-service`): `getUncoveredRanges, loadEvents, markCovered, writeEvents`; from shared: `uncoveredDaySpans`; `SECONDS_PER_DAY` from `shared/seismic/seismic-day` (check what the file already imports — it uses `MILLISECONDS_PER_DAY` today).

**Step 1: Read the existing runModel tests** in `wave-runner-content.test.ts` to learn how `SeismicDownloadService` / `SeismicModelRunner` are mocked there (the download service supports an injected runner; jest module mocks are likely used for the model runner). Then write failing tests, mocking the event service module:

```typescript
jest.mock("../../../models/stores/seismic-event-service", () => ({
  loadEvents: jest.fn(async () => []),
  getUncoveredRanges: jest.fn(async (_s: any, _m: any, range: any) => [range]),
  writeEvents: jest.fn(async () => {}),
  markCovered: jest.fn(async () => {}),
}));
```

Test intents (adapt to the file's existing scaffolding):
- **loads prior events**: `loadEvents` resolves two events → after `runModel`, they're in `detectedEvents`/the dataset even though the model found nothing.
- **skips covered days**: `getUncoveredRanges` returns only day 2 of a 3-day range → `ensureRange` is called once with day 2's `startSec`/`endSec` only.
- **fully covered range**: `getUncoveredRanges` returns `[]` → `ensureRange` never called, run completes with loaded events.
- **persists per day**: after a day is processed with events, `writeEvents` was called with those events and `markCovered` with that day's range (in seconds).
- **event DB failure is non-fatal**: `loadEvents`/`getUncoveredRanges` reject → model still runs over the full range; `runError` stays null.

**Step 2: Run tests to verify they fail**

Run: `npm test -- --no-watchman src/plugins/wave-runner/models/wave-runner-content.test.ts`
Expected: FAIL — service functions never called / all days processed.

**Step 3: Implement** the behavior above in `runModel`. Keep the existing per-day processing body (miniseed parse → `runner.processChunk`) untouched; restructure only the surrounding download loop:

```typescript
// after date validation:
const rangeSec: TimeRange = { start: startMs / 1000, end: endMs / 1000 };
const modelId = metadata.id;
const station = self.station; // non-null: validated above

// Load previously stored events and coverage; fall back to a full local run if unavailable.
let uncovered: TimeRange[] = [rangeSec];
try {
  const prior: SeismicEvent[] = yield loadEvents(station, modelId, rangeSec);
  self.addDetectedEvents(prior);
  uncovered = yield getUncoveredRanges(station, modelId, rangeSec);
} catch (err) {
  console.warn("Seismic event database unavailable; processing the full range:", err);
}
const spans = uncoveredDaySpans(uncovered, rangeSec);

const totalDays = spans.reduce((sum, s) => sum + (s.endDay - s.startDay + 1), 0);
self.updateChunkProgress(0, totalDays);

const downloadService = new SeismicDownloadService();
let processed = 0;
let skippedDays = 0;
const updateProgress = () => {
  const progress = processed + skippedDays
    + downloadService.erroredDays.length + downloadService.emptyDays.length;
  self.updateChunkProgress(progress, totalDays);
};

for (const span of spans) {
  downloadService.ensureRange({
    ...station, startSec: span.startDay * SECONDS_PER_DAY, endSec: (span.endDay + 1) * SECONDS_PER_DAY
  });

  while (true) {
    const day: number | typeof DONE = yield downloadService.nextReadyDay();
    if (day === DONE) break;

    const buffer: ArrayBuffer | null = yield downloadService.readDay(day);
    if (!buffer) continue;

    const records = miniseed.parseDataRecords(buffer);
    const seismogram = miniseed.merge(records);

    const dayEvents: SeismicEvent[] = [];
    yield runner.processChunk(
      seismogram,
      {
        onProgress: () => {},
        onEvents: (events: SeismicEvent[]) => {
          dayEvents.push(...events);
          self.addDetectedEvents(events);
        },
      },
      detectionThreshold,
    );

    // Best-effort persistence: a failure here must not fail the local run.
    try {
      if (dayEvents.length) yield writeEvents(station, modelId, dayEvents);
      yield markCovered(station, modelId, { start: day * SECONDS_PER_DAY, end: (day + 1) * SECONDS_PER_DAY });
    } catch (err) {
      console.warn("Failed to save seismic events/coverage:", err);
    }

    processed++;
    updateProgress();
  }

  // A day with no data is still processed — mark it covered so nobody re-checks it.
  for (const day of downloadService.emptyDays) {
    try {
      yield markCovered(station, modelId, { start: day * SECONDS_PER_DAY, end: (day + 1) * SECONDS_PER_DAY });
    } catch (err) {
      console.warn("Failed to save seismic coverage:", err);
    }
  }
  skippedDays += downloadService.erroredDays.length + downloadService.emptyDays.length;
  updateProgress();
}
```

Watch out for:
- `self.station` narrowing inside the flow (capture in a local const after the null check).
- The old `totalDays` computation and single `ensureRange` call are replaced; delete them.
- `detectionThreshold` and the dataset-population code after the loop stay unchanged.
- Type of `day` (`ReadyDay`) — `DONE` is a symbol import from `seismic-download-service`, already imported.

**Step 4: Run tests to verify they pass**

Run: `npm test -- --no-watchman src/plugins/wave-runner/models/wave-runner-content.test.ts`
Expected: PASS (new tests AND all pre-existing runModel tests).

**Step 5: Commit**

```bash
git add src/plugins/wave-runner/models/wave-runner-content.ts src/plugins/wave-runner/models/wave-runner-content.test.ts
git commit -m "Wire Wave Runner model runs to the seismic event database."
```

---

### Task 9: Final verification

**Step 1: Full test suite**

Run: `npm test -- --no-watchman`
Expected: all suites pass.

**Step 2: Types and lint**

Run: `npm run check:types && npm run lint:build`
Expected: clean. (`lint:build` is the stricter pre-commit check per CLAUDE.md.)

**Step 3: Reconcile with the design doc**

Re-read `docs/seismic/event-database-design.md` and confirm the implementation matches (paths, field names, rules, unit conventions). Two intentional deltas to note in the summary, already implied by the doc: batching splits at 500 (doc prose), and empty days are marked covered (doc: coverage means "processed", independent of events found).

**Step 4: Commit any stragglers, then report**

Report status honestly: what passed, what wasn't run (e.g., emulator rules tests if the environment couldn't run them), and that rules are NOT yet deployed (`npm run deploy:firestore:rules` is a user decision).

**Step 5: Use superpowers:verification-before-completion, then superpowers:finishing-a-development-branch** to decide next steps with the user.
