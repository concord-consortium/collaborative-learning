import {
  backfillDocumentOfferingId, classifyDocument, getSpaceFromFirestorePath, getSpaceLabel,
  isRtdbAddressable, kOfferingContainedTypes, parsePageSize, parseTypes, type IBucketCounts
} from "./backfill-document-offering-id";
import type { IMetadataDatabase } from "./lib/document-metadata-lookup";
import type { Firestore } from "firebase-admin/firestore";

describe("kOfferingContainedTypes", () => {
  it("lists exactly the offering-contained type values, including both generic axes values", () => {
    // "publication" — not "problemPublication" — is the stored value for a problem publication;
    // ProblemPublication in src/models/document/document-types.ts is the constant's name. A query on
    // the wrong string returns nothing and the census reports a confident, wrong zero.
    //
    // Both "group" and "axes" appear so this script and backfill-group-document-axes.ts can run in
    // either order during the sweep.
    expect(kOfferingContainedTypes).toEqual([
      "problem", "planning", "publication", "supportPublication", "group", "axes"
    ]);
  });
});

describe("getSpaceFromFirestorePath", () => {
  it("derives the RTDB base path for an authed portal", () => {
    // The portal segment is already underscore-escaped in the Firestore path, so it is used as-is.
    expect(getSpaceFromFirestorePath("authed/learn_concord_org/documents/abc")).toEqual({
      label: "authed/learn_concord_org",
      firebaseBasePath: "/authed/portals/learn_concord_org/classes"
    });
  });

  it("derives the RTDB base path for a demo space", () => {
    expect(getSpaceFromFirestorePath("demo/CLUE/documents/abc")).toEqual({
      label: "demo/CLUE",
      firebaseBasePath: "/demo/CLUE/portals/demo/classes"
    });
  });

  it("returns undefined for a path shape it does not recognize", () => {
    // A collection-group query reaches every `documents` collection anywhere in the database. An
    // unrecognized root must be counted and skipped, never guessed at and never fatal.
    expect(getSpaceFromFirestorePath("nosuchroot/whatever/documents/abc")).toBeUndefined();
    expect(getSpaceFromFirestorePath("authed//documents/abc")).toBeUndefined();
    expect(getSpaceFromFirestorePath("authed/learn_concord_org/other/abc")).toBeUndefined();
  });
});

describe("isRtdbAddressable", () => {
  it("accepts the ordinary push-id shaped segments", () => {
    expect(isRtdbAddressable("58de0784", "user-1", "-OXiK3RdodVskcYgwaAx")).toBe(true);
  });

  it("rejects any segment carrying a character the RTDB forbids in a path", () => {
    // Curriculum-authored supports carry human-readable keys like this one, which production has.
    expect(isRtdbAddressable("c1", "curriculum", "2.2 Initial Challenge Support 1")).toBe(false);
    for (const bad of [".", "#", "$", "[", "]", "/"]) {
      expect(isRtdbAddressable("c1", "u1", `key${bad}x`)).toBe(false);
      expect(isRtdbAddressable(`ctx${bad}`, "u1", "k1")).toBe(false);
      expect(isRtdbAddressable("c1", `uid${bad}`, "k1")).toBe(false);
    }
  });
});

describe("parseTypes", () => {
  it("defaults to every offering-contained type", () => {
    expect(parseTypes(undefined)).toEqual(kOfferingContainedTypes);
    expect(parseTypes("")).toEqual(kOfferingContainedTypes);
    expect(parseTypes("  ,  ")).toEqual(kOfferingContainedTypes);
  });

  it("accepts a subset, trimming whitespace", () => {
    expect(parseTypes("planning")).toEqual(["planning"]);
    expect(parseTypes(" problem , planning ")).toEqual(["problem", "planning"]);
  });

  it("throws on an unknown type rather than scanning nothing", () => {
    // The failure this prevents is silent: an unrecognized type matches no document, so the run
    // reports a clean empty census that is indistinguishable from "this type has no problems".
    // "problemPublication" is the specific typo worth guarding — the stored value is "publication".
    expect(() => parseTypes("problemPublication")).toThrow(/unknown type/i);
    expect(() => parseTypes("problem,nope")).toThrow(/nope/);
  });
});

describe("parsePageSize", () => {
  it("falls back when unset", () => {
    expect(parsePageSize(undefined, 300)).toBe(300);
    expect(parsePageSize("", 300)).toBe(300);
  });

  it("accepts a positive integer", () => {
    expect(parsePageSize("1000", 300)).toBe(1000);
  });

  it("rejects anything else", () => {
    for (const bad of ["0", "-5", "1.5", "lots"]) {
      expect(() => parsePageSize(bad, 300)).toThrow(/positive integer/);
    }
  });
});

describe("getSpaceLabel", () => {
  it("labels every root shape, falling back to unknown", () => {
    expect(getSpaceLabel("authed/learn_concord_org/documents/abc")).toBe("authed/learn_concord_org");
    expect(getSpaceLabel("demo/CLUE/documents/abc")).toBe("demo/CLUE");
    expect(getSpaceLabel("qa/someuid/documents/abc")).toBe("qa/someuid");
    expect(getSpaceLabel("nosuchroot/x/documents/abc")).toBe("unknown");
  });
});

describe("classifyDocument", () => {
  const kPath = "authed/learn_concord_org/documents/abc";
  const kLabel = "authed/learn_concord_org";
  const problem = { type: "problem", context_id: "class-1", uid: "user-1", key: "doc-1" };

  it("sends an offering-contained document with no offeringId to the lookup", () => {
    expect(classifyDocument(problem, kPath)).toEqual({
      kind: "lookup",
      space: { label: "authed/learn_concord_org", firebaseBasePath: "/authed/portals/learn_concord_org/classes" },
      contextId: "class-1",
      uid: "user-1",
      key: "doc-1"
    });
  });

  it("counts a document that already has an offeringId", () => {
    expect(classifyDocument({ ...problem, offeringId: "2001" }, kPath))
      .toEqual({ kind: "counted", bucket: "alreadySet", spaceLabel: kLabel });
  });

  it("skips a class-wide document under either generic type value", () => {
    // No groupId means class-wide, which is class-unit-contained and correctly has no offering.
    // Writing one would corrupt isInClassUnitContainer, which is the guard this change exists to fix.
    for (const type of ["group", "axes"]) {
      expect(classifyDocument({ type, context_id: "class-1", uid: "class_hash", key: "doc-1" }, kPath))
        .toEqual({ kind: "counted", bucket: "skippedClassWide", spaceLabel: kLabel });
    }
  });

  it("still reports a class-wide document that wrongly carries an offeringId", () => {
    // Classified before the alreadySet check on purpose: this combination should not exist, and
    // reporting it as alreadySet would hide it behind a bucket that reads like success.
    expect(classifyDocument(
      { type: "axes", context_id: "class-1", uid: "class_hash", key: "doc-1", offeringId: "2001" }, kPath
    )).toEqual({ kind: "counted", bucket: "skippedClassWide", spaceLabel: kLabel });
  });

  it("sends qa and dev documents to the lookup, with their own RTDB roots", () => {
    // Both stores derive their root from the same getRootId, so the Firestore root id is also the
    // RTDB root id. The portal segment is not in the path and differs per appMode: dev uses
    // "localhost" and qa uses "qa", both confirmed against production.
    expect(classifyDocument(problem, "qa/someuid/documents/abc")).toEqual({
      kind: "lookup",
      space: { label: "qa/someuid", firebaseBasePath: "/qa/someuid/portals/qa/classes" },
      contextId: "class-1", uid: "user-1", key: "doc-1"
    });
    expect(classifyDocument(problem, "dev/someuid/documents/abc")).toEqual({
      kind: "lookup",
      space: { label: "dev/someuid", firebaseBasePath: "/dev/someuid/portals/localhost/classes" },
      contextId: "class-1", uid: "user-1", key: "doc-1"
    });
  });

  it("reports a test-mode document as an unknown space rather than guessing its portal", () => {
    // `test` takes an arbitrary portal string, so its RTDB path genuinely cannot be derived from the
    // Firestore path. Guessing would send lookups to a path that does not exist and report the
    // results as missing metadata.
    expect(classifyDocument(problem, "test/someuid/documents/abc"))
      .toEqual({ kind: "counted", bucket: "unknownSpace", spaceLabel: "unknown" });
  });

  it("reports a key the RTDB cannot address instead of letting the lookup throw", () => {
    // Production carries curriculum supports keyed like this. The failure is permanent, so filing it
    // under lookupError — which reads as transient and retryable — would misdescribe the residue.
    expect(classifyDocument(
      { ...problem, uid: "curriculum", key: "2.2 Initial Challenge Support 1" }, kPath
    )).toEqual({ kind: "counted", bucket: "keyNotRtdbSafe", spaceLabel: kLabel });
  });

  it("sends a group-scoped document to the lookup under either generic type value", () => {
    // Both values, because which one a group document stores depends on whether
    // backfill-group-document-axes.ts has already run. Accepting only one would make the sweep
    // order-dependent, and silently miss every group document if the two ran the other way round.
    for (const type of ["group", "axes"]) {
      expect(classifyDocument({ ...problem, type, groupId: "3" }, kPath))
        .toMatchObject({ kind: "lookup", contextId: "class-1" });
    }
  });

  it("counts a document whose Firestore path is in no known space", () => {
    // Genuinely unrecognized, as distinct from a known-and-ignored test partition. Keeping the two
    // apart is what lets a non-zero unknownSpace count mean "look at this".
    expect(classifyDocument(problem, "nosuchroot/whatever/documents/abc"))
      .toEqual({ kind: "counted", bucket: "unknownSpace", spaceLabel: "unknown" });
  });

  it("counts a document missing any field the lookup needs", () => {
    for (const missing of ["context_id", "uid", "key"]) {
      const data: any = { ...problem };
      delete data[missing];
      expect(classifyDocument(data, kPath))
        .toEqual({ kind: "counted", bucket: "unusableDocument", spaceLabel: kLabel });
    }
  });
});

// Minimal RTDB stand-in. `nodes` maps a full path to the value stored there; a path absent from the
// map reads back as a non-existent node. `throwOn` makes a path reject, so a transport failure stays
// distinguishable from a missing node. `reads` records every path read, which is how a test asserts
// that a class-wide document was never looked up at all.
function makeRtdb(nodes: Record<string, any>, throwOn: string[] = []) {
  const reads: string[] = [];
  const db: IMetadataDatabase & { reads: string[] } = {
    reads,
    ref: (path: string) => ({
      once: (_eventType: "value") => {
        reads.push(path);
        if (throwOn.includes(path)) return Promise.reject(new Error("rtdb unavailable"));
        const value = nodes[path];
        return Promise.resolve({ exists: () => value !== undefined, val: () => value });
      }
    })
  };
  return db;
}

// Minimal Firestore-admin stand-in supporting the exact chain the script builds:
//   collectionGroup("documents").where("type","==",t).orderBy("__name__")[.startAfter(d)].limit(n).get()
//
// `docsByType` supplies the canned result per queried type, so pagination can be exercised by handing
// one type more documents than a page holds. `calls` records the query shape itself: a script that
// queried the wrong type string would return an empty, confident census and pass every other test.
function makeDb(docsByType: Record<string, any[]>) {
  const batches: { writes: any[]; committed: boolean; set: any; commit: () => Promise<void> }[] = [];
  const calls: { collectionGroup?: string; types: string[]; orderBy: string[] } =
    { types: [], orderBy: [] };

  const makeQuery = (all: any[], after: any) => ({
    orderBy: (field: string) => { calls.orderBy.push(field); return makeQuery(all, after); },
    startAfter: (doc: any) => makeQuery(all, doc),
    limit: (n: number) => ({
      get: () => {
        const start = after ? all.findIndex((d) => d.ref.path === after.ref.path) + 1 : 0;
        const docs = all.slice(start, start + n);
        return Promise.resolve({ docs, size: docs.length, empty: docs.length === 0 });
      }
    })
  });

  return {
    batches,
    calls,
    get writes() { return batches.flatMap((b) => b.writes); },
    get committed() { return batches.filter((b) => b.committed); },
    collectionGroup: (collectionId: string) => {
      calls.collectionGroup = collectionId;
      return {
        where: (_field: string, _op: string, value: string) => {
          calls.types.push(value);
          return makeQuery(docsByType[value] ?? [], undefined);
        }
      };
    },
    batch: () => {
      const writes: any[] = [];
      const b = {
        writes,
        committed: false,
        set: (ref: any, data: any, opts: any) => { writes.push({ ref, data, opts }); },
        commit: () => { b.committed = true; return Promise.resolve(); }
      };
      batches.push(b);
      return b;
    }
  };
}

const mkDoc = (path: string, data: any) => ({ ref: { path }, data: () => data });

const kSpace = "authed/learn_concord_org";
const kBase = "/authed/portals/learn_concord_org/classes";
const mdPath = (ctx: string, uid: string, key: string) =>
  `${kBase}/${ctx}/users/${uid}/documentMetadata/${key}`;

const quiet = { log: () => undefined };

const run = (db: any, rtdb: any, options: any = {}) =>
  backfillDocumentOfferingId(db as unknown as Firestore, rtdb, { ...quiet, ...options });

const bucket = (counts: IBucketCounts, name: keyof IBucketCounts) => counts[name];

describe("backfillDocumentOfferingId — scanning", () => {
  it("queries the documents collection group once per offering-contained type, ordered by name", async () => {
    const db = makeDb({});
    await run(db, makeRtdb({}), { dryRun: true });
    expect(db.calls.collectionGroup).toBe("documents");
    expect(db.calls.types).toEqual([
      "problem", "planning", "publication", "supportPublication", "group", "axes"
    ]);
    // Ordered by document id so the cursor is total and stable. Ordering on a field would need a
    // composite collection-group index that does not exist.
    expect(new Set(db.calls.orderBy)).toEqual(new Set(["__name__"]));
  });

  it("queries only the types it was given", async () => {
    // Sampling one type is how a large environment gets a cheap first look before a full sweep.
    const db = makeDb({});
    await run(db, makeRtdb({}), { dryRun: true, types: ["planning"] });
    expect(db.calls.types).toEqual(["planning"]);
  });

  it("resolves an offeringId from the RTDB metadata node", async () => {
    const doc = mkDoc(`${kSpace}/documents/a`,
      { type: "problem", context_id: "c1", uid: "u1", key: "k1" });
    const rtdb = makeRtdb({ [mdPath("c1", "u1", "k1")]: { offeringId: "2001" } });
    const res = await run(makeDb({ problem: [doc] }), rtdb, { dryRun: true });
    expect(res.scanned).toBe(1);
    expect(bucket(res.totals, "resolved")).toBe(1);
    expect(res.byType.problem.resolved).toBe(1);
    expect(res.bySpace[kSpace].resolved).toBe(1);
  });

  it("separates a missing metadata node from a node without the field", async () => {
    const docs = [
      mkDoc(`${kSpace}/documents/a`, { type: "problem", context_id: "c1", uid: "u1", key: "k1" }),
      mkDoc(`${kSpace}/documents/b`, { type: "problem", context_id: "c1", uid: "u1", key: "k2" })
    ];
    const rtdb = makeRtdb({ [mdPath("c1", "u1", "k2")]: { type: "problem" } });
    const res = await run(makeDb({ problem: docs }), rtdb, { dryRun: true });
    expect(bucket(res.totals, "noMetadataNode")).toBe(1);
    expect(bucket(res.totals, "nodeWithoutOfferingId")).toBe(1);
  });

  it("counts a failed RTDB read separately and keeps scanning", async () => {
    // A transport error is not evidence that the document has no offering. It must not be filed under
    // either not-found bucket, and it must not abort the run.
    const docs = [
      mkDoc(`${kSpace}/documents/a`, { type: "problem", context_id: "c1", uid: "u1", key: "k1" }),
      mkDoc(`${kSpace}/documents/b`, { type: "problem", context_id: "c1", uid: "u1", key: "k2" })
    ];
    const rtdb = makeRtdb({ [mdPath("c1", "u1", "k2")]: { offeringId: "2001" } },
      [mdPath("c1", "u1", "k1")]);
    const res = await run(makeDb({ problem: docs }), rtdb, { dryRun: true });
    expect(bucket(res.totals, "lookupError")).toBe(1);
    expect(bucket(res.totals, "resolved")).toBe(1);
    expect(res.scanned).toBe(2);
  });

  it("survives a space whose RTDB tree does not exist, and attributes it to that space", async () => {
    // Some demo spaces never received earlier migrations. Their unresolved documents must be visible as
    // theirs rather than folded into a global number.
    const docs = [
      mkDoc(`${kSpace}/documents/a`, { type: "problem", context_id: "c1", uid: "u1", key: "k1" }),
      mkDoc("demo/OLD/documents/b", { type: "problem", context_id: "c2", uid: "u2", key: "k2" })
    ];
    const rtdb = makeRtdb({ [mdPath("c1", "u1", "k1")]: { offeringId: "2001" } });
    const res = await run(makeDb({ problem: docs }), rtdb, { dryRun: true });
    expect(res.bySpace[kSpace].resolved).toBe(1);
    expect(res.bySpace["demo/OLD"].noMetadataNode).toBe(1);
    expect(res.bySpace["demo/OLD"].resolved).toBe(0);
  });

  it("never looks up a class-wide document", async () => {
    const docs = [mkDoc(`${kSpace}/documents/a`,
      { type: "axes", context_id: "c1", uid: "class_hash", key: "k1" })];
    const rtdb = makeRtdb({});
    const res = await run(makeDb({ axes: docs }), rtdb, { dryRun: true });
    expect(bucket(res.totals, "skippedClassWide")).toBe(1);
    expect(rtdb.reads).toEqual([]);
  });

  it("pages through a type with more documents than one page holds", async () => {
    const docs = Array.from({ length: 7 }, (_, i) =>
      mkDoc(`${kSpace}/documents/d${i}`,
        { type: "problem", context_id: "c1", uid: "u1", key: `k${i}` }));
    const nodes: Record<string, any> = {};
    docs.forEach((_, i) => { nodes[mdPath("c1", "u1", `k${i}`)] = { offeringId: "2001" }; });
    const res = await run(makeDb({ problem: docs }), makeRtdb(nodes),
      { dryRun: true, pageSize: 3 });
    expect(res.scanned).toBe(7);
    expect(bucket(res.totals, "resolved")).toBe(7);
  });

  it("reads every candidate exactly once when the page size divides the count evenly", async () => {
    // A cursor bug that re-reads or skips the last document of a page shows up here and nowhere else.
    const docs = Array.from({ length: 6 }, (_, i) =>
      mkDoc(`${kSpace}/documents/d${i}`,
        { type: "problem", context_id: "c1", uid: "u1", key: `k${i}` }));
    const rtdb = makeRtdb({});
    const res = await run(makeDb({ problem: docs }), rtdb, { dryRun: true, pageSize: 3 });
    expect(res.scanned).toBe(6);
    expect(rtdb.reads.length).toBe(6);
    expect(new Set(rtdb.reads).size).toBe(6);
  });

  it("writes and commits nothing on a dry run that found work", async () => {
    const doc = mkDoc(`${kSpace}/documents/a`,
      { type: "problem", context_id: "c1", uid: "u1", key: "k1" });
    const db = makeDb({ problem: [doc] });
    const res = await run(db, makeRtdb({ [mdPath("c1", "u1", "k1")]: { offeringId: "2001" } }),
      { dryRun: true });
    expect(bucket(res.totals, "resolved")).toBe(1);
    expect(res.written).toBe(0);
    expect(db.committed.length).toBe(0);
    expect(db.writes.length).toBe(0);
  });
});

describe("backfillDocumentOfferingId — writing", () => {
  const resolvedDocs = (n: number) => Array.from({ length: n }, (_, i) =>
    mkDoc(`${kSpace}/documents/d${i}`,
      { type: "problem", context_id: "c1", uid: "u1", key: `k${i}` }));
  const resolvedNodes = (n: number) => {
    const nodes: Record<string, any> = {};
    for (let i = 0; i < n; i++) nodes[mdPath("c1", "u1", `k${i}`)] = { offeringId: `200${i}` };
    return nodes;
  };

  it("merge-writes only the offeringId onto a resolved document", async () => {
    const db = makeDb({ problem: resolvedDocs(1) });
    const res = await run(db, makeRtdb(resolvedNodes(1)), { dryRun: false });
    expect(res.written).toBe(1);
    expect(db.writes).toEqual([{
      ref: { path: `${kSpace}/documents/d0` },
      data: { offeringId: "2000" },
      opts: { merge: true }
    }]);
    expect(db.committed.length).toBe(1);
  });

  it("writes nothing for any bucket other than resolved", async () => {
    // Everything the script cannot resolve is reported and left alone. That is what keeps the run
    // re-runnable while the policy for unresolvable documents is still open.
    const docs = [
      mkDoc(`${kSpace}/documents/a`, { type: "problem", context_id: "c1", uid: "u1", key: "k1" }),
      mkDoc(`${kSpace}/documents/b`, { type: "problem", offeringId: "9", context_id: "c1", uid: "u1", key: "k2" }),
      mkDoc(`${kSpace}/documents/c`, { type: "problem", uid: "u1", key: "k3" }),
      mkDoc("nosuchroot/x/documents/d", { type: "problem", context_id: "c1", uid: "u1", key: "k4" }),
      mkDoc(`${kSpace}/documents/e`, { type: "problem", context_id: "c1", uid: "curriculum", key: "2.2 Support 1" })
    ];
    const db = makeDb({ problem: docs });
    const res = await run(db, makeRtdb({}), { dryRun: false });
    expect(res.written).toBe(0);
    expect(db.writes).toEqual([]);
    // Each document must land in its own bucket, not merely fail to be written.
    expect(res.totals.noMetadataNode).toBe(1);
    expect(res.totals.alreadySet).toBe(1);
    expect(res.totals.unusableDocument).toBe(1);
    expect(res.totals.unknownSpace).toBe(1);
    expect(res.totals.keyNotRtdbSafe).toBe(1);
    expect(res.bySpace.unknown.unknownSpace).toBe(1);
    // Every scanned document is counted exactly once, so a miscounted bucket cannot hide.
    const summed = Object.values(res.totals).reduce((a, b) => a + b, 0);
    expect(summed).toBe(res.scanned);
  });

  it("never writes to a class-wide document under either generic type value", async () => {
    // The single most damaging bug available here: an offeringId on a class-wide document makes
    // isInClassUnitContainer misread it, which is precisely what this change exists to prevent.
    for (const type of ["group", "axes"]) {
      const docs = [mkDoc(`${kSpace}/documents/cw`,
        { type, context_id: "c1", uid: "class_hash", key: "k1" })];
      const db = makeDb({ [type]: docs });
      // A node exists that WOULD resolve, so this fails loudly if the class-wide guard is dropped.
      const res = await run(db, makeRtdb({ [mdPath("c1", "class_hash", "k1")]: { offeringId: "2001" } }),
        { dryRun: false });
      expect(db.writes).toEqual([]);
      expect(res.written).toBe(0);
    }
  });

  it("commits a 401-document run as two batches of 400 and 1", async () => {
    // Asserting on committed batches rather than allocated ones is what makes this fail if the final
    // partial commit is dropped — a dropped tail silently under-migrates and reports success.
    const db = makeDb({ problem: resolvedDocs(401) });
    const res = await run(db, makeRtdb(resolvedNodes(401)), { dryRun: false, pageSize: 150 });
    expect(res.written).toBe(401);
    expect(db.committed.length).toBe(2);
    expect(db.committed[0].writes.length).toBe(400);
    expect(db.committed[1].writes.length).toBe(1);
  });

  it("commits nothing when there is nothing to write", async () => {
    const db = makeDb({ problem: [
      mkDoc(`${kSpace}/documents/a`, { type: "problem", offeringId: "9", context_id: "c1", uid: "u1", key: "k1" })
    ] });
    await run(db, makeRtdb({}), { dryRun: false });
    expect(db.committed.length).toBe(0);
  });

  it("defaults to a dry run when no options are given", async () => {
    // Every other test passes dryRun explicitly, so nothing else would catch the default flipping.
    const db = makeDb({ problem: resolvedDocs(1) });
    const res = await backfillDocumentOfferingId(
      db as unknown as Firestore, makeRtdb(resolvedNodes(1))
    );
    expect(res.written).toBe(0);
    expect(db.writes).toEqual([]);
    expect(db.committed.length).toBe(0);
  });
});
