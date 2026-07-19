import { SeismicEvent } from "../../../shared/seismic/seismic-model-types";
import { StationData, TimeRange } from "../../../shared/seismic/seismic-types";
import {
  BYTES_PER_CHUNK, CHUNK_DURATION_S, COVERAGE_EPOCH, WINDOW_DURATION_S, WINDOWS_PER_CHUNK,
  coveragePath, eventsPath, isWindowCovered
} from "../../../shared/seismic/event-database";

// ---- minimal in-memory fake of the firebase v8 slice the service uses ----
const mockStore = new Map<string, any>();
const mockCommitSizes: number[] = [];
const mockAuthState: { currentUser: { uid: string } | null } = { currentUser: { uid: "test-user" } };
// Extra times runTransaction reruns its callback, simulating Firestore contention retries.
const mockTransactionState = { retries: 0 };

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
        docs = docs.filter(d => {
          switch (w.op) {
            case ">=": return val(d.data()[w.field]) >= val(w.value);
            case "<": return val(d.data()[w.field]) < val(w.value);
            default: throw new Error(`unsupported op ${w.op}`);
          }
        });
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
    runTransaction: async (fn: any) => {
      const txn = {
        get: async (ref: any) => ({ exists: mockStore.has(ref.path), data: () => mockStore.get(ref.path) }),
        set: (ref: any, data: any) => { mockStore.set(ref.path, data); },
      };
      const attempts = 1 + mockTransactionState.retries;
      mockTransactionState.retries = 0;
      let result;
      for (let i = 0; i < attempts; i++) {
        result = await fn(txn);
      }
      return result;
    },
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

import { getUncoveredRanges, loadEvents, markCovered, writeEvents } from "./seismic-event-service";

const stationData: StationData = { network: "AK", station: "K204", channel: "BHZ", location: "00" };
const model = "compact-v1";

beforeEach(() => {
  mockStore.clear();
  mockCommitSizes.length = 0;
  mockAuthState.currentUser = { uid: "test-user" };
  mockTransactionState.retries = 0;
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

  it("writes two coverage docs for a range that crosses a chunk boundary", async () => {
    const range: TimeRange = {
      start: COVERAGE_EPOCH + CHUNK_DURATION_S - WINDOW_DURATION_S,
      end: COVERAGE_EPOCH + CHUNK_DURATION_S + WINDOW_DURATION_S
    };
    await markCovered(stationData, model, range);

    const bitmap0 = mockStore.get(coveragePath(stationData, model, 0)).bitmap.toUint8Array();
    expect(isWindowCovered(bitmap0, WINDOWS_PER_CHUNK - 2)).toBe(false);
    expect(isWindowCovered(bitmap0, WINDOWS_PER_CHUNK - 1)).toBe(true);
    const bitmap1 = mockStore.get(coveragePath(stationData, model, 1)).bitmap.toUint8Array();
    expect(isWindowCovered(bitmap1, 0)).toBe(true);
    expect(isWindowCovered(bitmap1, 1)).toBe(false);
  });

  it("produces the correct bitmap when the transaction retries", async () => {
    mockTransactionState.retries = 1;
    await markCovered(stationData, model, { start: COVERAGE_EPOCH, end: COVERAGE_EPOCH + 2 * WINDOW_DURATION_S });

    const bitmap = mockStore.get(coveragePath(stationData, model, 0)).bitmap.toUint8Array();
    expect(isWindowCovered(bitmap, 0)).toBe(true);
    expect(isWindowCovered(bitmap, 1)).toBe(true);
    expect(isWindowCovered(bitmap, 2)).toBe(false);
  });
});

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
