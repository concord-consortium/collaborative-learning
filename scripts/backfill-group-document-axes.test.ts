import type { Firestore } from "firebase-admin/firestore";
import { backfillGroupDocumentAxes } from "./backfill-group-document-axes";

// Minimal Firestore-admin stand-in: a collection-group query returning canned docs, and a batch recorder.
function makeDb(docs: any[]) {
  const writes: any[] = [];
  const batch = {
    set: (ref: any, data: any, opts: any) => { writes.push({ ref, data, opts }); },
    commit: () => Promise.resolve(),
  };
  return {
    writes,
    collectionGroup: () => ({
      where: () => ({ get: () => Promise.resolve({ size: docs.length, docs }) }),
    }),
    batch: () => batch,
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
    expect(res).toEqual({ total: 3, concurrentUpdated: 0, scopeUpdated: 0 });
    expect(db.writes.length).toBe(0);
  });

  it("stamps concurrent+kind only on group-scoped docs missing concurrent", async () => {
    const db = makeDb([mkGroupDoc("a"), mkGroupDoc("b", true), mkGroupDoc("c")]);
    const res = await backfillGroupDocumentAxes(db as unknown as Firestore, { dryRun: false, ...quiet });
    expect(res).toEqual({ total: 3, concurrentUpdated: 2, scopeUpdated: 0 });
    expect(db.writes.map((w: any) => w.ref.path)).toEqual(["authed/p/documents/a", "authed/p/documents/c"]);
    expect(db.writes[0]).toMatchObject({ data: { concurrent: true, kind: "group" }, opts: { merge: true } });
  });

  it("stamps null curriculum scope only on class-wide docs that lack it", async () => {
    const db = makeDb([
      mkClassWideDoc("old"),                                       // needs both fields
      mkClassWideDoc("new", { investigation: null, problem: null }) // already migrated
    ]);
    const res = await backfillGroupDocumentAxes(db as unknown as Firestore, { dryRun: false, ...quiet });
    expect(res).toEqual({ total: 2, concurrentUpdated: 0, scopeUpdated: 1 });
    expect(db.writes).toEqual([{
      ref: { path: "authed/p/documents/old" },
      data: { investigation: null, problem: null },
      opts: { merge: true }
    }]);
  });

  it("never stamps the group kind onto a class-wide document", async () => {
    // A class-wide document that somehow lacks `concurrent` must not be swept into the group pass:
    // kind:"group" would break both its title resolution and its canonical-pointer slot.
    const db = makeDb([mkClassWideDoc("cw", { concurrent: undefined })]);
    const res = await backfillGroupDocumentAxes(db as unknown as Firestore, { dryRun: false, ...quiet });
    expect(res.concurrentUpdated).toBe(0);
    expect(db.writes.every((w: any) => w.data.kind === undefined)).toBe(true);
  });

  it("is idempotent — a fully-migrated set writes nothing", async () => {
    const db = makeDb([
      mkGroupDoc("a", true),
      mkClassWideDoc("c", { investigation: null, problem: null })
    ]);
    const res = await backfillGroupDocumentAxes(db as unknown as Firestore, { dryRun: false, ...quiet });
    expect(res).toEqual({ total: 2, concurrentUpdated: 0, scopeUpdated: 0 });
    expect(db.writes.length).toBe(0);
  });
});
