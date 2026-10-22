import { DataSet, addAttributeToDataSet } from "../../../models/data/data-set";
import { defaultExpressionTarget, expressionTargets } from "./use-formula-modal";

function dataSetWith(columns: Array<{ id: string, formulaHidden?: boolean }>) {
  const dataSet = DataSet.create();
  columns.forEach(({ id, formulaHidden }) => addAttributeToDataSet(dataSet, { id, name: id, formulaHidden }));
  return dataSet;
}

// The Set Expression dialog has its own column picker. Offering a column whose formula is hidden
// there would show that formula, and let Clear or OK act on it.
describe("expressionTargets", () => {
  it("offers every column but one whose formula is hidden", () => {
    const dataSet = DataSet.create();
    addAttributeToDataSet(dataSet, { id: "number", name: "Event Number", formulaHidden: true });
    addAttributeToDataSet(dataSet, { id: "type", name: "eventType" });
    addAttributeToDataSet(dataSet, { id: "start", name: "windowStart" });

    expect(expressionTargets(dataSet).map(attr => attr.id)).toEqual(["type", "start"]);
  });
});

describe("defaultExpressionTarget", () => {
  it("starts on the second column of an ordinary table", () => {
    expect(defaultExpressionTarget(dataSetWith([{ id: "x" }, { id: "y" }, { id: "z" }]))?.id).toBe("y");
  });

  it("skips a column whose formula is hidden", () => {
    const dataSet = dataSetWith([{ id: "x" }, { id: "number", formulaHidden: true }, { id: "type" }]);
    expect(defaultExpressionTarget(dataSet)?.id).toBe("type");
  });

  // Otherwise the picker shows the first column while Clear and OK act on nothing.
  it("falls back to the first column it offers when no later one is offered", () => {
    expect(defaultExpressionTarget(dataSetWith([{ id: "x" }, { id: "number", formulaHidden: true }]))?.id)
      .toBe("x");
    expect(defaultExpressionTarget(dataSetWith([{ id: "x" }]))?.id).toBe("x");
  });

  it("has nothing to start on when no column is offered", () => {
    expect(defaultExpressionTarget(dataSetWith([{ id: "number", formulaHidden: true }]))).toBeUndefined();
  });
});
