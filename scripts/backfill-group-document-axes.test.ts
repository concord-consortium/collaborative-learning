import type { Firestore } from "firebase-admin/firestore";
import { backfillGroupDocumentAxes } from "./backfill-group-document-axes";
import { kClassWideProfile, kGroupProfile } from "../src/models/document/document-axis-profiles";

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

// A group-scoped document: carries a groupId. `fields` supplies whatever else it already has.
const mkGroupDoc = (key: string, concurrent?: boolean, fields: Record<string, any> = {}) => ({
  ref: { path: `authed/p/documents/${key}` },
  get: (field: string) => ({ concurrent, groupId: "3", ...fields } as Record<string, any>)[field],
});
// A class-wide document: no groupId. `fields` supplies whatever scope fields it already has.
const mkClassWideDoc = (key: string, fields: Record<string, any> = {}) => ({
  ref: { path: `authed/p/documents/${key}` },
  get: (field: string) => ({ concurrent: true, ...fields } as Record<string, any>)[field],
});

const quiet = { log: () => undefined };

describe("backfillGroupDocumentAxes", () => {
  it("dry run reports every pass and writes nothing", async () => {
    const db = makeDb([mkGroupDoc("a"), mkGroupDoc("b", true), mkClassWideDoc("c")]);
    const res = await backfillGroupDocumentAxes(db as unknown as Firestore, { dryRun: true, ...quiet });
    expect(res).toEqual({ total: 3, concurrentUpdated: 0, scopeUpdated: 0, profileUpdated: 0 });
    expect(db.writes.length).toBe(0);
  });

  it("stamps concurrent+kind only on group-scoped docs missing concurrent", async () => {
    const db = makeDb([
      mkGroupDoc("a"),
      mkGroupDoc("b", true, { axisProfile: kGroupProfile.name }),
      mkGroupDoc("c")
    ]);
    const res = await backfillGroupDocumentAxes(db as unknown as Firestore, { dryRun: false, ...quiet });
    expect(res).toEqual({ total: 3, concurrentUpdated: 2, scopeUpdated: 0, profileUpdated: 2 });
    expect(db.writes.map((w: any) => w.ref.path)).toEqual(["authed/p/documents/a", "authed/p/documents/c"]);
    expect(db.writes[0]).toMatchObject({ data: { concurrent: true, kind: "group" }, opts: { merge: true } });
  });

  it("stamps null curriculum scope only on class-wide docs that lack it", async () => {
    const db = makeDb([
      // needs both fields
      mkClassWideDoc("old", { axisProfile: kClassWideProfile.name }),
      // already migrated
      mkClassWideDoc("new", { axisProfile: kClassWideProfile.name, investigation: null, problem: null })
    ]);
    const res = await backfillGroupDocumentAxes(db as unknown as Firestore, { dryRun: false, ...quiet });
    expect(res).toEqual({ total: 2, concurrentUpdated: 0, scopeUpdated: 1, profileUpdated: 0 });
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

  it("records the profile each document was created from, chosen by the same scope split", async () => {
    // The profile is what a later migration selects on, so every document the query returns needs one.
    // Scope decides which: a groupId means the group profile, its absence the class-wide one. Expected
    // against the profile definitions themselves — the script repeats their names as literals, so
    // nothing else would catch a rename.
    const db = makeDb([
      mkGroupDoc("g", true),
      mkClassWideDoc("cw", { investigation: null, problem: null })
    ]);
    const res = await backfillGroupDocumentAxes(db as unknown as Firestore, { dryRun: false, ...quiet });
    expect(res.profileUpdated).toBe(2);
    expect(db.writes).toEqual([
      { ref: { path: "authed/p/documents/g" }, data: { axisProfile: kGroupProfile.name }, opts: { merge: true } },
      { ref: { path: "authed/p/documents/cw" }, data: { axisProfile: kClassWideProfile.name },
        opts: { merge: true } }
    ]);
  });

  it("writes a document once, carrying every field that document is missing", async () => {
    // The profile pass overlaps the other two, and two batched writes to one document would cost twice
    // as much for the same result.
    const db = makeDb([mkGroupDoc("g")]);
    await backfillGroupDocumentAxes(db as unknown as Firestore, { dryRun: false, ...quiet });
    expect(db.writes).toEqual([{
      ref: { path: "authed/p/documents/g" },
      data: { axisProfile: kGroupProfile.name, concurrent: true, kind: "group" },
      opts: { merge: true }
    }]);
  });

  it("is idempotent — a fully-migrated set writes nothing", async () => {
    const db = makeDb([
      mkGroupDoc("a", true, { axisProfile: kGroupProfile.name }),
      mkClassWideDoc("c", { axisProfile: kClassWideProfile.name, investigation: null, problem: null })
    ]);
    const res = await backfillGroupDocumentAxes(db as unknown as Firestore, { dryRun: false, ...quiet });
    expect(res).toEqual({ total: 2, concurrentUpdated: 0, scopeUpdated: 0, profileUpdated: 0 });
    expect(db.writes.length).toBe(0);
  });
});
