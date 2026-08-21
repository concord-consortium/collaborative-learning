import { createMissingDocumentMetadata } from "./create-missing-document-metadata";
import type { IDocumentHome } from "./lib/rtdb-document-index";

/** A Firestore stand-in exposing only what the creation pass uses: a paged id read and batched sets. */
function fakeFirestore(existing: Record<string, any> = {}) {
  const store: Record<string, any> = { ...existing };
  let pending: Array<{ id: string; data: any }> = [];
  let commits = 0;

  const firestore: any = {
    collection: (path: string) => ({
      select: () => ({
        limit: () => {
          const query: any = {
            startAfter: () => query,
            get: async () => ({
              empty: Object.keys(existing).length === 0,
              size: Object.keys(existing).length,
              docs: Object.keys(existing).map(id => ({ id, data: () => existing[id] }))
            })
          };
          return query;
        }
      })
    }),
    doc: (path: string) => ({ path, id: path.split("/").pop() }),
    batch: () => ({
      set: (ref: any, data: any) => { pending.push({ id: ref.id, data }); },
      commit: async () => {
        commits++;
        for (const w of pending) store[w.id] = w.data;
        pending = [];
      }
    })
  };
  return { firestore, store, commitCount: () => commits };
}

const home = (over: Partial<IDocumentHome> = {}): IDocumentHome =>
  ({ classHash: "c1", uid: "u1", hasContent: true, hasMetadata: true, ...over });

const silent = () => undefined;
const kRoot = "/demo/S/portals/demo";
const kSpace = "demo/S/documents";

/** Reads RTDB metadata nodes from a flat map keyed by document key. */
const nodeReaderFor = (nodes: Record<string, any>) =>
  async (path: string) => nodes[path.split("/").pop()!] ?? null;

describe("createMissingDocumentMetadata", () => {
  it("creates a row for an indexed document that has no Firestore metadata", async () => {
    const { firestore, store } = fakeFirestore();
    const index = new Map([["k1", home()]]);
    const nodes = { k1: { type: "learningLog", createdAt: 1700000000000, title: "My Log" } };

    const result = await createMissingDocumentMetadata(firestore, kSpace, index,
      { rtdbRoot: kRoot, readNode: nodeReaderFor(nodes) }, { dryRun: false, log: silent });

    expect(result.counts.created).toBe(1);
    expect(result.counts.written).toBe(1);
    expect(store.k1).toMatchObject({
      key: "k1", type: "learningLog", uid: "u1", context_id: "c1",
      createdAt: 1700000000000, title: "My Log", properties: {}
    });
  });

  it("never creates a row for a document whose content is gone", async () => {
    // 86 such documents exist outside production. A row here would promote an invisible orphan into
    // a Sort Work entry that throws when opened.
    const { firestore, store } = fakeFirestore();
    const index = new Map([["orphan", home({ hasContent: false })]]);
    const nodes = { orphan: { type: "personal", createdAt: 1, title: "Gone" } };

    const result = await createMissingDocumentMetadata(firestore, kSpace, index,
      { rtdbRoot: kRoot, readNode: nodeReaderFor(nodes) }, { dryRun: false, log: silent });

    expect(store.orphan).toBeUndefined();
    expect(result.counts.skippedNoContent).toBe(1);
    expect(result.counts.created).toBe(0);
  });

  it("leaves a document that already has a Firestore row untouched", async () => {
    const { firestore, store } = fakeFirestore({ k1: { key: "k1", type: "problem", context_id: "old" } });
    const index = new Map([["k1", home()]]);
    const nodes = { k1: { type: "problem", createdAt: 1 } };

    const result = await createMissingDocumentMetadata(firestore, kSpace, index,
      { rtdbRoot: kRoot, readNode: nodeReaderFor(nodes) }, { dryRun: false, log: silent });

    expect(store.k1).toEqual({ key: "k1", type: "problem", context_id: "old" });
    expect(result.counts.alreadyPresent).toBe(1);
  });

  it("skips a key that cannot be addressed in the realtime database", async () => {
    // A curriculum-authored support's key is its caption, which contains dots; any lookup on it throws.
    const { firestore, store } = fakeFirestore();
    const index = new Map([["2.2 Initial Challenge Support 1", home()]]);

    const result = await createMissingDocumentMetadata(firestore, kSpace, index,
      { rtdbRoot: kRoot, readNode: nodeReaderFor({}) }, { dryRun: false, log: silent });

    expect(Object.keys(store)).toEqual([]);
    expect(result.counts.skippedUnaddressable).toBe(1);
  });

  it("reports a node that cannot be read rather than inventing a row", async () => {
    const { firestore, store } = fakeFirestore();
    const index = new Map([["k1", home()]]);

    const result = await createMissingDocumentMetadata(firestore, kSpace, index,
      { rtdbRoot: kRoot, readNode: async () => null }, { dryRun: false, log: silent });

    expect(Object.keys(store)).toEqual([]);
    expect(result.counts.nodeUnreadable).toBe(1);
  });

  it("omits title entirely when the node has none, rather than writing undefined", async () => {
    const { firestore, store } = fakeFirestore();
    const index = new Map([["k1", home()]]);
    const nodes = { k1: { type: "personal", createdAt: 1 } };

    await createMissingDocumentMetadata(firestore, kSpace, index,
      { rtdbRoot: kRoot, readNode: nodeReaderFor(nodes) }, { dryRun: false, log: silent });

    expect("title" in store.k1).toBe(false);
  });

  it("writes nothing on a dry run but counts what it would create", async () => {
    const { firestore, store } = fakeFirestore();
    const index = new Map([["k1", home()]]);
    const nodes = { k1: { type: "learningLog", createdAt: 1, title: "t" } };

    const result = await createMissingDocumentMetadata(firestore, kSpace, index,
      { rtdbRoot: kRoot, readNode: nodeReaderFor(nodes) }, { dryRun: true, log: silent });

    expect(Object.keys(store)).toEqual([]);
    expect(result.counts.created).toBe(1);
    expect(result.counts.written).toBe(0);
  });

  it("credits a write only once its commit resolves, across batch boundaries", async () => {
    const { firestore, store, commitCount } = fakeFirestore();
    const nodes: Record<string, any> = {};
    const index = new Map<string, IDocumentHome>();
    for (let i = 0; i < 5; i++) {
      index.set(`k${i}`, home());
      nodes[`k${i}`] = { type: "learningLog", createdAt: 1, title: `t${i}` };
    }

    const result = await createMissingDocumentMetadata(firestore, kSpace, index,
      { rtdbRoot: kRoot, readNode: nodeReaderFor(nodes) },
      { dryRun: false, log: silent, batchSize: 2 });

    expect(result.counts.written).toBe(5);
    expect(commitCount()).toBe(3);
    expect(Object.keys(store).sort()).toEqual(["k0", "k1", "k2", "k3", "k4"]);
  });
});

describe("createMissingDocumentMetadata curriculum fields", () => {
  it("copies offeringId from the node and takes curriculum from a sibling in the same offering", async () => {
    // An offering with one document usually has many, so a sibling almost always exists and costs
    // nothing beyond the scan the pass already performs.
    const { firestore, store } = fakeFirestore({
      sibling: { key: "sibling", offeringId: "173197", unit: "sas", investigation: "1", problem: "3" }
    });
    const index = new Map([["k1", home()]]);
    const nodes = { k1: { type: "problem", createdAt: 1, offeringId: "173197" } };

    const result = await createMissingDocumentMetadata(firestore, kSpace, index,
      { rtdbRoot: kRoot, readNode: nodeReaderFor(nodes) }, { dryRun: false, log: silent });

    expect(store.k1).toMatchObject({
      type: "problem", offeringId: "173197", unit: "sas", investigation: "1", problem: "3"
    });
    expect(result.counts.created).toBe(1);
  });

  it("falls back to the portal when no sibling shares the offering", async () => {
    const { firestore, store } = fakeFirestore();
    const index = new Map([["k1", home()]]);
    const nodes = { k1: { type: "planning", createdAt: 1, offeringId: "999" } };

    await createMissingDocumentMetadata(firestore, kSpace, index,
      {
        rtdbRoot: kRoot, readNode: nodeReaderFor(nodes),
        resolveCurriculum: async () => ({ unit: "m2s", investigation: "6", problem: "6" })
      },
      { dryRun: false, log: silent });

    expect(store.k1).toMatchObject({ unit: "m2s", investigation: "6", problem: "6" });
  });

  it("asks the portal once per offering, however many documents share it", async () => {
    const { firestore } = fakeFirestore();
    const index = new Map([["k1", home()], ["k2", home()]]);
    const nodes = {
      k1: { type: "problem", createdAt: 1, offeringId: "999" },
      k2: { type: "problem", createdAt: 2, offeringId: "999" }
    };
    let calls = 0;

    await createMissingDocumentMetadata(firestore, kSpace, index,
      {
        rtdbRoot: kRoot, readNode: nodeReaderFor(nodes),
        resolveCurriculum: async () => { calls++; return { unit: "sas", investigation: "1", problem: "1" }; }
      },
      { dryRun: false, log: silent });

    expect(calls).toBe(1);
  });

  it("skips an offering-contained document whose curriculum cannot be resolved", async () => {
    // Writing the row without these fields would hand it straight to the offeringId backfill as new
    // work, and leave a document that reads as belonging to the wrong container in the meantime.
    const { firestore, store } = fakeFirestore();
    const index = new Map([["k1", home()]]);
    const nodes = { k1: { type: "problem", createdAt: 1, offeringId: "999" } };

    const result = await createMissingDocumentMetadata(firestore, kSpace, index,
      { rtdbRoot: kRoot, readNode: nodeReaderFor(nodes), resolveCurriculum: async () => undefined },
      { dryRun: false, log: silent });

    expect(Object.keys(store)).toEqual([]);
    expect(result.counts.unresolvedCurriculum).toBe(1);
    expect(result.counts.created).toBe(0);
  });

  it("skips an offering-contained document whose node carries no offeringId", async () => {
    const { firestore, store } = fakeFirestore();
    const index = new Map([["k1", home()]]);
    const nodes = { k1: { type: "problem", createdAt: 1 } };

    const result = await createMissingDocumentMetadata(firestore, kSpace, index,
      { rtdbRoot: kRoot, readNode: nodeReaderFor(nodes) }, { dryRun: false, log: silent });

    expect(Object.keys(store)).toEqual([]);
    expect(result.counts.unresolvedCurriculum).toBe(1);
  });

  it("gives a class-contained document no curriculum fields and no offeringId", async () => {
    // personal and learningLog documents are kept in the class, not an offering. Stamping a unit on
    // them would misplace them on the container axis.
    const { firestore, store } = fakeFirestore();
    const index = new Map([["k1", home()]]);
    const nodes = { k1: { type: "learningLog", createdAt: 1, title: "Log" } };

    await createMissingDocumentMetadata(firestore, kSpace, index,
      { rtdbRoot: kRoot, readNode: nodeReaderFor(nodes) }, { dryRun: false, log: silent });

    for (const field of ["offeringId", "unit", "investigation", "problem"]) {
      expect(field in store.k1).toBe(false);
    }
  });
});
