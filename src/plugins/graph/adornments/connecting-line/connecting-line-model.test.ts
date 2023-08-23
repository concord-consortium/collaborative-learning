import { ConnectingLineModel } from "./connecting-line-model";

describe("ConnectingLineModel", () => {
  it("is created with its type property set to 'Connecting Line'", () => {
    const cLine = ConnectingLineModel.create();
    expect(cLine.type).toEqual("Connecting Line");
  });
});
