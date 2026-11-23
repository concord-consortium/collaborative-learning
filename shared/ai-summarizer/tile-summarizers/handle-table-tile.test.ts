import { describeTableObject } from "./handle-table-tile";
import { NormalizedDataSet } from "../ai-summarizer-types";

const dataSet: NormalizedDataSet = {
  id: "ds1",
  providerId: "table1",
  name: "Trip",
  tileIds: ["table1"],
  attributes: [
    { id: "a1", name: "time", values: ["1", "2", "3"] },
    { id: "a2", name: "distance", values: ["10", "24.5", ""] }
  ],
  numCases: 3,
  caseIds: ["c1", "c2", "c3"],
  data: []
};

function describe_(objectId: string, objectType = "cell") {
  return describeTableObject({
    tile: { id: "table1", content: { type: "Table" } },
    objectId,
    objectType,
    dataSets: [dataSet],
    variables: []
  });
}

describe("describeTableObject", () => {
  it("names the row, the column and the value in it", () => {
    expect(describe_("cell:{c2}:{a2}")).toBe("row 2 of distance (24.5)");
  });

  // A student can draw a sparrow to a cell they have not filled in yet; an empty cell is not a
  // missing one.
  it("says a cell is empty rather than reporting it gone", () => {
    expect(describe_("cell:{c3}:{a2}")).toBe("row 3 of distance (empty)");
  });

  it("reports nothing for a case the data set no longer holds", () => {
    expect(describe_("cell:{deleted}:{a2}")).toBeUndefined();
  });

  it("reports nothing for a column the data set no longer holds", () => {
    expect(describe_("cell:{c1}:{deleted}")).toBeUndefined();
  });

  it("reports nothing for an object type it does not handle", () => {
    expect(describe_("c1", "row")).toBeUndefined();
  });
});
