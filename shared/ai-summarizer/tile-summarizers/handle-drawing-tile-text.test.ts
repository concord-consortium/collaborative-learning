import { handleDrawingTileText } from "./handle-drawing-tile-text";
import { TileHandlerParams } from "../ai-summarizer-types";

/** The handler only reads `tile.model.content`, so a snapshot is all a test needs to supply. */
const describeDrawing = (content: unknown) =>
  handleDrawingTileText({ tile: { model: { content } } } as unknown as TileHandlerParams);

describe("handle-drawing-tile-text", () => {
  it("ignores tiles that are not drawings", () => {
    expect(describeDrawing({ type: "Text", text: "hello" })).toBeUndefined();
  });

  it("counts the objects by type and lists each one's geometry", () => {
    const summary = describeDrawing({
      type: "Drawing",
      objects: [
        { type: "rectangle", x: 10, y: 10, width: 120, height: 60 },
        { type: "rectangle", x: 20, y: 90, width: 40, height: 40 },
        { type: "ellipse", x: 160, y: 40, rx: 30, ry: 20 }
      ]
    });
    expect(summary).toContain("3 objects (2 rectangles, 1 ellipse)");
    expect(summary).toContain("- rectangle at (10, 10), 120×60");
    expect(summary).toContain("- rectangle at (20, 90), 40×40");
    // An ellipse carries radii rather than a bounding box, and saying "30×20" would be wrong.
    expect(summary).toContain("- ellipse at (160, 40), radii 30×20");
  });

  it("carries a text object's own text, quoted", () => {
    const summary = describeDrawing({
      type: "Drawing",
      objects: [{ type: "text", x: 5, y: 5, width: 100, height: 20, text: "Latch: v2" }]
    });
    expect(summary).toContain(`- text at (5, 5), 100×20: "Latch: v2"`);
  });

  it("describes a vector by its displacement and a line by its point count", () => {
    const summary = describeDrawing({
      type: "Drawing",
      objects: [
        { type: "vector", x: 0, y: 0, dx: 50, dy: -20 },
        { type: "line", x: 1, y: 2, deltaPoints: [{ dx: 3, dy: 4 }, { dx: 5, dy: 6 }] }
      ]
    });
    expect(summary).toContain("- vector at (0, 0), 50×-20 from its start");
    // Three points: the object's own origin, then one per delta.
    expect(summary).toContain("- line at (1, 2), 3 points");
  });

  it("says how many objects a group holds", () => {
    const summary = describeDrawing({
      type: "Drawing",
      objects: [{ type: "group", x: 0, y: 0, objects: [{ type: "rectangle" }, { type: "ellipse" }] }]
    });
    expect(summary).toContain("- group at (0, 0) containing 2 objects");
  });

  it("says a drawing is empty rather than describing nothing", () => {
    expect(describeDrawing({ type: "Drawing", objects: [] }))
      .toBe("This tile contains a drawing, which is empty.");
    expect(describeDrawing({ type: "Drawing" }))
      .toBe("This tile contains a drawing, which is empty.");
  });

  it("produces the same text every time for the same drawing", () => {
    // Ordering follows the objects array, so nothing about the description is incidental.
    const content = {
      type: "Drawing",
      objects: [
        { type: "ellipse", x: 1, y: 1, rx: 2, ry: 3 },
        { type: "rectangle", x: 4, y: 5, width: 6, height: 7 }
      ]
    };
    expect(describeDrawing(content)).toBe(describeDrawing(JSON.parse(JSON.stringify(content))));
    // First-appearance order, so the counts read the same way too.
    expect(describeDrawing(content)).toContain("(1 ellipse, 1 rectangle)");
  });

  it("survives a snapshot with missing or unexpected fields", () => {
    // The content is stored data, and a drawing authored by an older build may not carry everything.
    const summary = describeDrawing({
      type: "Drawing",
      objects: [{}, { type: "rectangle" }, { type: "text", x: "no", y: null, text: "" }]
    });
    expect(summary).toContain("3 objects");
    expect(summary).toContain("- object");
    expect(summary).toContain("- rectangle");
    // No position it can trust, and no text worth quoting.
    expect(summary).not.toContain('""');
  });

  it("rounds sub-pixel positions, which are drag noise", () => {
    const summary = describeDrawing({
      type: "Drawing",
      objects: [{ type: "rectangle", x: 10.4, y: 10.6, width: 120.2, height: 59.7 }]
    });
    expect(summary).toContain("- rectangle at (10, 11), 120×60");
  });

  it("interprets nothing", () => {
    // The model is the thing being measured on its ability to read a picture. A serializer that
    // volunteered "a robot arm" would be answering the question instead of asking it.
    const summary = describeDrawing({
      type: "Drawing",
      objects: [{ type: "rectangle", x: 0, y: 0, width: 10, height: 10 }]
    })!;
    for (const word of ["looks", "appears", "seems", "probably", "shows a"]) {
      expect(summary).not.toContain(word);
    }
  });
});
