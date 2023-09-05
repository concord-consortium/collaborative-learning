import { ConnectingLinesModel } from "./connecting-lines-model";
import { kConnectingLinesType } from "./connecting-lines-types";

describe("ConnectingLinesModel", () => {
  it("is created with its type property set appropriately", () => {
    const cLine = ConnectingLinesModel.create();
    expect(cLine.type).toEqual(kConnectingLinesType);
  });
});
