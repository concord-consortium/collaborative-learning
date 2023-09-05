import { NumberlineContentModel } from "./numberline-content";

describe("NumberlineContent", () => {
  it("is always user resizable", () => {
    const content = NumberlineContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });
});
