import { handleDrawingTileLabels } from "./handle-drawing-tile-labels";
import { INormalizedTile, TileHandlerParams } from "../ai-summarizer-types";

function params(content: any): TileHandlerParams {
  return {
    dataSets: [],
    tile: { model: { id: "tile1", content }, number: 1 } as unknown as INormalizedTile,
    tileMap: undefined,
    headingLevel: 1,
    options: {},
  };
}

describe("handleDrawingTileLabels", () => {
  it("returns undefined for a non-Drawing tile", () => {
    expect(handleDrawingTileLabels(params({ type: "Text" }))).toBeUndefined();
  });

  it("returns the bare sentence for an empty drawing", () => {
    const result = handleDrawingTileLabels(params({ type: "Drawing", objects: [] }));
    expect(result).toBe("This tile contains a drawing.");
  });

  it("returns the bare sentence when the drawing has objects but no text or images", () => {
    const result = handleDrawingTileLabels(params({
      type: "Drawing",
      objects: [
        { id: "r1", type: "rectangle", x: 0, y: 0, width: 10, height: 10, fill: "#0069ff" },
        { id: "e1", type: "ellipse", x: 0, y: 0, rx: 5, ry: 5 },
      ],
    }));
    expect(result).toBe("This tile contains a drawing.");
    // The point of this handler: none of the geometry/color/id detail survives.
    expect(result).not.toContain("r1");
    expect(result).not.toContain("#0069ff");
    expect(result).not.toContain("rx=");
  });

  it("lists text content and image filenames, and nothing else about those objects", () => {
    const result = handleDrawingTileLabels(params({
      type: "Drawing",
      objects: [
        { id: "t1", type: "text", x: 10, y: 20, width: 50, height: 20, text: "Step 1: mix" },
        { id: "i1", type: "image", x: 0, y: 0, width: 100, height: 80, url: "curriculum/images/beaker.png" },
        { id: "r1", type: "rectangle", x: 0, y: 0, width: 10, height: 10 },
      ],
    }));
    expect(result).toBe(
      'This tile contains a drawing. Text in the drawing: "Step 1: mix". Image in the drawing: beaker.png.'
    );
  });

  it("finds labels nested inside a group", () => {
    const result = handleDrawingTileLabels(params({
      type: "Drawing",
      objects: [
        {
          id: "g1", type: "group", x: 0, y: 0, width: 100, height: 100,
          objects: [
            { id: "t1", type: "text", x: 0, y: 0, width: 50, height: 20, text: "grouped label" },
          ],
        },
      ],
    }));
    expect(result).toBe('This tile contains a drawing. Text in the drawing: "grouped label".');
  });

  it("joins multiple text objects and multiple images, pluralizing the images sentence", () => {
    const result = handleDrawingTileLabels(params({
      type: "Drawing",
      objects: [
        { id: "t1", type: "text", x: 0, y: 0, width: 50, height: 20, text: "first" },
        { id: "t2", type: "text", x: 0, y: 0, width: 50, height: 20, text: "second" },
        { id: "i1", type: "image", x: 0, y: 0, width: 10, height: 10, url: "a.png" },
        { id: "i2", type: "image", x: 0, y: 0, width: 10, height: 10, url: "b.png" },
      ],
    }));
    expect(result).toBe(
      'This tile contains a drawing. Text in the drawing: "first", "second". ' +
      'Images in the drawing: a.png, b.png.'
    );
  });

  it("skips a text object with no text content", () => {
    const result = handleDrawingTileLabels(params({
      type: "Drawing",
      objects: [{ id: "t1", type: "text", x: 0, y: 0, width: 50, height: 20, text: "" }],
    }));
    expect(result).toBe("This tile contains a drawing.");
  });

  it("strips a query string from an image filename, matching handle-image-tile.ts", () => {
    const result = handleDrawingTileLabels(params({
      type: "Drawing",
      objects: [{ id: "i1", type: "image", x: 0, y: 0, width: 10, height: 10, url: "curriculum/x.png?v=2" }],
    }));
    expect(result).toContain("Image in the drawing: x.png.");
  });

  it("refuses to describe a legacy changes-log drawing as empty", () => {
    const result = handleDrawingTileLabels(params({ type: "Drawing", changes: ["some", "change"] }));
    expect(result).toContain("legacy format that this summary cannot read");
  });

  it("does not throw when a drawing is malformed, so one bad tile cannot lose the whole document", () => {
    // A plain object (not an array, not iterable) makes the internal `for...of` throw.
    const result = handleDrawingTileLabels(params({ type: "Drawing", objects: {} }));
    expect(result).toBe("This tile contains a malformed drawing.");
  });
});
