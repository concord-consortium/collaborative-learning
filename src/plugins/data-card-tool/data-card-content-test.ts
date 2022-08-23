import { DataCardContentModel } from "./data-card-content";

describe("DataCardContent", () => {
  it("is always user resizable", () => {
    const content = DataCardContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });
});
