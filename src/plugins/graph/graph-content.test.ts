import { defaultGraphContent, GraphContentModel } from "./graph-content";

describe("GraphContent", () => {
  it("has default content of 'Graph Content Placeholder'", () => {
    const content = defaultGraphContent();
    expect(content.text).toBe("Graph Content Placeholder");
  });

  it("is always user resizable", () => {
    const content = GraphContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });
});
