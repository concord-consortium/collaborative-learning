import { defaultBarGraphContent, BarGraphContentModel } from "./bar-graph-content";

describe("Bar Graph Content", () => {
  it("yAxisLabel has default content of 'Counts'", () => {
    const content = defaultBarGraphContent();
    expect(content.yAxisLabel).toBe("Counts");
  });

  it("supports changing the text", () => {
    const content = BarGraphContentModel.create();
    content.setYAxisLabel("New Text");
    expect(content.yAxisLabel).toBe("New Text");
  });

  it("is always user resizable", () => {
    const content = BarGraphContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });
});
