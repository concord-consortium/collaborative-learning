import { TileHandlerParams } from "../ai-summarizer-types";
import { describeDrawingObject, handleDrawingTile } from "./handle-drawing-tile";

function params(content: unknown): TileHandlerParams {
  return {
    tile: { model: { id: "tile1", content }, number: 1 },
    dataSets: [], headingLevel: 3, options: {}
  } as unknown as TileHandlerParams;
}

describe("handleDrawingTile", () => {
  it("passes on a tile that is not a drawing", () => {
    expect(handleDrawingTile(params({ type: "Text" }))).toBeUndefined();
  });

  it("summarizes a drawing", () => {
    const result = handleDrawingTile(params({
      type: "Drawing",
      objects: [{ id: "r1", type: "rectangle", x: 0, y: 0, width: 10, height: 5 }]
    }));
    expect(result).toContain("| r1 | rectangle | 0, 0 | 10 x 5 |");
  });

  it("says a drawing is malformed rather than throwing", () => {
    // Whatever the malformation is, it must cost the reader this tile and no more. Nothing guards
    // the handler loop in tileSummary, so anything thrown here propagates out of
    // documentSummarizer and the entire document's summary is lost — every other tile with it.
    const result = handleDrawingTile(params({ type: "Drawing", objects: [null] }));
    expect(result).toBe("This tile contains a malformed drawing.");
  });
});

describe("describeDrawingObject", () => {
  const content = {
    type: "Drawing",
    objects: [
      { id: "o1", type: "rectangle", x: 10, y: 20 },
      { id: "o2", type: "text", text: "goes up by 10" },
      { id: "o3", type: "group", objectIds: ["o1"] }
    ]
  };

  function describe_(objectId: string, objectType?: string) {
    return describeDrawingObject({
      tile: { id: "d1", content }, objectId, objectType, dataSets: [], variables: []
    });
  }

  it("names a shape by its kind and id", () => {
    expect(describe_("o1", "rectangle")).toBe("rectangle o1");
  });

  // The drawing summarizer already prints an id column for every shape, so the id in the label is
  // what lets a reader find the shape there.
  it("quotes a text object's words, which are the student's", () => {
    expect(describe_("o2", "text")).toBe('text o2 reading "goes up by 10"');
  });

  it("reports nothing for an object the drawing no longer holds", () => {
    expect(describe_("gone", "rectangle")).toBeUndefined();
  });

  it("names a shape by the stored type when the annotation carries none", () => {
    expect(describe_("o1")).toBe("rectangle o1");
  });
});
