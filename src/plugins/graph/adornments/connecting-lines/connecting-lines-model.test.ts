import { ConnectingLinesModel } from "./connecting-lines-model";

describe("ConnectingLineModel", () => {
  it("is created with its type property set to 'Connecting Line'", () => {
    const cLine = ConnectingLinesModel.create();
    expect(cLine.type).toEqual("Connecting Line");
  });
});
