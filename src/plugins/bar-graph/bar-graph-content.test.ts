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


function sharedEmptyDataSet() {
  const emptyDataSet = DataSet.create();
  addAttributeToDataSet(emptyDataSet, { id: "att-s", name: "species" });
  addAttributeToDataSet(emptyDataSet, { id: "att-l", name: "location" });
  return SharedDataSet.create({ dataSet: emptyDataSet });
}

function sharedSampleDataSet() {
  const sampleDataSet = DataSet.create();
  addAttributeToDataSet(sampleDataSet, { id: "att-s", name: "species" });
  addAttributeToDataSet(sampleDataSet, { id: "att-l", name: "location" });
  addCasesToDataSet(sampleDataSet, mockCases);
  return SharedDataSet.create({ dataSet: sampleDataSet });
}

// This is a testable version of the BarGraphContentModel that doesn't rely on the shared model manager
// It just lets you set a SharedModel and returns that.
const TestingBarGraphContentModel = BarGraphContentModel
  .volatile(() => ({
    storedSharedModel: undefined as SharedDataSetType | undefined
  }))
  .actions(self => ({
    setSharedModel(sharedModel: SharedDataSetType) {
      self.storedSharedModel = sharedModel;
      self.updateAfterSharedModelChanges(sharedModel);
    }
  }))
  .views(self => ({
    get sharedModel() {
      return self.storedSharedModel;
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
{
  "attributeColorMap": {},
  "dataSetId": undefined,
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
    const content = TestingBarGraphContentModel.create({ });
    content.setSharedModel(sharedEmptyDataSet());
    expect(content.dataArray).toEqual([]);
  });

  it("returns empty data array when there is no primary attribute", () => {
    const content = TestingBarGraphContentModel.create({ });
    content.setSharedModel(sharedSampleDataSet());
    content.setPrimaryAttribute(undefined);
    expect(content.dataArray).toEqual([]);
  });

  it("returns expected data array with primary attribute", () => {
    const content = TestingBarGraphContentModel.create({ });
    content.setSharedModel(sharedSampleDataSet());
    content.setPrimaryAttribute("att-s");
    expect(content.dataArray).toEqual([
      { "att-s": "cat", "value": { count: 2, selected: false }},
      { "att-s": "owl","value": { count: 2, selected: false }}
    ]);

    content.setPrimaryAttribute("att-l");
    expect(content.dataArray).toEqual([
      { "att-l": "yard", "value": { count: 3, selected: false }},
      { "att-l": "forest", "value": { count: 1, selected: false }}
    ]);
  });

  it("returns expected array when a case is selected with primary attribute", () => {
    const content = TestingBarGraphContentModel.create({ });
    content.setSharedModel(sharedSampleDataSet());
    content.setPrimaryAttribute("att-s");
    content.sharedModel?.dataSet.setSelectedCases([content.sharedModel?.dataSet.cases[0].__id__]);
    expect(content.dataArray).toEqual([
      { "att-s": "cat", "value": { count: 2, selected: true }},
      { "att-s": "owl", "value": { count: 2, selected: false }}
    ]);
    content.sharedModel?.dataSet.setSelectedCases([content.sharedModel?.dataSet.cases[2].__id__]);
    expect(content.dataArray).toEqual([
      { "att-s": "cat", "value": { count: 2, selected: false }},
      { "att-s": "owl","value": { count: 2, selected: true }}
    ]);
    content.sharedModel?.dataSet.selectAllCases();
    expect(content.dataArray).toEqual([
      { "att-s": "cat", "value": { count: 2, selected: true }},
      { "att-s": "owl","value": { count: 2, selected: true }}
    ]);

  });

  it("sets first dataset attribute as the primary attribute by default", () => {
    const content = TestingBarGraphContentModel.create({ });
    content.setSharedModel(sharedSampleDataSet());
    expect(content.dataArray).toEqual([
      { "att-s": "cat", "value": { count: 2, selected: false }},
      { "att-s": "owl","value": { count: 2, selected: false }}
    ]);
  });

  it("skips attributes that contain images when setting primary attribute", () => {
    const content = TestingBarGraphContentModel.create({ });
    const dataSet = sharedSampleDataSet();
    dataSet.dataSet?.attributes[0].setValue(0, "ccimg://fbrtdb.concord.org/funny-cat-pic.png");
    content.setSharedModel(dataSet);
    expect(content.primaryAttribute).toBe("att-l");
    expect(content.dataArray).toEqual([
      { "att-l": "yard", "value": { count: 3, selected: false }},
      { "att-l": "forest", "value": { count: 1, selected: false }}
    ]);
  });

  it("uses first attribute anyway if all attributes contain images when setting primary attribute", () => {
    const content = TestingBarGraphContentModel.create({ });
    const dataSet = sharedSampleDataSet();
    dataSet.dataSet?.attributes[0].setValue(0, "ccimg://fbrtdb.concord.org/funny-cat-pic.png");
    dataSet.dataSet?.attributes[1].setValue(3, "ccimg://fbrtdb.concord.org/forest.jpg");
    content.setSharedModel(dataSet);
    expect(content.primaryAttribute).toBe("att-s");
    expect(content.dataArray).toEqual([
      { "att-s": "ccimg://fbrtdb.concord.org/funny-cat-pic.png", "value": { count: 1, selected: false }},
      { "att-s": "cat", "value": { count: 1, selected: false }},
      { "att-s": "owl","value": { count: 2, selected: false }}
    ]);
  });

  it("returns expected data array with primary and secondary attributes", () => {
    const content = TestingBarGraphContentModel.create({ });
    content.setSharedModel(sharedSampleDataSet());
    content.setPrimaryAttribute("att-s");
    content.setSecondaryAttribute("att-l");
    expect(content.dataArray).toEqual([
      { "att-s": "cat", "yard": { count: 2, selected: false }},
      { "att-s": "owl", "yard": { count: 1, selected: false }, "forest": { count: 1, selected: false }}
    ]);
  });

  it("returns expected array when a case is selected with primary and secondary attributes", () => {
    const content = TestingBarGraphContentModel.create({ });
    content.setSharedModel(sharedSampleDataSet());
    content.setPrimaryAttribute("att-s");
    content.setSecondaryAttribute("att-l");
    content.sharedModel?.dataSet.setSelectedCases([content.sharedModel?.dataSet.cases[0].__id__]);
    expect(content.dataArray).toEqual([
      { "att-s": "cat", "yard": { count: 2, selected: true }},
      { "att-s": "owl", "yard": { count: 1, selected: false }, "forest": { count: 1, selected: false }}
    ]);
    content.sharedModel?.dataSet.setSelectedCases([content.sharedModel?.dataSet.cases[3].__id__]);
    expect(content.dataArray).toEqual([
      { "att-s": "cat", "yard": { count: 2, selected: false }},
      { "att-s": "owl", "yard": { count: 1, selected: false }, "forest": { count: 1, selected: true }}
    ]);
    content.sharedModel?.dataSet.selectAllCases();
    expect(content.dataArray).toEqual([
      { "att-s": "cat", "yard": { count: 2, selected: true }},
      { "att-s": "owl", "yard": { count: 1, selected: true }, "forest": { count: 1, selected: true }}
    ]);
  });

  it("selects cases based on primary and secondary attributes", () => {
    const content = TestingBarGraphContentModel.create({ });
    content.setSharedModel(sharedSampleDataSet());
    const dataSet = content.sharedModel?.dataSet;
    expect(dataSet).toBeDefined();
    content.setPrimaryAttribute("att-s");
    content.setSecondaryAttribute("att-l");

    content.selectCasesByValues("cat", undefined);
    expect(dataSet?.selectedCaseIds.map(c => dataSet?.caseIndexFromID(c))).toEqual([0, 1]);

    content.selectCasesByValues("owl", undefined);
    expect(dataSet?.selectedCaseIds.map(c => dataSet?.caseIndexFromID(c))).toEqual([2, 3]);

    content.selectCasesByValues("cat", "yard");
    expect(dataSet?.selectedCaseIds.map(c => dataSet?.caseIndexFromID(c))).toEqual([0, 1]);

    content.selectCasesByValues("owl", "yard");
    expect(dataSet?.selectedCaseIds.map(c => dataSet?.caseIndexFromID(c))).toEqual([2]);

    content.selectCasesByValues("owl", "forest");
    expect(dataSet?.selectedCaseIds.map(c => dataSet?.caseIndexFromID(c))).toEqual([3]);

    content.selectCasesByValues("cat", "forest");
    expect(dataSet?.selectedCaseIds.map(c => dataSet?.caseIndexFromID(c))).toEqual([]);
  });

  it("fills in missing values with (no value)", () => {
    const content = TestingBarGraphContentModel.create({ });
    const dataSet = sharedSampleDataSet();
    dataSet.dataSet?.attributes[1].setValue(3, undefined); // hide forest owl's location
    content.setSharedModel(dataSet);
    content.setPrimaryAttribute("att-s");
    content.setSecondaryAttribute("att-l");
    expect(content.dataArray).toEqual([
      { "att-s": "cat", "yard": { count: 2, selected: false }},
      { "att-s": "owl", "yard": { count: 1, selected: false}, "(no value)": { count: 1, selected: false }}
    ]);
  });

  it("migrates secondaryAttributeColorMap to attributeColorMap", () => {
    const oldSnapshot = {
      type: "BarGraph",
      yAxisLabel: "",
      dataSetId: "test-dataset-123",
      primaryAttribute: "size",
      secondaryAttribute: "location",
      secondaryAttributeColorMap: {
        "location": {
          "yard": 1,
          "forest": 2
        }
      }
    };

    const content = BarGraphContentModel.create(oldSnapshot as any);
    const snapshot = getSnapshot(content) as any;

    expect(snapshot.secondaryAttributeColorMap).toBeUndefined();
    expect(snapshot.attributeColorMap).toEqual({
      "location": {
        "yard": 1,
        "forest": 2
      }
    });
  });

  it("extracts primary keys", () => {
    const content = TestingBarGraphContentModel.create({ });
    content.setSharedModel(sharedSampleDataSet());
    content.setPrimaryAttribute("att-s");
    expect(content.primaryKeys).toEqual(["cat", "owl"]);
  });

  it("extracts secondary keys", () => {
    const content = TestingBarGraphContentModel.create({ });
    content.setSharedModel(sharedSampleDataSet());
    content.setPrimaryAttribute("att-s");
    content.setSecondaryAttribute("att-l");
    expect(content.secondaryKeys).toEqual(["yard", "forest"]);
  });

  it("calculates the maximum data value", () => {
    const content = TestingBarGraphContentModel.create({ });
    content.setSharedModel(sharedSampleDataSet());
    content.setPrimaryAttribute("att-s");
    expect(content.maxDataValue).toBe(2);

    content.setPrimaryAttribute("att-l");
    expect(content.maxDataValue).toBe(3);

    content.setSecondaryAttribute("att-s");
    expect(content.maxDataValue).toBe(2);
  });

  it("sets the primary attribute color", () => {
    const content = TestingBarGraphContentModel.create({ });
    content.setPrimaryAttribute("att-l");
    content.setPrimaryAttributeKeyColor("key1", 1);
    expect(content.colorForPrimaryKey("key1")).toBe(1);
  });

  it("sets a secondary attribute key's color", () => {
    const content = TestingBarGraphContentModel.create({ });
    content.setPrimaryAttribute("att-l");
    content.setSecondaryAttribute("att-s");
    content.setSecondaryAttributeKeyColor("key1", 2);
    content.setSecondaryAttributeKeyColor("key2", 3);
    expect(content.colorForSecondaryKey("key1")).toBe(2);
    expect(content.colorForSecondaryKey("key2")).toBe(3);
  });

  it("can export content", () => {
    const content = TestingBarGraphContentModel.create({ });
    const expected = {
      type: "BarGraph",
      yAxisLabel: "",
      attributeColorMap: {},
      dataSetId: undefined,
      primaryAttribute: undefined,
      secondaryAttribute: undefined
    };
    expect(JSON.parse(content.exportJson())).toEqual(expected);
  });

});
