import { defaultXYplotContent, XYplotContentModel } from "./xyplot-content";

describe("XYplotContent", () => {
  it("has default content of 'XYplot Content Placeholder'", () => {
    const content = defaultXYplotContent();
    expect(content.text).toBe("XYplot Content Placeholder");
  });

  it("is always user resizable", () => {
    const content = XYplotContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });
});
