import { getSnapshot } from "mobx-state-tree";
import { addAttributeToDataSet, addCasesToDataSet, DataSet } from "../../models/data/data-set";
import { ICaseCreation } from "../../models/data/data-set-types";
import { SharedDataSet, SharedDataSetType } from "../../models/shared/shared-data-set";
import { defaultBarGraphContent, BarGraphContentModel } from "./bar-graph-content";

const mockCases: ICaseCreation[] = [
  { species: "cat", location: "yard" },
  { species: "cat", location: "yard" },
  { species: "owl", location: "yard" },
  { species: "owl", location: "forest" }
];

const emptyDataSet = DataSet.create();
addAttributeToDataSet(emptyDataSet, { id: "att-s", name: "species" });
addAttributeToDataSet(emptyDataSet, { id: "att-l", name: "location" });
const sharedEmptyDataSet = SharedDataSet.create({ dataSet: emptyDataSet });

const sampleDataSet = DataSet.create();
addAttributeToDataSet(sampleDataSet, { id: "att-s", name: "species" });
addAttributeToDataSet(sampleDataSet, { id: "att-l", name: "location" });
addCasesToDataSet(sampleDataSet, mockCases);
const sharedSampleDataSet = SharedDataSet.create({ dataSet: sampleDataSet });

const TestableBarGraphContentModel = BarGraphContentModel
  .actions(self => ({
    setDataSet(ds: SharedDataSetType) {
      self.dataSet = ds;
    }
  }));

describe("Bar Graph Content", () => {
  it("is a Bar Graph model", () => {
    const content = BarGraphContentModel.create();
    expect(content.type).toBe("BarGraph");
  });

  it("yAxisLabel has expected default content", () => {
    const content = defaultBarGraphContent();
    expect(content.yAxisLabel).toBe("Counts");
    expect(getSnapshot(content)).toMatchInlineSnapshot(`
Object {
  "primaryAttribute": undefined,
  "secondaryAttribute": undefined,
  "type": "BarGraph",
  "yAxisLabel": "Counts",
}
`);
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

  it("returns empty data array when there are no cases", () => {
    const content = TestableBarGraphContentModel.create({ });
    content.setDataSet(sharedEmptyDataSet);
    expect(content.dataArray).toEqual([]);
  });

  it("returns empty data array when there is no primary attribute", () => {
    const content = TestableBarGraphContentModel.create({ });
    content.setDataSet(sharedSampleDataSet);
    expect(content.dataArray).toEqual([]);
  });

  it("returns expected data array with primary attribute", () => {
    const content = TestableBarGraphContentModel.create({ });
    content.setDataSet(sharedSampleDataSet);
    content.setPrimaryAttribute("att-s");
    expect(content.dataArray).toEqual([
      { "att-s": "cat", "value": 2 },
      { "att-s": "owl","value": 2}
    ]);

    content.setPrimaryAttribute("att-l");
    expect(content.dataArray).toEqual([
      { "att-l": "yard", "value": 3 },
      { "att-l": "forest", "value": 1 }
    ]);
  });

  it("returns expected data array with primary and secondary attributes", () => {
    const content = TestableBarGraphContentModel.create({ });
    content.setDataSet(sharedSampleDataSet);
    content.setPrimaryAttribute("att-s");
    content.setSecondaryAttribute("att-l");
    expect(content.dataArray).toEqual([
        { "att-s": "cat", "yard": 2 },
        { "att-s": "owl", "yard": 1, "forest": 1 }
      ]);
  });

  it("extracts primary keys", () => {
    const content = TestableBarGraphContentModel.create({ });
    content.setDataSet(sharedSampleDataSet);
    content.setPrimaryAttribute("att-s");
    expect(content.primaryKeys).toEqual(["cat", "owl"]);
  });

  it("extracts secondary keys", () => {
    const content = TestableBarGraphContentModel.create({ });
    content.setDataSet(sharedSampleDataSet);
    content.setPrimaryAttribute("att-s");
    content.setSecondaryAttribute("att-l");
    expect(content.secondaryKeys).toEqual(["yard", "forest"]);
  });

  it("calculates the maximum data value", () => {
    const content = TestableBarGraphContentModel.create({ });
    content.setDataSet(sharedSampleDataSet);
    content.setPrimaryAttribute("att-s");
    expect(content.maxDataValue).toBe(2);

    content.setPrimaryAttribute("att-l");
    expect(content.maxDataValue).toBe(3);

    content.setSecondaryAttribute("att-s");
    expect(content.maxDataValue).toBe(2);
  });

});
