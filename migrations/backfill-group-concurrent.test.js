const { backfillGroupConcurrent } = require("./backfill-group-concurrent");

// Minimal Firestore-admin stand-in: a collectionGroup query returning canned docs, and a batch recorder.
function makeDb(docs) {
  const writes = [];
  const batch = { set: (ref, data, opts) => writes.push({ ref, data, opts }), commit: () => Promise.resolve() };
  return {
    writes,
    collectionGroup: () => ({
      where: () => ({ get: () => Promise.resolve({ size: docs.length, docs }) })
    }),
    batch: () => batch,
  };
}
const mkDoc = (key, concurrent) => ({
  ref: { path: `authed/p/documents/${key}` },
  get: (f) => (f === "concurrent" ? concurrent : undefined),
});

describe("backfillGroupConcurrent", () => {
  it("dry run reports counts and writes nothing", async () => {
    const db = makeDb([mkDoc("a"), mkDoc("b", true)]);
    const res = await backfillGroupConcurrent(db, { dryRun: true, log: () => {} });
    expect(res).toEqual({ total: 2, updated: 0 });
    expect(db.writes.length).toBe(0);
  });

  it("APPLY writes concurrent+kind only to group docs missing concurrent", async () => {
    const db = makeDb([mkDoc("a"), mkDoc("b", true), mkDoc("c")]);
    const res = await backfillGroupConcurrent(db, { dryRun: false, log: () => {} });
    expect(res).toEqual({ total: 3, updated: 2 });
    expect(db.writes.map(w => w.ref.path)).toEqual(["authed/p/documents/a", "authed/p/documents/c"]);
    expect(db.writes[0]).toMatchObject({ data: { concurrent: true, kind: "group" }, opts: { merge: true } });
  });

  it("is idempotent — a fully-migrated set writes nothing", async () => {
    const db = makeDb([mkDoc("a", true), mkDoc("b", true)]);
    const res = await backfillGroupConcurrent(db, { dryRun: false, log: () => {} });
    expect(res).toEqual({ total: 2, updated: 0 });
    expect(db.writes.length).toBe(0);
  });
});
