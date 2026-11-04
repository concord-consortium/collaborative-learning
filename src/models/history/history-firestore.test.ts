import { getHistoryEntriesAfter, getHistoryEntryIndex } from "./history-firestore";

describe("history range reads", () => {
  it("reads the entries after an index in index order", async () => {
    const get = jest.fn().mockResolvedValue({
      docs: [{
        id: "e6",
        data: () => ({ index: 6, previousEntryId: "e5", entry: JSON.stringify({ id: "e6" }) })
      }]
    });
    const orderBy = jest.fn(() => ({ get }));
    const where = jest.fn(() => ({ orderBy }));
    const collection = jest.fn(() => ({ where }));
    const result = await getHistoryEntriesAfter({ collection } as any, "documents/d1", 5);
    expect(collection).toHaveBeenCalledWith("documents/d1/history");
    expect(where).toHaveBeenCalledWith("index", ">", 5);
    expect(orderBy).toHaveBeenCalledWith("index");
    expect(result).toEqual([{ id: "e6", index: 6, previousEntryId: "e5", entry: { id: "e6" } }]);
  });

  describe("getHistoryEntryIndex", () => {
    const firestoreWithDoc = (snapshot: any) => {
      const docGet = jest.fn().mockResolvedValue(snapshot);
      const doc = jest.fn(() => ({ get: docGet }));
      return { firestore: { doc } as any, doc };
    };

    it("returns the index of an existing entry", async () => {
      const { firestore, doc } = firestoreWithDoc({ exists: true, get: () => 7 });
      expect(await getHistoryEntryIndex(firestore, "documents/d1", "e7")).toBe(7);
      expect(doc).toHaveBeenCalledWith("documents/d1/history/e7");
    });
    it("returns undefined for a missing entry", async () => {
      const { firestore } = firestoreWithDoc({ exists: false, get: () => undefined });
      expect(await getHistoryEntryIndex(firestore, "documents/d1", "e7")).toBeUndefined();
    });
    it("returns undefined when the index is not a number", async () => {
      const { firestore } = firestoreWithDoc({ exists: true, get: () => "x" });
      expect(await getHistoryEntryIndex(firestore, "documents/d1", "e7")).toBeUndefined();
    });
  });
});
