import { getSnapshot, types } from "mobx-state-tree";
import { AdornmentModel, IAdornmentModel, PointModel, UnknownAdornmentModel } from "./adornment-models";
import { AdornmentModelUnion } from "./adornment-types";
import { MovableLineModel, isMovableLine } from "./movable-line/movable-line-model";
import { MovablePointModel, isMovablePoint } from "./movable-point/movable-point-model";
import { MovableValueModel, isMovableValue } from "./movable-value/movable-value-model";

describe("PointModel", () => {
  it("is valid if x and y are finite", () => {
    const point = PointModel.create({x: 1, y: 1});
    expect(point.isValid()).toBe(true);
  });
  it("is invalid if x is not finite", () => {
    const point = PointModel.create({x: NaN, y: 1});
    expect(point.isValid()).toBe(false);
  });
  it("is invalid if y is not finite", () => {
    const point = PointModel.create({x: 1, y: NaN});
    expect(point.isValid()).toBe(false);
  });
  it("can have its x and y values changed", () => {
    const point = PointModel.create({x: 1, y: 1});
    point.set({x: 2, y: 2});
    expect(point.x).toBe(2);
    expect(point.y).toBe(2);
  });
});

describe("AdornmentModel", () => {
  it("throws an error when type is not specified on creation", () => {
    expect(() => AdornmentModel.create()).toThrow("type must be overridden");
  });
  it("has an ID that begins with 'ADRN'", () => {
    const adornment = AdornmentModel.create({type: "Movable Line"});
    expect(adornment.id).toMatch(/^ADRN/);
  });
  it("is visible by default and can have its visibility property changed", () => {
    const adornment = AdornmentModel.create({type: "Movable Line"});
    expect(adornment.isVisible).toBe(true);
    adornment.setVisibility(false);
    expect(adornment.isVisible).toBe(false);
  });
  it("will create a sub plot key from given values", () => {
    const options = {
      xAttrId: "abc123",
      xCats: ["pizza", "pasta", "salad"],
      yAttrId: "def456",
      yCats: ["red", "green", "blue"],
      topAttrId: "ghi789",
      topCats: ["small", "medium", "large"],
      rightAttrId: "jkl012",
      rightCats: ["new", "used"]
    };
    const adornment = AdornmentModel.create({type: "Movable Line"});
    const subPlotKey = adornment.setSubPlotKey(options, 0);
    expect(subPlotKey).toEqual({abc123: "pizza", def456: "red", ghi789: "small", jkl012: "new"});
  });
  it("will create an instance key value from given category values", () => {
    const adornment = AdornmentModel.create({type: "Movable Line"});
    const xCategories = ["pizza", "pasta", "salad"];
    const yCategories = ["red", "green", "blue"];
    const subPlotKey = {abc123: xCategories[0], def456: yCategories[0]};
    expect(adornment.instanceKey({})).toEqual("{}");
    expect(adornment.instanceKey(subPlotKey)).toEqual("{\"abc123\":\"pizza\",\"def456\":\"red\"}");
  });
  it("will create a class name from a given subplot key", () => {
    const adornment = AdornmentModel.create({type: "Movable Line"});
    const xCategories = ["pizza", "pasta", "salad"];
    const yCategories = ["red", "green", "blue"];
    const subPlotKey = {abc123: xCategories[0], def456: yCategories[0]};
    expect(adornment.classNameFromKey(subPlotKey)).toEqual("abc123-pizza-def456-red");
  });
});

describe("UnknownAdornmentModel", () => {
  it("is created with its type property set to 'Unknown'", () => {
    const unknownAdornment = UnknownAdornmentModel.create();
    expect(unknownAdornment.type).toEqual("Unknown");
  });
});

describe("Deserialization", () => {
  it("provides the information required for deserialization of adornments to the appropriate type", () => {
    const M = types.model("Test", {
      adornment: AdornmentModelUnion
    })
    .actions(self => ({
      setAdornment(adornment: IAdornmentModel) {
        self.adornment = adornment;
      }
    }));

    const movableLine = MovableLineModel.create({ type: "Movable Line", lines: {} });
    const testModel = M.create({ adornment: movableLine });
    expect(isMovableLine(testModel.adornment) && testModel.adornment.lines).toBeDefined();
    const snap1 = getSnapshot(testModel);
    const testModel2 = M.create(snap1);
    expect(isMovableLine(testModel2.adornment) && testModel2.adornment.lines).toBeDefined();

    const movablePoint = MovablePointModel.create({ type: "Movable Point", points: {} });
    testModel.setAdornment(movablePoint);
    expect(isMovablePoint(testModel.adornment) && testModel.adornment.points).toBeDefined();
    const snap2 = getSnapshot(testModel);
    const testModel3 = M.create(snap2);
    expect(isMovablePoint(testModel3.adornment) && testModel3.adornment.points).toBeDefined();

    const movableValue = MovableValueModel.create({ type: "Movable Value", value: 1 });
    testModel.setAdornment(movableValue);
    expect(isMovablePoint(testModel.adornment) && testModel.adornment.points).toBeDefined();
    const snap3 = getSnapshot(testModel);
    const testModel4 = M.create(snap3);
    expect(isMovableValue(testModel4.adornment) && testModel4.adornment.value).toBeDefined();

    const unknownAdornment = UnknownAdornmentModel.create();
    testModel.setAdornment(unknownAdornment);
    expect(testModel.adornment.type).toEqual("Unknown");
    const snap4 = getSnapshot(testModel);
    const testModel5 = M.create(snap4);
    expect(testModel5.adornment.type).toEqual("Unknown");
  });
});
