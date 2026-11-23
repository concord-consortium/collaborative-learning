import { describeGraphObject, handleGraphTile } from "./handle-graph-tile";
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

describe("describeGraphObject", () => {
  const graphDataSet: NormalizedDataSet = {
    id: "ds1",
    providerId: "table1",
    name: "Trip",
    tileIds: ["table1", "graph1"],
    attributes: [
      { id: "ax", name: "time", values: ["1", "2"] },
      { id: "ay", name: "distance", values: ["10", "24.5"] }
    ],
    numCases: 2,
    caseIds: ["c1", "c2"],
    data: []
  };

  function describe_(objectId: string, objectType: string, content: any = { type: "Graph" }) {
    return describeGraphObject({
      tile: { id: "graph1", content },
      objectId,
      objectType,
      dataSets: [graphDataSet],
      variables: [{ id: "v1", name: "speed" }, { id: "v2", name: "drag" }]
    });
  }

  it("names a dot by the values it is plotted at", () => {
    expect(describe_("dot:{c2}:{ax}:{ay}", "dot")).toBe("the dot at (2, 24.5)");
  });

  it("reports nothing for a dot whose case is gone", () => {
    expect(describe_("dot:{deleted}:{ax}:{ay}", "dot")).toBeUndefined();
  });

  it("names a movable line handle, with the line's equation", () => {
    const content = {
      type: "Graph",
      adornments: [{ type: "Movable Line", lines: { "{}": { slope: 2, intercept: -3 } } }]
    };
    expect(describe_("movable_line_handle:{}:lower", "movable-line-handle", content))
      .toBe("the lower handle of the movable line y = 2x - 3");
  });

  it("names a movable line handle without an equation when the line is gone", () => {
    expect(describe_("movable_line_handle:{}:upper", "movable-line-handle"))
      .toBe("the upper handle of the movable line");
  });

  it("names the movable line's equation box", () => {
    const content = {
      type: "Graph",
      adornments: [{ type: "Movable Line", lines: { "{}": { slope: 0.5, intercept: 1 } } }]
    };
    expect(describe_("movable_line_equation:{}", "movable-line-equation", content))
      .toBe("the equation of the movable line y = 0.5x + 1");
  });

  it("names a plotted variable point by its two variables", () => {
    expect(describe_("var:{v1}:{v2}", "variable")).toBe("the plotted point for speed against drag");
  });

  it("reports nothing for an object type it does not handle", () => {
    expect(describe_("whatever", "mystery")).toBeUndefined();
  });
});
