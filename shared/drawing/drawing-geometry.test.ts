import {
  ellipseBoundingBox, kVariableChipDefaultHeight, kVariableChipDefaultWidth,
  lineBoundingBox, sizedBoundingBox, vectorBoundingBox
} from "./drawing-geometry";

describe("per-type bounding boxes", () => {
  it("treats a sized object's x,y as its north-west corner", () => {
    expect(sizedBoundingBox({ x: 10, y: 20, width: 30, height: 40 }))
      .toEqual({ nw: { x: 10, y: 20 }, se: { x: 40, y: 60 } });
  });

  it("treats an ellipse's x,y as its centre", () => {
    expect(ellipseBoundingBox({ x: 100, y: 100, rx: 30, ry: 10 }))
      .toEqual({ nw: { x: 70, y: 90 }, se: { x: 130, y: 110 } });
  });

  it("orders a vector's box regardless of delta sign", () => {
    expect(vectorBoundingBox({ x: 50, y: 50, dx: -20, dy: 30 }))
      .toEqual({ nw: { x: 30, y: 50 }, se: { x: 50, y: 80 } });
  });

  it("sums a line's delta points", () => {
    const line = { x: 0, y: 0, deltaPoints: [{ dx: 10, dy: 10 }, { dx: -30, dy: 5 }] };
    expect(lineBoundingBox(line)).toEqual({ nw: { x: -20, y: 0 }, se: { x: 10, y: 15 } });
  });

  it("applies a scale to a line's delta points", () => {
    const line = { x: 0, y: 0, deltaPoints: [{ dx: 10, dy: 10 }] };
    expect(lineBoundingBox(line, { x: 2, y: 3 }))
      .toEqual({ nw: { x: 0, y: 0 }, se: { x: 20, y: 30 } });
  });

  it("gives a line with no deltas a zero-size box at its start point", () => {
    expect(lineBoundingBox({ x: 7, y: 9, deltaPoints: [] }))
      .toEqual({ nw: { x: 7, y: 9 }, se: { x: 7, y: 9 } });
  });

  it("sizes a variable chip from the shared defaults", () => {
    expect(sizedBoundingBox({
      x: 5, y: 5, width: kVariableChipDefaultWidth, height: kVariableChipDefaultHeight
    })).toEqual({ nw: { x: 5, y: 5 }, se: { x: 80, y: 29 } });
  });
});
