import { boundingBoxForSnapshot } from "./drawing-object-snapshot";

describe("boundingBoxForSnapshot", () => {
  it("reads a sized object's stored width and height", () => {
    expect(boundingBoxForSnapshot({ id: "a", type: "rectangle", x: 0, y: 0, width: 10, height: 5 }))
      .toEqual({ nw: { x: 0, y: 0 }, se: { x: 10, y: 5 } });
  });

  it("treats an ellipse's stored x,y as its center", () => {
    expect(boundingBoxForSnapshot({ id: "b", type: "ellipse", x: 10, y: 10, rx: 5, ry: 5 }))
      .toEqual({ nw: { x: 5, y: 5 }, se: { x: 15, y: 15 } });
  });

  it("orders a vector's box when its delta is negative", () => {
    expect(boundingBoxForSnapshot({ id: "c", type: "vector", x: 0, y: 0, dx: 10, dy: -10 }))
      .toEqual({ nw: { x: 0, y: -10 }, se: { x: 10, y: 0 } });
  });

  it("walks a line's delta points", () => {
    expect(boundingBoxForSnapshot({
      id: "d", type: "line", x: 0, y: 0, deltaPoints: [{ dx: 5, dy: 5 }, { dx: 5, dy: -15 }]
    })).toEqual({ nw: { x: 0, y: -10 }, se: { x: 10, y: 5 } });
  });

  it("uses the shared defaults for a variable chip, whose size is never persisted", () => {
    expect(boundingBoxForSnapshot({ id: "e", type: "variable", x: 0, y: 0, variableId: "v1" }))
      .toEqual({ nw: { x: 0, y: 0 }, se: { x: 75, y: 24 } });
  });

  it("degrades to a zero-size box on an unknown type rather than throwing", () => {
    // Drawing object types are registered by plugins. A type this module has never heard of must
    // not be able to break the whole document summary.
    expect(boundingBoxForSnapshot({ id: "f", type: "sparkline", x: 7, y: 9 }))
      .toEqual({ nw: { x: 7, y: 9 }, se: { x: 7, y: 9 } });
  });

  it("tolerates a known type with its geometry missing", () => {
    expect(boundingBoxForSnapshot({ id: "g", type: "rectangle", x: 3, y: 4 }))
      .toEqual({ nw: { x: 3, y: 4 }, se: { x: 3, y: 4 } });
  });
});
