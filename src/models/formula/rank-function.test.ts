import { addAttributeToDataSet, addCasesToDataSet, IDataSet } from "../data/data-set";
import { SharedDataSet } from "../shared/shared-data-set";
import { evaluateFormulas } from "./formula-test-harness";

/**
 * Evaluates `formula` as the "rank" attribute of a dataset built from `cases`, through the real
 * formula engine, and returns the ranks in case order. The engine is the point of these tests:
 * `rank` is a semi-aggregate, and nothing about that is observable without it.
 */
function ranks(formula: string, cases: Record<string, string | number>[]) {
  const sharedDataSet = SharedDataSet.create();
  const dataSet: IDataSet = sharedDataSet.dataSet;
  Object.keys(cases[0]).forEach(name => addAttributeToDataSet(dataSet, { name }));
  addAttributeToDataSet(dataSet, { name: "rank" });
  dataSet.attrFromName("rank")!.setFormula(formula);
  addCasesToDataSet(dataSet, cases);

  evaluateFormulas(sharedDataSet);

  const rankAttr = dataSet.attrFromName("rank")!;
  return dataSet.cases.map(c => dataSet.getStrValue(c.__id__, rankAttr.id));
}

describe("rank", () => {
  it("ranks numbers in ascending order, not case order", () => {
    expect(ranks("rank(v)", [{ v: 50 }, { v: 10 }, { v: 30 }])).toEqual(["3", "1", "2"]);
  });

  it("ranks ISO date strings by the instant they name, whatever their offset", () => {
    // The same instant written three ways: the Wave Runner writes `Z`, a student may not.
    expect(ranks("rank(t)", [
      { t: "2026-02-01T05:00:00.000Z" },
      { t: "2026-02-01T00:30:00+00:00" },
      { t: "2026-02-01T02:00:00Z" }
    ])).toEqual(["3", "1", "2"]);
  });

  it("gives tied values consecutive ranks in case order", () => {
    // The Timeline breaks ties the same way: a stable sort leaves tied events in case order.
    expect(ranks("rank(v)", [{ v: 10 }, { v: 20 }, { v: 20 }, { v: 5 }]))
      .toEqual(["2", "3", "4", "1"]);
  });

  it("gives no rank to a case the filter excludes, and does not spend a rank on it", () => {
    expect(ranks(`rank(v, keep != "")`, [
      { v: 10, keep: "yes" }, { v: 20, keep: "" }, { v: 30, keep: "yes" }
    ])).toEqual(["1", "", "2"]);
  });

  // A filter naming no attribute evaluates to one value rather than a column. Paired off by
  // position it would reach only the first case, leaving the rest unranked.
  it("applies a constant filter to every case, not just the first", () => {
    expect(ranks("rank(v, true)", [{ v: 30 }, { v: 10 }, { v: 20 }])).toEqual(["3", "1", "2"]);
  });

  it("gives no rank to an empty or unparseable value, and does not spend a rank on it", () => {
    expect(ranks("rank(v)", [{ v: 10 }, { v: "" }, { v: "not a time" }, { v: 30 }]))
      .toEqual(["1", "", "", "2"]);
  });
});
