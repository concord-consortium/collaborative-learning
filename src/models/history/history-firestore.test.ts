import { getHistoryEntriesAfter } from "./history-firestore";

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

});
