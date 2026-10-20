import { DataSet, addAttributeToDataSet } from "../../../models/data/data-set";
import { expressionTargets } from "./use-formula-modal";

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
