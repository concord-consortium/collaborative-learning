import { reaction } from "mobx";
import {getSnapshot, Instance, types} from "mobx-state-tree";
import { DataSet } from "../../../models/data/data-set";
import { DataConfigurationModel } from "./data-configuration-model";
import {SharedCaseMetadata} from "../../../models/shared/shared-case-metadata";

const TreeModel = types.model("Tree", {
  data: DataSet,
  metadata: SharedCaseMetadata,
  config: DataConfigurationModel
});

let tree: Instance<typeof TreeModel>;

describe("DataConfigurationModel", () => {
  beforeEach(() => {
    tree = TreeModel.create({
      data: getSnapshot(DataSet.create()),
      metadata: getSnapshot(SharedCaseMetadata.create()),
      config: getSnapshot(DataConfigurationModel.create())
    });
    tree.data.addAttributeWithID({ id: "nId", name: "n" });
    tree.data.addAttributeWithID({ id: "xId", name: "x" });
    tree.data.addAttributeWithID({ id: "yId", name: "y" });
    tree.metadata.setData(tree.data);
    tree.data.addCasesWithIDs([
      { __id__: "c1", n: "n1", x: 1, y: 1 }, { __id__: "c2", x: 2 }, { __id__: "c3", n: "n3", y: 3 }
    ]);
  });

  it("behaves as expected when empty", () => {
    const config = tree.config;
    expect(config.isEmpty).toBeTruthy();
    expect(config.defaultCaptionAttributeID).toBeUndefined();
    expect(config.attributeID("x")).toBeUndefined();
    expect(config.attributeID("y")).toBeUndefined();
    expect(config.attributeID("caption")).toBeUndefined();
    expect(config.attributeType("x")).toBeUndefined();
    expect(config.attributeType("caption")).toBeUndefined();
    expect(config.dataset).toBeUndefined();
    expect(config.metadata).toBeUndefined();
    expect(config.places).toEqual([]);
    expect(config.attributes).toEqual([]);
    expect(config.uniqueAttributes).toEqual([]);
    expect(config.tipAttributes).toEqual([]);
    expect(config.uniqueTipAttributes).toEqual([]);
    expect(config.caseDataArray).toEqual([]);
  });

  it("behaves as expected with empty/case plot", () => {
    const config = tree.config;
    config.setDataset(tree.data, tree.metadata);
    expect(config.dataset).toEqual(tree.data);
    expect(config.metadata).toEqual(tree.metadata);
    expect(config.isEmpty).toBeTruthy();
    expect(config.defaultCaptionAttributeID).toBe("nId");
    expect(config.attributeID("x")).toBeUndefined();
    expect(config.attributeID("y")).toBeUndefined();
    expect(config.attributeID("caption")).toBe("nId");
    expect(config.attributeType("x")).toBeUndefined();
    expect(config.attributeType("caption")).toBe("categorical");
    expect(config.places).toEqual(["caption"]);
    expect(config.attributes).toEqual(["nId"]);
    expect(config.uniqueAttributes).toEqual(["nId"]);
    expect(config.tipAttributes).toEqual([{attributeID: "nId", role: "caption"}]);
    expect(config.uniqueTipAttributes).toEqual([{attributeID: "nId", role: "caption"}]);
    expect(config.caseDataArray).toEqual([
      { dataConfigID: config.id, plotNum: 0, caseID: "c1" },
      { dataConfigID: config.id, plotNum: 0, caseID: "c2" },
      { dataConfigID: config.id, plotNum: 0, caseID: "c3" }
    ]);
  });

  it("behaves as expected with dot chart on x axis", () => {
    const config = tree.config;
    config.setDataset(tree.data, tree.metadata);
    config.setAttributeForRole("x", { attributeID: "nId" });
    expect(config.isEmpty).toBeFalsy();
    expect(config.defaultCaptionAttributeID).toBe("nId");
    expect(config.attributeID("x")).toBe("nId");
    expect(config.attributeID("y")).toBeUndefined();
    expect(config.attributeID("caption")).toBe("nId");
    expect(config.attributeType("x")).toBe("categorical");
    expect(config.attributeType("caption")).toBe("categorical");
    expect(config.places).toEqual(["x", "caption"]);
    expect(config.attributes).toEqual(["nId", "nId"]);
    expect(config.uniqueAttributes).toEqual(["nId"]);
    expect(config.tipAttributes).toEqual([{attributeID: "nId", role: "x"},
      {attributeID: "nId", role: "caption"}]);
    expect(config.uniqueTipAttributes).toEqual([{attributeID: "nId", role: "caption"}]);
    expect(config.caseDataArray).toEqual([
      { dataConfigID: config.id, plotNum: 0, caseID: "c1" },
      { dataConfigID: config.id, plotNum: 0, caseID: "c3" }
    ]);
  });

  it("behaves as expected with dot plot on x axis", () => {
    const config = tree.config;
    config.setDataset(tree.data, tree.metadata);
    config.setAttributeForRole("x", { attributeID: "xId" });
    expect(config.defaultCaptionAttributeID).toBe("nId");
    expect(config.attributeID("x")).toBe("xId");
    expect(config.attributeID("y")).toBeUndefined();
    expect(config.attributeID("caption")).toBe("nId");
    expect(config.attributeType("x")).toBe("numeric");
    expect(config.attributeType("caption")).toBe("categorical");
    expect(config.places).toEqual(["x", "caption"]);
    expect(config.attributes).toEqual(["xId", "nId"]);
    expect(config.uniqueAttributes).toEqual(["xId", "nId"]);
    expect(config.tipAttributes).toEqual([{attributeID: "xId", role: "x"},
      {attributeID: "nId", role: "caption"}]);
    expect(config.uniqueTipAttributes).toEqual([{attributeID: "xId", role: "x"},
      {attributeID: "nId", role: "caption"}]);
    expect(config.caseDataArray).toEqual([
      { dataConfigID: config.id, plotNum: 0, caseID: "c1" },
      { dataConfigID: config.id, plotNum: 0, caseID: "c2" }
    ]);
  });

  it("behaves as expected with scatter plot and explicit caption attribute", () => {
    const config = tree.config;
    config.setDataset(tree.data, tree.metadata);
    // xId on x-axis, yId on y-axis
    config.setAttributeForRole("x", { attributeID: "xId" });
    config.setAttributeForRole("y", { attributeID: "yId" });
    config.setAttributeForRole("caption", { attributeID: "nId" });
    expect(config.defaultCaptionAttributeID).toBe("nId");
    expect(config.attributeID("x")).toBe("xId");
    expect(config.attributeID("y")).toBe("yId");
    expect(config.attributeID("caption")).toBe("nId");
    expect(config.attributeType("x")).toBe("numeric");
    expect(config.attributeType("y")).toBe("numeric");
    expect(config.attributeType("caption")).toBe("categorical");
    expect(config.places).toEqual(["x", "caption", "y"]);
    expect(config.attributes).toEqual(["xId", "nId", "yId"]);
    expect(config.uniqueAttributes).toEqual(["xId", "nId", "yId"]);
    expect(config.tipAttributes).toEqual([{attributeID: "xId", role: "x"},
      {attributeID: "yId", role: "y"}, {attributeID: "nId", role: "caption"}]);
    expect(config.uniqueTipAttributes).toEqual([{attributeID: "xId", role: "x"},
      {attributeID: "yId", role: "y"}, {attributeID: "nId", role: "caption"}]);
    expect(config.caseDataArray).toEqual([{ dataConfigID: config.id, plotNum: 0, caseID: "c1" }]);

    // behaves as expected after removing x axis attribute (yId on y-axis)
    config.setAttributeForRole("x");
    expect(config.defaultCaptionAttributeID).toBe("nId");
    expect(config.attributeID("x")).toBeUndefined();
    expect(config.attributeID("y")).toBe("yId");
    expect(config.attributeID("caption")).toBe("nId");
    expect(config.attributeType("x")).toBeUndefined();
    expect(config.attributeType("y")).toBe("numeric");
    expect(config.attributeType("caption")).toBe("categorical");
    expect(config.places).toEqual(["caption", "y"]);
    expect(config.attributes).toEqual(["nId", "yId"]);
    expect(config.uniqueAttributes).toEqual(["nId", "yId"]);
    expect(config.tipAttributes).toEqual([{attributeID: "yId", role: "y"},
      {attributeID: "nId", role: "caption"}]);
    expect(config.uniqueTipAttributes).toEqual([{attributeID: "yId", role: "y"},
      {attributeID: "nId", role: "caption"}]);
    expect(config.caseDataArray).toEqual([
      { dataConfigID: config.id, plotNum: 0, caseID: "c1" },
      { dataConfigID: config.id, plotNum: 0, caseID: "c3" }
    ]);

    // updates cases when values change
    tree.data.setCanonicalCaseValues([{ __id__: "c2", "yId": 2 }]);
    expect(config.caseDataArray).toEqual([
      { dataConfigID: config.id, plotNum: 0, caseID: "c1" },
      { dataConfigID: config.id, plotNum: 0, caseID: "c2" },
      { dataConfigID: config.id, plotNum: 0, caseID: "c3" }
    ]);

    // triggers observers when values change
    const trigger = jest.fn();
    reaction(() => config.caseDataArray, () => trigger());
    expect(trigger).not.toHaveBeenCalled();
    tree.data.setCanonicalCaseValues([{ __id__: "c2", "yId": "" }]);
    expect(trigger).toHaveBeenCalledTimes(2); // TODO: should be 1
    expect(config.caseDataArray).toEqual([
      { dataConfigID: config.id, plotNum: 0, caseID: "c1" },
      { dataConfigID: config.id, plotNum: 0, caseID: "c3" }
    ]);
    tree.data.setCanonicalCaseValues([{ __id__: "c2", "yId": "2" }]);
    expect(trigger).toHaveBeenCalledTimes(4); // TODO: should be 2
    expect(config.caseDataArray).toEqual([
      { dataConfigID: config.id, plotNum: 0, caseID: "c1" },
      { dataConfigID: config.id, plotNum: 0, caseID: "c2" },
      { dataConfigID: config.id, plotNum: 0, caseID: "c3" }
    ]);
  });

  it("selection behaves as expected", () => {
    const config = tree.config;
    config.setDataset(tree.data, tree.metadata);
    config.setAttributeForRole("x", { attributeID: "xId" });
    expect(config.caseSelection.length).toBe(0);

    config.setDataset(tree.data, tree.metadata);
    tree.data.selectAllCases();
    expect(config.caseSelection.length).toBe(2);

    config.setAttributeForRole("x", { attributeID: "xId" });
    expect(config.caseSelection.length).toBe(0);

    const selectionReaction = jest.fn();
    const disposer = reaction(() => config.caseSelection, () => selectionReaction());
    expect(selectionReaction).toHaveBeenCalledTimes(0);
    config.setAttributeForRole("y", { attributeID: "yId" });
    expect(config.caseSelection.length).toBe(0);
    expect(selectionReaction).toHaveBeenCalledTimes(1);
    disposer();
  });

  it("calls action listeners when appropriate", () => {
    const config = tree.config;
    config.setDataset(tree.data, tree.metadata);
    config.setAttributeForRole("x", { attributeID: "xId" });

    const handleAction = jest.fn();
    config.onAction(handleAction);

    tree.data.setCanonicalCaseValues([{ __id__: "c1", xId: 1.1 }]);
    expect(handleAction).toHaveBeenCalled();
    expect(handleAction.mock.lastCall[0].name).toBe("setCaseValues");
    handleAction.mockClear();

    tree.data.setCanonicalCaseValues([{ __id__: "c3", xId: 3 }]);
    expect(handleAction).toHaveBeenCalled();
    expect(handleAction.mock.lastCall[0].name).toBe("addCases");
    handleAction.mockClear();

    tree.data.setCanonicalCaseValues([{ __id__: "c1", xId: "" }]);
    expect(handleAction).toHaveBeenCalled();
    expect(handleAction.mock.lastCall[0].name).toBe("removeCases");
    handleAction.mockClear();

    tree.data.setCanonicalCaseValues([{ __id__: "c1", xId: 1 }, { __id__: "c2", xId: "" }, { __id__: "c3", xId: 3.3 }]);
    expect(handleAction).toHaveBeenCalled();
  });

  it("only allows x and y as primary place", () => {
    const config = tree.config;
    config.setDataset(tree.data, tree.metadata);
    config.setPrimaryRole('y');
    expect(config.primaryRole).toBe("y");
    config.setPrimaryRole('caption');
    expect(config.primaryRole).toBe("y");
  });

  it("returns an attribute values array and category set that ignore empty values", () => {
    tree.data.addCasesWithIDs([
      { __id__: "c4", n: "n1", x: 1, y: 1 },
      { __id__: "c5", n: "", x: 6, y: 1 },
      { __id__: "c6", n: "n1", x: 6, y: 6 }]);
    const config = tree.config;
    config.setDataset(tree.data, tree.metadata);
    config.setAttributeForRole("x", { attributeID: "xId" });
    config.setAttributeForRole("y", { attributeID: "yId" });
    config.setAttributeForRole("caption", { attributeID: "nId" });
    expect(config.valuesForAttrRole("x")).toEqual(["1", "1", "6", "6"]);
    expect(config.valuesForAttrRole("y")).toEqual(["1", "1", "1", "6"]);
    expect(config.valuesForAttrRole("caption")).toEqual(["n1", "n1", "n1"]);
    expect(config.categoryArrayForAttrRole("x")).toEqual(["1", "6"]);
    expect(config.categoryArrayForAttrRole("y")).toEqual(["1", "6"]);
    expect(config.categoryArrayForAttrRole("caption")).toEqual(["n1"]);
    expect(config.numericValuesForAttrRole("x")).toEqual([1, 1, 6, 6]);
    expect(config.numericValuesForAttrRole("caption")).toEqual([]);

    config.setAttributeForRole("y");
    expect(config.valuesForAttrRole("y")).toEqual([]);
    expect(config.categoryArrayForAttrRole("y")).toEqual(["__main__"]);
  });

  it("returns an array of cases in a plot", () => {
    const config = tree.config;
    config.setDataset(tree.data, tree.metadata);
    expect(config.subPlotCases({})).toEqual([
      {"__id__": "c1", "nId": "n1", "xId": 1, "yId": 1},
      {"__id__": "c2", "xId": 2},
      {"__id__": "c3", "nId": "n3", "yId": 3}
    ]);
  });

});
