import type { Firestore } from "firebase-admin/firestore";
import { backfillGroupConcurrent } from "./backfill-group-concurrent";

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
const mkDoc = (key: string, concurrent?: boolean) => ({
  ref: { path: `authed/p/documents/${key}` },
  get: (field: string) => (field === "concurrent" ? concurrent : undefined),
});

describe("backfillGroupConcurrent", () => {
  it("dry run reports counts and writes nothing", async () => {
    const db = makeDb([mkDoc("a"), mkDoc("b", true)]);
    const res = await backfillGroupConcurrent(db as unknown as Firestore, { dryRun: true, log: () => undefined });
    expect(res).toEqual({ total: 2, updated: 0 });
    expect(db.writes.length).toBe(0);
  });

  it("APPLY writes concurrent+kind only to group docs missing concurrent", async () => {
    const db = makeDb([mkDoc("a"), mkDoc("b", true), mkDoc("c")]);
    const res = await backfillGroupConcurrent(db as unknown as Firestore, { dryRun: false, log: () => undefined });
    expect(res).toEqual({ total: 3, updated: 2 });
    expect(db.writes.map((w: any) => w.ref.path)).toEqual(["authed/p/documents/a", "authed/p/documents/c"]);
    expect(db.writes[0]).toMatchObject({ data: { concurrent: true, kind: "group" }, opts: { merge: true } });
  });

  it("is idempotent — a fully-migrated set writes nothing", async () => {
    const db = makeDb([mkDoc("a", true), mkDoc("b", true)]);
    const res = await backfillGroupConcurrent(db as unknown as Firestore, { dryRun: false, log: () => undefined });
    expect(res).toEqual({ total: 2, updated: 0 });
    expect(db.writes.length).toBe(0);
  });
});
