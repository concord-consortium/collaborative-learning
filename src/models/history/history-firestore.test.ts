import { getHistoryEntriesAfter } from "./history-firestore";

describe("history range reads", () => {
  it("reads the entries after an index, through the last one, in index order", async () => {
    const get = jest.fn().mockResolvedValue({
      docs: [{
        id: "e6",
        data: () => ({ index: 6, previousEntryId: "e5", entry: JSON.stringify({ id: "e6" }) })
      }]
    });
    const orderBy = jest.fn(() => ({ get }));
    const query: any = { orderBy };
    const where = jest.fn(() => query);
    query.where = where;
    const collection = jest.fn(() => ({ where }));
    const result = await getHistoryEntriesAfter({ collection } as any, "documents/d1", 5, 9);
    expect(collection).toHaveBeenCalledWith("documents/d1/history");
    expect(where).toHaveBeenNthCalledWith(1, "index", ">", 5);
    expect(where).toHaveBeenNthCalledWith(2, "index", "<=", 9);
    expect(orderBy).toHaveBeenCalledWith("index");
    expect(result).toEqual([{ id: "e6", index: 6, previousEntryId: "e5", entry: { id: "e6" } }]);
  });

});
