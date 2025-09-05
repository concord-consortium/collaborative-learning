import { NumericAxisModel } from "../../../../plugins/graph/imports/components/axis/models/axis-model";
import { GraphModel } from "../../../../plugins/graph/models/graph-model";
import { SharedVariables, SharedVariablesSnapshot } from "../../shared-variables";
import { isPlottedVariablesAdornment, PlottedVariablesAdornmentModel } from "./plotted-variables-adornment-model";
import { kPlottedVariablesType } from "./plotted-variables-adornment-types";

// Need to register the adornment so it can be added to the graph
import "./plotted-variables-adornment-registration";

jest.mock("../../../../models/document/shared-model-document-manager", () => ({
  getTileModel: jest.fn(() => ({ id: "tile-1" }))
}));
jest.mock("../../../../models/tiles/tile-environment", () => ({
  getSharedModelManager: jest.fn(() => ({
    isReady: true,
    findFirstSharedModelByType: jest.fn((_type: any, _id: string) =>
      SharedVariables.create(sharedVariables)
    )
  }))
}));


const defaultSharedVariables: SharedVariablesSnapshot = {
  variables: [
    { id: "x", name: "x",value: 10 },
    { id: "y", inputs: [ "x" ], expression: "x * 2" }
  ]
};
let sharedVariables = defaultSharedVariables;

describe("PlottedVariablesAdornmentModel", () => {
  it("should create an instance with default values", () => {
    const model = PlottedVariablesAdornmentModel.create();
    expect(model.type).toBe(kPlottedVariablesType);
    expect(model.plottedVariables.size).toBe(0);
  });

  it("should add and remove plotted variables", () => {
    const model = PlottedVariablesAdornmentModel.create();
    const key = model.addPlottedVariables(undefined, "x", "y");
    expect(model.plottedVariables.size).toBe(1);
    expect(model.plottedVariables.get(key)?.xVariableId).toBe("x");
    model.removePlottedVariables(key);
    expect(model.plottedVariables.size).toBe(0);
  });

  it("should clear plotted variables", () => {
    const model = PlottedVariablesAdornmentModel.create();
    model.addPlottedVariables("a", "x", "y");
    model.addPlottedVariables("b", "x", "y");
    expect(model.plottedVariables.size).toBe(2);
    model.clearPlottedVariables();
    expect(model.plottedVariables.size).toBe(0);
  });

  it("should return variable values", () => {
    const model = PlottedVariablesAdornmentModel.create();
    model.addPlottedVariables("a", "x", "y");
    const values = model.variableValues;
    expect(values.x).toEqual([10]);
    expect(values.y).toEqual([20]);
  });

  it("should return annotatable objects", () => {
    const model = PlottedVariablesAdornmentModel.create();
    model.addPlottedVariables("a", "x", "y");
    const objects = model.annotatableObjects;
    expect(objects.length).toBe(1);
    expect(objects[0].objectId).toBe("var:{x}:{y}");
    expect(objects[0].objectType).toBe("variable");
  });

  it("should get annotatable object position", () => {
    const model = PlottedVariablesAdornmentModel.create();
    model.addPlottedVariables("a", "x", "y");
    const pos = model.getAnnotatableObjectPosition("variable", "var:{x}:{y}");
    expect(pos).toEqual({ x: 10, y: 20 });
    expect(model.getAnnotatableObjectPosition("other", "var:{x}:{y}")).toBeUndefined();
  });

  it("should return numeric values for attr role", () => {
    const model = PlottedVariablesAdornmentModel.create();
    model.addPlottedVariables("a", "x", "y");
    const xVals = model.numericValuesForAttrRole("x");
    expect(xVals).toContain(20); // 2 * 10
    expect(xVals).toContain(0);
    const yVals = model.numericValuesForAttrRole("y");
    expect(yVals).toContain(40); // 2 * 20
    expect(yVals).toContain(0);
    expect(model.numericValuesForAttrRole("rightNumeric")).toEqual([]);
  });

  it("should return numeric values based on the graph axis if the variable doesn't have a value", () => {
    sharedVariables = {
      variables: [
        { id: "x", name: "x" },
        { id: "y", inputs: [ "x" ], expression: "x * 2" }
      ]
    };
    const graph = GraphModel.create({});
    const bottomAxis = NumericAxisModel.create({ place: "bottom", min: 0, max: 100 });
    graph.setAxis("bottom", bottomAxis);
    const model = PlottedVariablesAdornmentModel.create();
    graph.addAdornment(model);
    model.addPlottedVariables("a", "x", "y");
    const xVals = model.numericValuesForAttrRole("x");
    // with no value set for "x" the empty array is returned and the code using
    // this function will just let th existing graph's x axis limits remain the same
    expect(xVals).toEqual([]);
    const yVals = model.numericValuesForAttrRole("y");
    // The domain of the graph x axis is [100, 0], so the y values will be
    // based on the limits of this domain
    expect(yVals).toEqual([200, 0]);
    expect(model.numericValuesForAttrRole("rightNumeric")).toEqual([]);

    // reset the sharedVariables, a proper rspec like `let` implementation would
    // eliminate the need for this line
    sharedVariables = defaultSharedVariables;
  });

  it("should identify as PlottedVariablesAdornment", () => {
    const model = PlottedVariablesAdornmentModel.create();
    expect(isPlottedVariablesAdornment(model)).toBe(true);
    expect(isPlottedVariablesAdornment({ type: "other" } as any)).toBe(false);
  });

  it("should setup and dispose compute", () => {
    const model = PlottedVariablesAdornmentModel.create();
    const key = model.addPlottedVariables(undefined, "x", "y");
    const pvi = model.plottedVariables.get(key)!;
    const { computeY, dispose } = pvi.setupCompute();
    expect(typeof computeY).toBe("function");
    expect(typeof dispose).toBe("function");
    dispose();
    expect(pvi.sharedVariablesCopy).toBeUndefined();
  });

  it("compute should return correct values", () => {
    const model = PlottedVariablesAdornmentModel.create();
    const key = model.addPlottedVariables(undefined, "x", "y");
    const pvi = model.plottedVariables.get(key)!;
    const { computeY, dispose } = pvi.setupCompute();
    expect(computeY(0)).toEqual(0);
    expect(computeY(1)).toEqual(2);
    expect(computeY(10)).toEqual(20);
    dispose();
    expect(pvi.sharedVariablesCopy).toBeUndefined();
  });

  it("compute should handle units", () => {
    sharedVariables = {
      variables: [
        { id: "x", name: "x", value: 10, unit: "m" },
        { id: "y", inputs: [ "x" ], expression: "(x * 2) to cm" }
      ]
    };
    const model = PlottedVariablesAdornmentModel.create();
    const key = model.addPlottedVariables(undefined, "x", "y");
    const pvi = model.plottedVariables.get(key)!;
    const { computeY, dispose } = pvi.setupCompute();
    expect(computeY(0)).toEqual(0);
    expect(computeY(1)).toEqual(200);
    expect(computeY(10)).toEqual(2000);
    dispose();
    expect(pvi.sharedVariablesCopy).toBeUndefined();
  });
});
