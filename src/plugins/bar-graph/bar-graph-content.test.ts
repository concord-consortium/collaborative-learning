import { defaultBarGraphContent, BarGraphContentModel } from "./bar-graph-content";

describe("Bar Graph Content", () => {
  it("has default content of 'hello world'", () => {
    const content = defaultBarGraphContent();
    expect(content.text).toBe("Hello World");
  });

  it("supports changing the text", () => {
    const content = BarGraphContentModel.create();
    content.setText("New Text");
    expect(content.text).toBe("New Text");
  });

  it("is always user resizable", () => {
    const content = BarGraphContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });
});
