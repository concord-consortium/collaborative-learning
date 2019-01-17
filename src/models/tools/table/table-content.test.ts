import { kTableToolID, TableContentModel } from "./table-content";

describe("TableContent", () => {

  it("can create default TableContentModel", () => {
    const tableContent = TableContentModel.create();
    expect(tableContent.type).toBe(kTableToolID);
  });
});
