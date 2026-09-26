import { handleGraphTile } from "./handle-graph-tile";
import { NormalizedDataSet } from "../ai-summarizer-types";

function graphTile(layers: any[], dataSets: NormalizedDataSet[]) {
  return {
    dataSets,
    tile: {
      model: {
        content: {
          type: "Graph",
          plotType: "scatterPlot",
          axes: { bottom: { min: 0, max: 10 }, left: { min: 0, max: 10 } },
          layers
        }
      }
    }
  } as any;
}

function dataSet(overrides: Partial<NormalizedDataSet>): NormalizedDataSet {
  return { id: "ds1", providerId: "table1", tileIds: [], attributes: [], numCases: 0, data: [], ...overrides };
}

describe("handleGraphTile", () => {
  it("names the data set it plots", () => {
    const result = handleGraphTile(graphTile(
      [{ config: { dataset: "ds1" } }],
      [dataSet({ name: "Program 1" })]
    ));
    expect(result).toContain('the "Program 1" (ds1) data set');
  });

  // `name` is authored, not guaranteed (curriculum content can omit it), so an unnamed data set
  // must not literally read "undefined" in the description.
  it('names an unnamed data set by id instead of saying "undefined"', () => {
    const result = handleGraphTile(graphTile(
      [{ config: { dataset: "ds1" } }],
      [dataSet({})]
    ));
    expect(result).toContain("is data set ds1.");
    expect(result).not.toContain("undefined");
  });

  it("returns undefined for a non-graph tile", () => {
    const result = handleGraphTile({ dataSets: [], tile: { model: { content: { type: "Table" } } } } as any);
    expect(result).toBeUndefined();
  });
});
