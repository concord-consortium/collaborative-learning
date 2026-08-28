import { TileHandlerParams } from "../ai-summarizer-types";
import { handleDrawingTile } from "./handle-drawing-tile";

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
