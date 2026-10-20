import { DataSet, addAttributeToDataSet } from "../../../models/data/data-set";
import { expressionTargets } from "./use-formula-modal";

// The Set Expression dialog has its own column picker. Offering a derived column there would show
// the formula the table otherwise keeps out of sight, and let Clear or OK act on it.
describe("expressionTargets", () => {
  it("offers every column but a derived one", () => {
    const dataSet = DataSet.create();
    addAttributeToDataSet(dataSet, { id: "number", name: "Event Number", derived: true });
    addAttributeToDataSet(dataSet, { id: "type", name: "eventType" });
    addAttributeToDataSet(dataSet, { id: "start", name: "windowStart" });

    expect(expressionTargets(dataSet).map(attr => attr.id)).toEqual(["type", "start"]);
  });
});
