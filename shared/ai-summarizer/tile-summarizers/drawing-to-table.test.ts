import { drawingToTable } from "./drawing-to-table";

describe("drawingToTable", () => {
  it("returns the legacy sentence for an empty drawing", () => {
    expect(drawingToTable({ objects: [] })).toBe("This tile contains a drawing.");
    expect(drawingToTable({})).toBe("This tile contains a drawing.");
  });

  it("emits a row per object carrying its id and type", () => {
    const result = drawingToTable({ objects: [
      { id: "a7Kd2", type: "rectangle", x: 40, y: 20, width: 120, height: 80, fill: "#0069ff" }
    ]});
    expect(result).toContain("This tile contains a drawing with 1 object, listed back to front.");
    expect(result).toContain("| a7Kd2 | rectangle | 40, 20 | 120 x 80 |");
    expect(result).toContain("fill=#0069ff");
  });

  it("reports position as the box's north-west corner, not the stored x,y", () => {
    // An ellipse stores its centre. Every row means the same thing, so rows are comparable.
    const result = drawingToTable({ objects: [
      { id: "c3Mn8", type: "ellipse", x: 100, y: 100, rx: 30, ry: 30 }
    ]});
    expect(result).toContain("| c3Mn8 | ellipse | 70, 70 | 60 x 60 |");
    expect(result).toContain("rx=30 ry=30");
  });

  it("keeps document order, which is back to front", () => {
    const result = drawingToTable({ objects: [
      { id: "back", type: "rectangle", x: 0, y: 0, width: 1, height: 1 },
      { id: "front", type: "rectangle", x: 0, y: 0, width: 1, height: 1 }
    ]});
    expect(result.indexOf("| back |")).toBeLessThan(result.indexOf("| front |"));
  });

  it("includes hidden objects and marks them", () => {
    const result = drawingToTable({ objects: [
      { id: "h1", type: "rectangle", x: 0, y: 0, width: 1, height: 1, visible: false }
    ]});
    expect(result).toContain("| h1 |");
    expect(result).toContain("visible=false");
  });

  it("emits a variable chip's variableId", () => {
    const result = drawingToTable({ objects: [
      { id: "Dp47z", type: "variable", x: 110, y: 150, variableId: "v_speed" }
    ]});
    expect(result).toContain("| Dp47z | variable | 110, 150 | 75 x 24 |");
    expect(result).toContain("variableId=v_speed");
  });

  it("emits a text object's content and an image's url", () => {
    const result = drawingToTable({ objects: [
      { id: "t1", type: "text", x: 0, y: 0, width: 50, height: 20, text: "slower here" },
      { id: "i1", type: "image", x: 0, y: 0, width: 10, height: 10, url: "curriculum/x.png" }
    ]});
    expect(result).toContain('text="slower here"');
    expect(result).toContain("url=curriculum/x.png");
  });

  it("counts a line's points rather than listing its deltas", () => {
    const result = drawingToTable({ objects: [
      { id: "l1", type: "line", x: 0, y: 0, deltaPoints: [{ dx: 5, dy: 5 }, { dx: 5, dy: 5 }] }
    ]});
    expect(result).toContain("points=3");
  });

  it("names an unknown object type instead of dropping it", () => {
    const result = drawingToTable({ objects: [
      { id: "u1", type: "sparkline", x: 4, y: 6 }
    ]});
    expect(result).toContain("| u1 | sparkline | 4, 6 | 0 x 0 |");
  });
});
