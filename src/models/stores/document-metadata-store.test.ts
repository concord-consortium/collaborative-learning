import { DocumentMetadataStore, IDocumentMetadataStoreStores } from "./document-metadata-store";

// A minimal fake Firestore get-by-id chain: firestore.doc(path).withConverter().get(), where path
// is getSimpleDocumentPath(key), i.e. documents/{escapeKey(key)}. docsByKey is keyed by that id.
// A get-by-id returns the doc regardless of context_id — the store applies the class-scoping
// check itself. The fake prepends a space to the path the way the Firestore wrapper's doc() does.
function makeFakeDb(docsByKey: Record<string, any>) {
  let requestedPath = "";
  const getSpy = jest.fn(() => {
    const value = docsByKey[requestedPath.split("/").pop()!];
    return Promise.resolve(
      value ? { exists: true, data: () => value } : { exists: false, data: () => undefined }
    );
  });
  const docRef = {
    // The store reads docRef.path to describe where it looked in its error messages.
    get path() { return `test-space/${requestedPath}`; },
    withConverter: () => docRef,
    get: () => getSpy(),
  };
  return {
    getSpy,
    getRequestedId: () => requestedPath.split("/").pop(),
    db: { firestore: { doc: (path: string) => { requestedPath = path; return docRef; } } } as any,
  };
}

function makeStore(docsByKey: Record<string, any> = {}, exemplarDocuments: any[] = []) {
  const { db, getSpy, getRequestedId } = makeFakeDb(docsByKey);
  const stores = {
    db,
    user: { classHash: "class-1" },
    documents: { exemplarDocuments },
  } as unknown as IDocumentMetadataStoreStores;
  return { store: new DocumentMetadataStore(stores), getSpy, getRequestedId };
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
    it("reads by the escaped document id (documents/{escapeKey(key)}), not the raw key", async () => {
      // Use a key containing characters escapeKey rewrites (. and / -> _) so this fails if the
      // code ever reads by the raw key instead of escapeKey(key). The stored `key` field keeps the
      // raw key, matching real metadata docs (id is escaped, the field is not).
      const rawKey = "sec.1/foo";
      const escapedId = "sec_1_foo";
      const { store, getSpy, getRequestedId } = makeStore({
        [escapedId]: { uid: "u1", type: "problem", key: rawKey, context_id: "class-1" }
      });
      const result = await store.fetchMetadata(rawKey);
      expect(result?.key).toBe(rawKey);
      expect(getSpy).toHaveBeenCalledTimes(1);
      // Read by document id (escapeKey(key)), not a query and not the raw key.
      expect(getRequestedId()).toBe(escapedId);
    });

    it("throws describing the doc path when the doc does not exist", async () => {
      const { store } = makeStore({});
      // The error names the doc path (which carries the space and id) it read.
      await expect(store.fetchMetadata("nope"))
        .rejects.toThrow(/No Firestore metadata document found.*test-space\/documents\/nope/);
    });

    it("throws for a doc in another class (context_id mismatch)", async () => {
      const { store, getSpy } = makeStore({
        "doc-x": { uid: "u1", type: "problem", key: "doc-x", context_id: "other-class" }
      });
      await expect(store.fetchMetadata("doc-x"))
        .rejects.toThrow(/context_id 'other-class' does not match class 'class-1'/);
      // The doc was read; the store rejected it on the class check.
      expect(getSpy).toHaveBeenCalledTimes(1);
    });

    it("throws when the doc fails typecheck (fail-fast)", async () => {
      // Missing the required `uid` field -> DocumentMetadataModel typecheck fails.
      const { store, getSpy } = makeStore({
        "bad-1": { type: "problem", key: "bad-1", context_id: "class-1" }
      });
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
      await expect(store.fetchMetadata("bad-1")).rejects.toThrow(/failed validation/);
      // The read still ran; validation (not absence) is what rejected the doc.
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("coalesces concurrent reads for the same key into a single get", async () => {
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
