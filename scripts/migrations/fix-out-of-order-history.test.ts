import { FieldValue } from "firebase-admin/firestore";
import {
  IStoredEntry, planHistoryRepair, repairDocumentHistory, tilePathInfo, toStoredEntry
} from "./fix-out-of-order-history";
import { applyJsonPatches } from "../../src/models/history/json-patch";

const tile = "T1";
const tilePath = `/content/tileMap/${tile}`;
const outputConfig = { servoInputMode: "proportion", allowedOutputTypes: ["Servo"] };

// The entries a DataFlow tile used to leave when the unit set Live Output options: the mirror on
// mount completed while the entry that added the tile was still open, so it was stored first.
function setOutputConfig(docId: string, index: number, previousEntryId?: string): IStoredEntry {
  return {
    docId, index, previousEntryId, action: `${tilePath}/content/setOutputConfig`,
    records: [{
      patches: [{ op: "replace", path: `${tilePath}/content/outputConfig`, value: outputConfig }],
      inversePatches: [{ op: "replace", path: `${tilePath}/content/outputConfig` }]
    }]
  };
}
function addTile(docId: string, index: number, previousEntryId?: string, tileId = tile): IStoredEntry {
  return {
    docId, index, previousEntryId, action: "/content/userAddTile",
    records: [{
      patches: [
        { op: "add", path: "/content/rowMap/R1", value: { id: "R1", tiles: [{ tileId }] } },
        { op: "add", path: "/content/rowOrder/0", value: "R1" },
        { op: "add", path: `/content/tileMap/${tileId}`,
          value: { id: tileId, content: { type: "Dataflow", program: { recentTicks: [] } } } }
      ],
      inversePatches: [
        { op: "remove", path: `/content/tileMap/${tileId}` },
        { op: "remove", path: "/content/rowOrder/0" },
        { op: "remove", path: "/content/rowMap/R1" }
      ]
    }]
  };
}
function tick(docId: string, index: number, previousEntryId?: string, tickIndex = 0): IStoredEntry {
  return {
    docId, index, previousEntryId, action: `${tilePath}/content/program/tickAndProcess`,
    records: [{
      patches: [{ op: "add", path: `${tilePath}/content/program/recentTicks/${tickIndex}`, value: `t${tickIndex}` }],
      inversePatches: [{ op: "remove", path: `${tilePath}/content/program/recentTicks/${tickIndex}` }]
    }]
  };
}

// Puts the planned writes into a copy of the history and returns it in its new stored order.
function applyPlan(entries: IStoredEntry[]) {
  const plan = planHistoryRepair(entries);
  const byId = new Map(entries.map(entry => [entry.docId, { ...entry }]));
  for (const write of plan.writes) {
    const entry = byId.get(write.docId)!;
    if (write.index !== undefined) entry.index = write.index;
    if (write.previousEntryId !== undefined) entry.previousEntryId = write.previousEntryId ?? undefined;
  }
  return [...byId.values()].sort((a, b) => a.index - b.index);
}

// Replays a history from the start to the end and back, as plain JSON patches.
function replay(entries: IStoredEntry[]) {
  const doc = { content: { rowMap: {}, rowOrder: [], tileMap: {} } };
  entries.forEach(entry => entry.records.forEach(record => applyJsonPatches(doc, record.patches as any)));
  [...entries].reverse().forEach(entry => [...entry.records].reverse().forEach(record =>
    applyJsonPatches(doc, [...(record.inversePatches as any)].reverse())));
  return doc;
}

describe("tilePathInfo", () => {
  it("finds the tile a path points at or into", () => {
    expect(tilePathInfo("/content/tileMap/T1")).toEqual({ tileId: "T1", inside: false });
    expect(tilePathInfo("/content/tileMap/T1/content/x")).toEqual({ tileId: "T1", inside: true });
    expect(tilePathInfo("/content/rowOrder/0")).toBeUndefined();
    expect(tilePathInfo("/content/tileMap")).toBeUndefined();
  });
});

describe("planHistoryRepair", () => {
  it("moves a change to a tile to just after the entry that creates the tile", () => {
    const entries = [setOutputConfig("A", 0), addTile("B", 1, "A"), tick("C", 2, "B")];
    const plan = planHistoryRepair(entries);
    expect(plan.skipped).toBeUndefined();
    expect(plan.moves).toEqual(
      [expect.objectContaining({ entryId: "A", afterEntryId: "B", tileIds: [tile], distance: 1 })]);
    expect(plan.writes).toEqual([
      { docId: "B", index: 0, previousEntryId: null },
      { docId: "A", index: 1, previousEntryId: "B" },
      { docId: "C", previousEntryId: "A" }
    ]);
    expect(plan.lastEntry).toBeUndefined();
  });

  it("leaves a history that replays from end to start, which the stored order doesn't", () => {
    const entries = [setOutputConfig("A", 0), addTile("B", 1, "A"), tick("C", 2, "B")];
    expect(() => replay(entries)).toThrow();
    const repaired = applyPlan(entries);
    expect(repaired.map(entry => entry.docId)).toEqual(["B", "A", "C"]);
    expect(replay(repaired)).toEqual({ content: { rowMap: {}, rowOrder: [], tileMap: {} } });
  });

  it("keeps the relative order of several entries moved after the same creation", () => {
    const entries = [setOutputConfig("A", 0), tick("B", 1, "A"), addTile("C", 2, "B"), tick("D", 3, "C", 1)];
    expect(applyPlan(entries).map(entry => entry.docId)).toEqual(["C", "A", "B", "D"]);
  });

  it("updates the last entry when the reordered span ends the history", () => {
    const earlier: IStoredEntry = { docId: "Z", index: 5,
      records: [{ patches: [{ op: "replace", path: "/content/title", value: "x" }], inversePatches: [] }] };
    const entries = [earlier, setOutputConfig("A", 6, "Z"), addTile("B", 7, "A")];
    const plan = planHistoryRepair(entries);
    expect(plan.lastEntry).toEqual({ id: "A", index: 7 });
    expect(plan.writes).toEqual([
      { docId: "B", index: 6, previousEntryId: "Z" },
      { docId: "A", index: 7, previousEntryId: "B" }
    ]);
  });

  it("changes nothing in a history that is already in order", () => {
    const entries = [addTile("A", 0), setOutputConfig("B", 1, "A"), tick("C", 2, "B")];
    expect(planHistoryRepair(entries)).toEqual({ moves: [], writes: [] });
  });

  it("leaves changes to a tile from the starting content alone", () => {
    // No entry creates T1, so it was in the content the history starts from.
    expect(planHistoryRepair([setOutputConfig("A", 0), tick("B", 1, "A")])).toEqual({ moves: [], writes: [] });
  });

  it("treats a tile that is replaced or removed as having existed", () => {
    const replaced: IStoredEntry = { docId: "B", index: 1, previousEntryId: "A",
      records: [{ patches: [{ op: "replace", path: tilePath, value: {} }], inversePatches: [] }] };
    expect(planHistoryRepair([setOutputConfig("A", 0), replaced, addTile("C", 2, "B")]).moves).toEqual([]);

    const removed: IStoredEntry = { docId: "B", index: 1, previousEntryId: "A",
      records: [{ patches: [{ op: "remove", path: tilePath }], inversePatches: [] }] };
    // Deleting the tile and undoing that adds it back; the change before the delete stays put.
    expect(planHistoryRepair([setOutputConfig("A", 0), removed, addTile("C", 2, "B")]).moves).toEqual([]);
  });

  it("skips an entry that also changes something outside the tile", () => {
    const entry = setOutputConfig("A", 0);
    entry.records.push({ patches: [{ op: "add", path: "/content/rowOrder/0", value: "R9" }], inversePatches: [] });
    const plan = planHistoryRepair([entry, addTile("B", 1, "A")]);
    expect(plan.writes).toEqual([]);
    expect(plan.skipped).toMatch(/outside that tile/);
  });

  it("skips a span whose entries share an index", () => {
    const plan = planHistoryRepair([setOutputConfig("A", 0), addTile("B", 0, "A")]);
    expect(plan.writes).toEqual([]);
    expect(plan.skipped).toMatch(/share an index/);
  });

  it("skips a span whose previousEntryId chain doesn't follow the index order", () => {
    const plan = planHistoryRepair([setOutputConfig("A", 0), addTile("B", 1, "X")]);
    expect(plan.writes).toEqual([]);
    expect(plan.skipped).toMatch(/previousEntryId/);
  });
});

describe("toStoredEntry", () => {
  it("keeps the paths and drops the values, except the tile ids of a whole tile map", () => {
    const entry = {
      id: "A", action: "/content/setContent",
      records: [{
        patches: [
          { op: "replace", path: "/content", value: { tileMap: { T1: { big: "x" }, T2: {} } } },
          { op: "replace", path: `${tilePath}/content/outputConfig`, value: outputConfig }
        ],
        inversePatches: [{ op: "replace", path: `${tilePath}/content/outputConfig` }]
      }]
    };
    const fields: Record<string, any> = {
      index: 4, previousEntryId: "Z", created: { toMillis: () => 1000 }, entry: JSON.stringify(entry)
    };
    expect(toStoredEntry({ id: "A", get: (field: string) => fields[field] } as any)).toEqual({
      docId: "A", index: 4, previousEntryId: "Z", created: 1000, action: "/content/setContent",
      records: [{
        patches: [
          { op: "replace", path: "/content/tileMap", value: { T1: true, T2: true } },
          { op: "replace", path: `${tilePath}/content/outputConfig` }
        ],
        inversePatches: [{ op: "replace", path: `${tilePath}/content/outputConfig` }]
      }]
    });
  });
});

describe("repairDocumentHistory", () => {
  const minutesAgo = (minutes: number) => ({ toMillis: () => Date.now() - minutes * 60 * 1000 });
  const stored = (entry: IStoredEntry, created = minutesAgo(120)) => ({
    id: entry.docId,
    get: (field: string) => ({
      index: entry.index, previousEntryId: entry.previousEntryId, created,
      entry: JSON.stringify({ id: entry.docId, action: entry.action, records: entry.records })
    } as Record<string, any>)[field]
  });

  function makeDb(historyDocs: any[], metadata: Record<string, any> = {}) {
    const updates: { path: string; fields: any }[] = [];
    let committed = false;
    const docRef: any = {
      path: "authed/p/documents/D1",
      get: () => Promise.resolve({ get: (field: string) => metadata[field] }),
      collection: () => {
        const query: any = {
          orderBy: () => query, limit: () => query, startAfter: () => query,
          get: () => Promise.resolve({ docs: historyDocs, size: historyDocs.length }),
          doc: (id: string) => ({ path: `authed/p/documents/D1/history/${id}` })
        };
        return query;
      }
    };
    const db: any = {
      batch: () => ({
        update: (ref: any, fields: any) => { updates.push({ path: ref.path, fields }); },
        commit: () => { committed = true; return Promise.resolve(); }
      })
    };
    return { db, docRef, updates, isCommitted: () => committed };
  }

  const outOfOrder = () =>
    [setOutputConfig("A", 0), addTile("B", 1, "A"), tick("C", 2, "B")].map(e => stored(e));

  it("reports without writing on a dry run", async () => {
    const { db, docRef, isCommitted } = makeDb(outOfOrder());
    const result = await repairDocumentHistory(db, docRef);
    expect(result.moves).toHaveLength(1);
    expect(result.writes).toBe(3);
    expect(isCommitted()).toBe(false);
  });

  it("writes the new order in one batch, removing the new first entry's previousEntryId", async () => {
    const { db, docRef, updates, isCommitted } = makeDb(outOfOrder());
    await repairDocumentHistory(db, docRef, { apply: true });
    expect(isCommitted()).toBe(true);
    expect(updates).toEqual([
      { path: "authed/p/documents/D1/history/B", fields: { index: 0, previousEntryId: FieldValue.delete() } },
      { path: "authed/p/documents/D1/history/A", fields: { index: 1, previousEntryId: "B" } },
      { path: "authed/p/documents/D1/history/C", fields: { previousEntryId: "A" } }
    ]);
  });

  it("updates lastHistoryEntry when the document has one and the span ends the history", async () => {
    const docs = [setOutputConfig("A", 0), addTile("B", 1, "A")].map(e => stored(e));
    const { db, docRef, updates } = makeDb(docs, { lastHistoryEntry: { id: "B", index: 1 } });
    await repairDocumentHistory(db, docRef, { apply: true });
    expect(updates).toContainEqual(
      { path: "authed/p/documents/D1", fields: { lastHistoryEntry: { id: "A", index: 1 } } });
  });

  it("skips a document whose history changed recently", async () => {
    const docs = [stored(setOutputConfig("A", 0)), stored(addTile("B", 1, "A"), minutesAgo(5))];
    const { db, docRef, isCommitted } = makeDb(docs);
    const result = await repairDocumentHistory(db, docRef, { apply: true });
    expect(result.skipped).toMatch(/60 minutes/);
    expect(isCommitted()).toBe(false);
  });
});
