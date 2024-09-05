import { defaultBarGraphContent, BarGraphContentModel } from "./bar-graph-content";

describe("Bar Graph Content", () => {
  it("is a Bar Graph model", () => {
    const content = BarGraphContentModel.create();
    expect(content.type).toBe("BarGraph");
  });

  it("yAxisLabel has default content of 'Counts'", () => {
    const content = defaultBarGraphContent();
    expect(content.yAxisLabel).toBe("Counts");
  });

  it("is always user resizable", () => {
    const content = BarGraphContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });

  it("supports changing the y axis label", () => {
    const content = BarGraphContentModel.create();
    content.setYAxisLabel("New Text");
    expect(content.yAxisLabel).toBe("New Text");
  });

  it("supports setting the primary attribute", () => {
    const content = BarGraphContentModel.create();
    expect(content.primaryAttribute).toBeUndefined();
    content.setPrimaryAttribute("attrId");
    expect(content.primaryAttribute).toBe("attrId");
  });

  it("supports setting the secondary attribute", () => {
    const content = BarGraphContentModel.create();
    expect(content.secondaryAttribute).toBeUndefined();
    content.setSecondaryAttribute("attrId");
    expect(content.secondaryAttribute).toBe("attrId");
  });

});
