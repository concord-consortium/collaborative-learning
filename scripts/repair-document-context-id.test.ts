import { repairDocumentContextId } from "./repair-document-context-id";
import type { IDocumentHome } from "./lib/rtdb-document-index";

/** A Firestore stand-in exposing only what the repair uses: paged reads and batched writes. */
function fakeFirestore(docs: Record<string, any>) {
  const committed: Array<Record<string, any>> = [];
  let pendingWrites: Array<{ id: string; data: any }> = [];
  const store = { ...docs };

  const firestore: any = {
    collection: (path: string) => ({
      select: () => ({
        limit: () => {
          const query: any = {
            startAfter: () => query,
            get: async () => ({
              empty: Object.keys(store).length === 0,
              size: Object.keys(store).length,
              docs: Object.entries(store).map(([id, data]) => ({
                id, data: () => data, ref: { path: `${path}/${id}` }
              }))
            })
          };
          return query;
        }
      })
    }),
    doc: (path: string) => ({ path, id: path.split("/").pop() }),
    batch: () => ({
      update: (ref: any, data: any) => { pendingWrites.push({ id: ref.id, data }); },
      commit: async () => {
        committed.push(...pendingWrites.map(w => ({ [w.id]: w.data })));
        for (const w of pendingWrites) Object.assign(store[w.id], w.data);
        pendingWrites = [];
      }
    })
  };
  return { firestore, committed, store };
}

const home = (classHash: string, uid: string): IDocumentHome =>
  ({ classHash, uid, hasContent: true, hasMetadata: true });

const silent = () => undefined;

describe("repairDocumentContextId", () => {
  it("rewrites a context_id that disagrees with the class the document lives in", async () => {
    const { firestore, store } = fakeFirestore({
      doc1: { key: "doc1", context_id: "wrongClass", uid: "u1", type: "problem" }
    });
    const index = new Map([["doc1", home("trueClass", "u1")]]);

    const result = await repairDocumentContextId(firestore, "demo/S/documents", index,
      { dryRun: false, log: silent });

    expect(store.doc1.context_id).toBe("trueClass");
    expect(result.counts.needsRepair).toBe(1);
  });

  it("drives the repair from the index, not from the legacy contextId field", async () => {
    // 10 of the 35 production mismatches carry contextId: "ignored". Copying the legacy field would
    // fix the other 25 and leave these looking correct, which is worse than leaving them alone.
    const { firestore, store } = fakeFirestore({
      doc1: { key: "doc1", context_id: "wrongClass", contextId: "ignored", uid: "u1", type: "problem" }
    });
    const index = new Map([["doc1", home("trueClass", "u1")]]);

    await repairDocumentContextId(firestore, "demo/S/documents", index, { dryRun: false, log: silent });

    expect(store.doc1.context_id).toBe("trueClass");
  });

  it("leaves a document alone when its context_id already agrees", async () => {
    const { firestore, committed } = fakeFirestore({
      doc1: { key: "doc1", context_id: "trueClass", uid: "u1", type: "problem" }
    });
    const index = new Map([["doc1", home("trueClass", "u1")]]);

    const result = await repairDocumentContextId(firestore, "demo/S/documents", index,
      { dryRun: false, log: silent });

    expect(committed).toEqual([]);
    expect(result.counts.alreadyCorrect).toBe(1);
  });

  it("never touches a document whose key is absent from the index", async () => {
    // mcsupports-style rows are Firestore-native and never existed in the realtime database, so
    // there is no "true" class to compare against. 7 in production, 1,082 elsewhere.
    const { firestore, committed } = fakeFirestore({
      native: { key: "native", context_id: "someClass", uid: "u1", type: "supportPublication" }
    });

    const result = await repairDocumentContextId(firestore, "demo/S/documents", new Map(),
      { dryRun: false, log: silent });

    expect(committed).toEqual([]);
    expect(result.counts.notInIndex).toBe(1);
  });

  it("reports a uid disagreement without repairing it", async () => {
    // The uid axis was never analysed. A wrong uid is a different bug with different consequences,
    // so surface it and leave it; guessing could do harm.
    const { firestore, store } = fakeFirestore({
      doc1: { key: "doc1", context_id: "trueClass", uid: "wrongUid", type: "problem" }
    });
    const index = new Map([["doc1", home("trueClass", "trueUid")]]);

    const result = await repairDocumentContextId(firestore, "demo/S/documents", index,
      { dryRun: false, log: silent });

    expect(store.doc1.uid).toBe("wrongUid");
    expect(result.counts.uidMismatch).toBe(1);
    expect(result.uidMismatches).toEqual([{ key: "doc1", stored: "wrongUid", indexed: "trueUid" }]);
  });

  it("writes nothing on a dry run but counts what it would have repaired", async () => {
    const { firestore, store, committed } = fakeFirestore({
      doc1: { key: "doc1", context_id: "wrongClass", uid: "u1", type: "problem" }
    });
    const index = new Map([["doc1", home("trueClass", "u1")]]);

    const result = await repairDocumentContextId(firestore, "demo/S/documents", index,
      { dryRun: true, log: silent });

    expect(store.doc1.context_id).toBe("wrongClass");
    expect(committed).toEqual([]);
    expect(result.counts.needsRepair).toBe(1);
  });

  it("records every before and after pair so a small repair can be read in full", async () => {
    const { firestore } = fakeFirestore({
      doc1: { key: "doc1", context_id: "wrongClass", uid: "u1", type: "problem" }
    });
    const index = new Map([["doc1", home("trueClass", "u1")]]);

    const result = await repairDocumentContextId(firestore, "demo/S/documents", index,
      { dryRun: true, log: silent });

    expect(result.repairs).toEqual([
      { key: "doc1", type: "problem", from: "wrongClass", to: "trueClass" }
    ]);
  });

  it("counts a document with no context_id as repairable rather than already correct", async () => {
    const { firestore, store } = fakeFirestore({
      doc1: { key: "doc1", uid: "u1", type: "problem" }
    });
    const index = new Map([["doc1", home("trueClass", "u1")]]);

    const result = await repairDocumentContextId(firestore, "demo/S/documents", index,
      { dryRun: false, log: silent });

    expect(result.counts.needsRepair).toBe(1);
    expect(store.doc1.context_id).toBe("trueClass");
  });
});

/** As above, but each commit can be made to reject, to prove the count follows what actually landed. */
function flakyFirestore(docs: Record<string, any>, failOnCommit: number) {
  const base = fakeFirestore(docs);
  let commits = 0;
  const realBatch = base.firestore.batch;
  base.firestore.batch = () => {
    const b = realBatch();
    const realCommit = b.commit;
    b.commit = async () => {
      if (++commits === failOnCommit) throw new Error("commit failed");
      return realCommit();
    };
    return b;
  };
  return base;
}

describe("repairDocumentContextId write accounting", () => {
  it("counts a write only once its commit has resolved", async () => {
    const { firestore } = fakeFirestore({
      doc1: { key: "doc1", context_id: "wrong", uid: "u1", type: "problem" }
    });
    const index = new Map([["doc1", home("trueClass", "u1")]]);

    const result = await repairDocumentContextId(firestore, "demo/S/documents", index,
      { dryRun: false, log: silent });

    expect(result.counts.needsRepair).toBe(1);
    expect(result.counts.written).toBe(1);
  });

  it("reports nothing written on a dry run, however much needs repair", async () => {
    const { firestore } = fakeFirestore({
      doc1: { key: "doc1", context_id: "wrong", uid: "u1", type: "problem" }
    });
    const index = new Map([["doc1", home("trueClass", "u1")]]);

    const result = await repairDocumentContextId(firestore, "demo/S/documents", index,
      { dryRun: true, log: silent });

    expect(result.counts.needsRepair).toBe(1);
    expect(result.counts.written).toBe(0);
  });

  it("does not credit writes from a commit that threw", async () => {
    // A crash mid-sweep must leave a report that understates rather than overstates what landed;
    // the alternative is an operator believing a repair happened when it did not.
    const docs: Record<string, any> = {};
    for (let i = 0; i < 3; i++) docs[`d${i}`] = { key: `d${i}`, context_id: "wrong", uid: "u1", type: "problem" };
    const index = new Map(Object.keys(docs).map(k => [k, home("trueClass", "u1")]));
    const { firestore } = flakyFirestore(docs, 1);

    await expect(
      repairDocumentContextId(firestore, "demo/S/documents", index,
        { dryRun: false, log: silent, batchSize: 2 })
    ).rejects.toThrow("commit failed");
  });

  it("commits in batches, writing every document across batch boundaries", async () => {
    const docs: Record<string, any> = {};
    for (let i = 0; i < 5; i++) docs[`d${i}`] = { key: `d${i}`, context_id: "wrong", uid: "u1", type: "problem" };
    const index = new Map(Object.keys(docs).map(k => [k, home("trueClass", "u1")]));
    const { firestore, store } = fakeFirestore(docs);

    const result = await repairDocumentContextId(firestore, "demo/S/documents", index,
      { dryRun: false, log: silent, batchSize: 2 });

    expect(result.counts.written).toBe(5);
    for (let i = 0; i < 5; i++) expect(store[`d${i}`].context_id).toBe("trueClass");
  });
});
