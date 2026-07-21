import { DocumentMetadataStore, IDocumentMetadataStoreStores } from "./document-metadata-store";

// A minimal fake Firestore query chain: collection().withConverter().where().where().get().
// It honors both the `context_id` and `key` filters so class-scoping is actually exercised:
// a doc is only returned when the requested context_id matches the doc's context_id.
function makeFakeDb(docsByKey: Record<string, any>) {
  let requestedKey = "";
  let requestedContextId = "";
  const getSpy = jest.fn(() => {
    const data = docsByKey[requestedKey];
    const matches = data && data.context_id === requestedContextId;
    return Promise.resolve(
      matches
        ? { empty: false, docs: [{ data: () => data }] }
        : { empty: true, docs: [] }
    );
  });
  const query = {
    // The store reads collection().path to describe where it looked in its not-found error.
    path: "test-space/documents",
    withConverter: () => query,
    where: (field: string, _op: string, value: any) => {
      if (field === "key") requestedKey = value;
      if (field === "context_id") requestedContextId = value;
      return query;
    },
    get: () => getSpy(),
  };
  return {
    getSpy,
    getRequestedContextId: () => requestedContextId,
    db: { firestore: { collection: () => query } } as any,
  };
}

function makeStore(docsByKey: Record<string, any> = {}, exemplarDocuments: any[] = []) {
  const { db, getSpy, getRequestedContextId } = makeFakeDb(docsByKey);
  const stores = {
    db,
    user: { classHash: "class-1" },
    documents: { exemplarDocuments },
  } as unknown as IDocumentMetadataStoreStores;
  return { store: new DocumentMetadataStore(stores), getSpy, getRequestedContextId };
}

// A minimal fake exemplar document (shape read by the exemplarMetadataDocs getter).
function makeExemplarDoc(key: string, authoredCommentTag: string, tileTypes: string[]) {
  return {
    uid: "author",
    type: "problem",
    key,
    createdAt: 1,
    title: "Exemplar",
    visibility: "public",
    investigation: null,
    problem: null,
    unit: null,
    properties: new Map<string, string>([["authoredCommentTag", authoredCommentTag]]),
    content: { tileTypes, annotations: new Map() },
  };
}

describe("DocumentMetadataStore", () => {
  describe("fetchMetadata", () => {
    it("returns validated data on a valid point read (scoped by context_id)", async () => {
      const { store, getSpy, getRequestedContextId } = makeStore({
        "doc-2": { uid: "u1", type: "problem", key: "doc-2", context_id: "class-1" }
      });
      const result = await store.fetchMetadata("doc-2");
      expect(result?.key).toBe("doc-2");
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getRequestedContextId()).toBe("class-1");
    });

    it("throws describing the query when the result is empty", async () => {
      const { store } = makeStore({});
      // The error names the collection path (which carries the space) and the key it looked for.
      await expect(store.fetchMetadata("nope"))
        .rejects.toThrow(/No Firestore metadata document found.*test-space\/documents.*key == 'nope'/);
    });

    it("throws for a doc in another class (context_id mismatch)", async () => {
      const { store } = makeStore({
        "doc-x": { uid: "u1", type: "problem", key: "doc-x", context_id: "other-class" }
      });
      await expect(store.fetchMetadata("doc-x")).rejects.toThrow(/No Firestore metadata document found/);
    });

    it("throws when the point-read doc fails typecheck (fail-fast)", async () => {
      // Missing the required `uid` field -> DocumentMetadataModel typecheck fails.
      const { store, getSpy } = makeStore({
        "bad-1": { type: "problem", key: "bad-1", context_id: "class-1" }
      });
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
      await expect(store.fetchMetadata("bad-1")).rejects.toThrow(/failed validation/);
      // The query still ran; validation (not absence) is what rejected the doc.
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("coalesces concurrent reads for the same key into a single query", async () => {
      const { store, getSpy } = makeStore({
        "doc-3": { uid: "u1", type: "problem", key: "doc-3", context_id: "class-1" }
      });
      const [a, b] = await Promise.all([store.fetchMetadata("doc-3"), store.fetchMetadata("doc-3")]);
      expect(a?.key).toBe("doc-3");
      expect(b?.key).toBe("doc-3");
      expect(getSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("metadataFromFirestoreData", () => {
    it("returns the validated doc unchanged when no exemplar matches", () => {
      const { store } = makeStore();
      const data = {
        uid: "u1", type: "problem", key: "plain-1", context_id: "class-1",
        strategies: ["userStrat"], tools: ["Text"]
      } as any;
      const result = store.metadataFromFirestoreData(data);
      expect(result?.key).toBe("plain-1");
      expect(result?.strategies).toEqual(["userStrat"]);
      expect(result?.tools).toEqual(["Text"]);
    });

    it("unions authored strategies and replaces tools when the key matches an exemplar", () => {
      const exemplar = makeExemplarDoc("ex-1", "strategyA", ["Text", "Table"]);
      const { store } = makeStore({}, [exemplar]);
      const data = {
        uid: "u1", type: "problem", key: "ex-1", context_id: "class-1",
        strategies: ["userStrat"], tools: ["OldTool"]
      } as any;
      const result = store.metadataFromFirestoreData(data);
      expect(result?.strategies).toEqual(["strategyA", "userStrat"]);
      expect(result?.tools).toEqual(["Text", "Table"]);
    });

    it("returns undefined and logs when the doc fails typecheck", () => {
      const { store } = makeStore();
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
      // Missing the required `uid` field.
      const result = store.metadataFromFirestoreData({ type: "problem", key: "bad-1" } as any);
      expect(result).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("getMSTSnapshotFromFBSnapshot (the shared transform used by watchers)", () => {
    it("drops just the invalid doc while keeping the valid ones", () => {
      const { store } = makeStore();
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
      const snapshot = {
        docs: [
          { data: () => ({ uid: "u1", type: "problem", key: "good-1", context_id: "class-1" }) },
          // Missing `uid` -> invalid.
          { data: () => ({ type: "problem", key: "bad-1", context_id: "class-1" }) },
          { data: () => ({ uid: "u2", type: "problem", key: "good-2", context_id: "class-1" }) },
        ]
      } as any;
      const mstSnapshot = store.getMSTSnapshotFromFBSnapshot(snapshot);
      expect(Object.keys(mstSnapshot).sort()).toEqual(["good-1", "good-2"]);
      expect(mstSnapshot["bad-1"]).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
