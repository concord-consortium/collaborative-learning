import type { Firestore } from "firebase-admin/firestore";
import { backfillGroupDocumentAxes } from "./backfill-group-document-axes";

// Minimal Firestore-admin stand-in: a collection-group query returning canned docs, and a batch recorder.
//
// `calls` pins down what the script actually queries with — collectionGroup() and where()'s arguments —
// so a test can assert the query predicate itself, not just its mocked-out result. Without this, a script
// that queried `type == "axes"` (and so never converged) would pass the suite identically to the real one.
//
// `batch()` hands out a fresh recorder each call, so `batches` exposes each commit's writes separately —
// needed to assert where a run splits across the 400-document chunk boundary. `writes` stays a flattened
// view across every batch so existing assertions that treat it as one flat list are unaffected.
//
// Each recorder tracks whether it was actually committed, and `committed` filters to those. Counting
// allocations instead would not distinguish a run that commits its final partial batch from one that
// drops it — and a dropped final commit silently under-migrates, which is the failure this mock exists
// to make visible.
function makeDb(docs: any[]) {
  const batches: { writes: any[]; committed: boolean; commit: () => Promise<void> }[] = [];
  const calls: { collectionGroup?: string; where?: [string, string, any] } = {};
  return {
    batches,
    get writes() {
      return batches.flatMap((b) => b.writes);
    },
    get committed() {
      return batches.filter((b) => b.committed);
    },
    calls,
    collectionGroup: (collectionId: string) => {
      calls.collectionGroup = collectionId;
      return {
        where: (field: string, op: string, value: any) => {
          calls.where = [field, op, value];
          return { get: () => Promise.resolve({ size: docs.length, docs }) };
        },
      };
    },
    batch: () => {
      const writes: any[] = [];
      const b = {
        writes,
        committed: false,
        set: (ref: any, data: any, opts: any) => { writes.push({ ref, data, opts }); },
        commit: () => { b.committed = true; return Promise.resolve(); },
      };
      batches.push(b);
      return b;
    },
  };
}

// A group-scoped document: carries a groupId.
const mkGroupDoc = (key: string, concurrent?: boolean) => ({
  ref: { path: `authed/p/documents/${key}` },
  get: (field: string) => ({ concurrent, groupId: "3" } as Record<string, any>)[field],
});
// A class-wide document: no groupId. `fields` supplies whatever scope fields it already has.
const mkClassWideDoc = (key: string, fields: Record<string, any> = {}) => ({
  ref: { path: `authed/p/documents/${key}` },
  get: (field: string) => ({ concurrent: true, ...fields } as Record<string, any>)[field],
});

const quiet = { log: () => undefined };

describe("backfillGroupDocumentAxes", () => {
  it("dry run reports both passes and writes nothing", async () => {
    const db = makeDb([mkGroupDoc("a"), mkGroupDoc("b", true), mkClassWideDoc("c")]);
    const res = await backfillGroupDocumentAxes(db as unknown as Firestore, { dryRun: true, ...quiet });
    expect(res).toEqual({ total: 3, concurrentUpdated: 0, scopeUpdated: 0, typeUpdated: 0 });
    expect(db.writes.length).toBe(0);
  });

  it("stamps concurrent+kind only on group-scoped docs missing concurrent, merged with the type rename", async () => {
    const db = makeDb([mkGroupDoc("a"), mkGroupDoc("b", true), mkGroupDoc("c")]);
    const res = await backfillGroupDocumentAxes(db as unknown as Firestore, { dryRun: false, ...quiet });
    expect(res).toEqual({ total: 3, concurrentUpdated: 2, scopeUpdated: 0, typeUpdated: 3 });
    // Every returned doc gets the type rename; only "a" and "c" also get concurrent+kind — one write each.
    expect(db.writes).toEqual([
      {
        ref: { path: "authed/p/documents/a" },
        data: { type: "axes", concurrent: true, kind: "group" },
        opts: { merge: true }
      },
      {
        ref: { path: "authed/p/documents/b" },
        data: { type: "axes" },
        opts: { merge: true }
      },
      {
        ref: { path: "authed/p/documents/c" },
        data: { type: "axes", concurrent: true, kind: "group" },
        opts: { merge: true }
      },
    ]);
  });

  it("stamps null curriculum scope only on class-wide docs that lack it, merged with the type rename", async () => {
    const db = makeDb([
      mkClassWideDoc("old"),                                       // needs both fields
      mkClassWideDoc("new", { investigation: null, problem: null }) // already migrated
    ]);
    const res = await backfillGroupDocumentAxes(db as unknown as Firestore, { dryRun: false, ...quiet });
    expect(res).toEqual({ total: 2, concurrentUpdated: 0, scopeUpdated: 1, typeUpdated: 2 });
    // "new" needs no scope fields, but every returned doc still gets the type rename.
    expect(db.writes).toEqual([
      {
        ref: { path: "authed/p/documents/old" },
        data: { type: "axes", investigation: null, problem: null },
        opts: { merge: true }
      },
      {
        ref: { path: "authed/p/documents/new" },
        data: { type: "axes" },
        opts: { merge: true }
      },
    ]);
  });

  it("never stamps the group kind onto a class-wide document", async () => {
    // A class-wide document that somehow lacks `concurrent` must not be swept into the group pass:
    // kind:"group" would break both its title resolution and its canonical-pointer slot.
    const db = makeDb([mkClassWideDoc("cw", { concurrent: undefined })]);
    const res = await backfillGroupDocumentAxes(db as unknown as Firestore, { dryRun: false, ...quiet });
    expect(res.concurrentUpdated).toBe(0);
    expect(db.writes.every((w: any) => w.data.kind === undefined)).toBe(true);
  });

  it("writes only the type rename when concurrent and curriculum scope are already set", async () => {
    // These docs are fully migrated on the concurrent/scope axes, but the query itself only returns
    // documents still storing type:"group" — so each still gets exactly one write, for `type` alone.
    const db = makeDb([
      mkGroupDoc("a", true),
      mkClassWideDoc("c", { investigation: null, problem: null })
    ]);
    const res = await backfillGroupDocumentAxes(db as unknown as Firestore, { dryRun: false, ...quiet });
    expect(res).toEqual({ total: 2, concurrentUpdated: 0, scopeUpdated: 0, typeUpdated: 2 });
    expect(db.writes).toEqual([
      { ref: { path: "authed/p/documents/a" }, data: { type: "axes" }, opts: { merge: true } },
      { ref: { path: "authed/p/documents/c" }, data: { type: "axes" }, opts: { merge: true } },
    ]);
  });

  it("writes type together with concurrent in a single merged write", async () => {
    // One write per document, never two: the driving query is type=="group", so a document whose type
    // write committed separately from (and ahead of) its concurrent+kind write would drop out of the
    // query the instant `type` landed, and a re-run could never find it again to finish the job.
    const db = makeDb([mkGroupDoc("a")]);
    const res = await backfillGroupDocumentAxes(db as unknown as Firestore, { dryRun: false, ...quiet });
    expect(res).toEqual({ total: 1, concurrentUpdated: 1, scopeUpdated: 0, typeUpdated: 1 });
    expect(db.writes).toEqual([{
      ref: { path: "authed/p/documents/a" },
      data: { concurrent: true, kind: "group", type: "axes" },
      opts: { merge: true }
    }]);
  });

  it("writes type together with curriculum scope in a single merged write", async () => {
    const db = makeDb([mkClassWideDoc("cw")]);
    const res = await backfillGroupDocumentAxes(db as unknown as Firestore, { dryRun: false, ...quiet });
    expect(res).toEqual({ total: 1, concurrentUpdated: 0, scopeUpdated: 1, typeUpdated: 1 });
    expect(db.writes).toEqual([{
      ref: { path: "authed/p/documents/cw" },
      data: { investigation: null, problem: null, type: "axes" },
      opts: { merge: true }
    }]);
  });

  it("writes type alone for a document that needs nothing else", async () => {
    // Already has concurrent+kind: the query still returns it (it still stores type:"group"), so it
    // still needs the rename, and nothing else.
    const db = makeDb([mkGroupDoc("done", true)]);
    const res = await backfillGroupDocumentAxes(db as unknown as Firestore, { dryRun: false, ...quiet });
    expect(res).toEqual({ total: 1, concurrentUpdated: 0, scopeUpdated: 0, typeUpdated: 1 });
    expect(db.writes).toEqual([{
      ref: { path: "authed/p/documents/done" },
      data: { type: "axes" },
      opts: { merge: true }
    }]);
  });

  it("is idempotent — a re-run finds nothing, because the query no longer matches", async () => {
    // After a successful run the documents store type:"axes", so the type=="group" query returns none.
    const db = makeDb([]);
    const res = await backfillGroupDocumentAxes(db as unknown as Firestore, { dryRun: false, ...quiet });
    expect(res).toEqual({ total: 0, concurrentUpdated: 0, scopeUpdated: 0, typeUpdated: 0 });
    expect(db.writes.length).toBe(0);
  });

  it("queries the documents collection group for the pre-rename type, not the value it writes", async () => {
    // The genuine idempotency property is that the queried value differs from the written value. A
    // script that queried type=="axes" instead would never converge, yet would pass every other test
    // in this file — this is the one assertion that pins the query itself down.
    const db = makeDb([mkGroupDoc("a", true)]);
    await backfillGroupDocumentAxes(db as unknown as Firestore, { dryRun: false, ...quiet });
    expect(db.calls.collectionGroup).toBe("documents");
    expect(db.calls.where).toEqual(["type", "==", "group"]);
  });

  it("commits a 401-document run as two batches of 400 and 1", async () => {
    // No other test in this file feeds enough documents to reach a chunk boundary, so neither the split
    // nor the tail commit is pinned anywhere else. Asserting on `committed` rather than `batches` is what
    // makes this fail if the `n % 400 !== 0` tail commit is dropped — allocating the batch is not the
    // same as committing it, and a dropped tail silently under-migrates the last partial chunk.
    const docs = Array.from({ length: 401 }, (_, i) => mkGroupDoc(`d${i}`, true));
    const db = makeDb(docs);
    const res = await backfillGroupDocumentAxes(db as unknown as Firestore, { dryRun: false, ...quiet });
    expect(res.total).toBe(401);
    expect(db.committed.length).toBe(2);
    expect(db.committed[0].writes.length).toBe(400);
    expect(db.committed[1].writes.length).toBe(1);
  });

  it("commits nothing when a dry run finds documents to migrate", async () => {
    // Pairs with the assertion above: `committed` must stay empty even though the query matched.
    const db = makeDb([mkGroupDoc("a"), mkClassWideDoc("c")]);
    await backfillGroupDocumentAxes(db as unknown as Firestore, { dryRun: true, ...quiet });
    expect(db.committed.length).toBe(0);
  });
});
