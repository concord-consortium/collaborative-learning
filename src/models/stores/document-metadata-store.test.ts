import { MetadataDocMapModel } from "./sorted-documents";
import { DocumentMetadataStore, IDocumentMetadataStoreStores } from "./document-metadata-store";

// A minimal fake Firestore query chain: collection().withConverter().where().where().get()
function makeFakeDb(docsByKey: Record<string, any>) {
  const getSpy = jest.fn((key: string) => {
    const data = docsByKey[key];
    return Promise.resolve(
      data
        ? { empty: false, docs: [{ data: () => data }] }
        : { empty: true, docs: [] }
    );
  });
  let requestedKey = "";
  const query = {
    withConverter: () => query,
    where: (field: string, _op: string, value: any) => {
      if (field === "key") requestedKey = value;
      return query;
    },
    get: () => getSpy(requestedKey),
  };
  return {
    getSpy,
    db: { firestore: { collection: () => query } } as any,
  };
}

function makeStore(docsByKey: Record<string, any> = {}) {
  const { db, getSpy } = makeFakeDb(docsByKey);
  const stores = { db, user: { classHash: "class-1" } } as unknown as IDocumentMetadataStoreStores;
  return { store: new DocumentMetadataStore(stores), getSpy };
}

describe("DocumentMetadataStore", () => {
  it("getMetadata returns a doc already in the filtered cache without a fetch", () => {
    const { store, getSpy } = makeStore();
    store.metadataDocsFiltered = MetadataDocMapModel.create({
      "doc-1": { uid: "u1", type: "problem", key: "doc-1", tools: [] }
    });
    const result = store.getMetadata("doc-1");
    expect(result?.key).toBe("doc-1");
    expect(getSpy).not.toHaveBeenCalled();
  });

  it("getMetadata returns undefined for an uncached key", () => {
    const { store } = makeStore();
    expect(store.getMetadata("missing")).toBeUndefined();
  });

  it("fetchMetadata point-reads Firestore on a cache miss", async () => {
    const { store, getSpy } = makeStore({
      "doc-2": { uid: "u1", type: "problem", key: "doc-2", context_id: "class-1" }
    });
    const result = await store.fetchMetadata("doc-2");
    expect(result?.key).toBe("doc-2");
    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  it("fetchMetadata resolves undefined when Firestore has no matching doc", async () => {
    const { store } = makeStore({});
    expect(await store.fetchMetadata("nope")).toBeUndefined();
  });

  it("fetchMetadata coalesces concurrent reads for the same key", async () => {
    const { store, getSpy } = makeStore({
      "doc-3": { uid: "u1", type: "problem", key: "doc-3", context_id: "class-1" }
    });
    const [a, b] = await Promise.all([store.fetchMetadata("doc-3"), store.fetchMetadata("doc-3")]);
    expect(a?.key).toBe("doc-3");
    expect(b?.key).toBe("doc-3");
    expect(getSpy).toHaveBeenCalledTimes(1);
  });
});
