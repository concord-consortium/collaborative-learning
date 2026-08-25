import {
  absoluteChildBoundingBox, ellipseBoundingBox, kVariableChipDefaultHeight, kVariableChipDefaultWidth,
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

describe("absoluteChildBoundingBox", () => {
  const group = { boundingBox: { nw: { x: 100, y: 200 }, se: { x: 300, y: 300 } } };

  it("scales a child's fractions up into the group's coordinate system", () => {
    expect(absoluteChildBoundingBox({ nw: { x: 0, y: 0 }, se: { x: 0.5, y: 0.5 } }, group))
      .toEqual({ nw: { x: 100, y: 200 }, se: { x: 200, y: 250 } });
  });

  it("maps a child filling the group onto the group's own box", () => {
    expect(absoluteChildBoundingBox({ nw: { x: 0, y: 0 }, se: { x: 1, y: 1 } }, group))
      .toEqual(group.boundingBox);
  });

  it("mirrors a child when the group is flipped horizontally", () => {
    const flipped = { ...group, hFlip: true };
    // The child occupying the left quarter lands on the right quarter.
    expect(absoluteChildBoundingBox({ nw: { x: 0, y: 0 }, se: { x: 0.25, y: 1 } }, flipped))
      .toEqual({ nw: { x: 250, y: 200 }, se: { x: 300, y: 300 } });
  });

  it("mirrors a child when the group is flipped vertically", () => {
    const flipped = { ...group, vFlip: true };
    expect(absoluteChildBoundingBox({ nw: { x: 0, y: 0 }, se: { x: 1, y: 0.25 } }, flipped))
      .toEqual({ nw: { x: 100, y: 275 }, se: { x: 300, y: 300 } });
  });

  const square = { boundingBox: { nw: { x: 0, y: 0 }, se: { x: 100, y: 100 } } };
  const wholeGroup = { nw: { x: 0, y: 0 }, se: { x: 1, y: 1 } };

  it("bounds a child rotated 45 degrees using every corner", () => {
    // Rotation pivots on the group's se corner, so rotating only nw and se leaves se fixed and the
    // two points share an x — a box of zero width. A 100x100 square turned 45 degrees bounds to
    // 100*sqrt(2) on each side.
    const bb = absoluteChildBoundingBox(wholeGroup, { ...square, rotation: 45 });
    expect(bb.se.x - bb.nw.x).toBeCloseTo(100 * Math.SQRT2);
    expect(bb.se.y - bb.nw.y).toBeCloseTo(100 * Math.SQRT2);
  });

  it("still bounds a child rotated a multiple of 90", () => {
    // The product's Rotate control only produces multiples of 90, where two corners happened to be
    // enough. This pins that the fix does not disturb them. Compared approximately because
    // Math.cos(Math.PI / 2) is 6.1e-17 rather than 0, so the corners land a rounding error off.
    const bb = absoluteChildBoundingBox(wholeGroup, { ...square, rotation: 90 });
    expect(bb.nw.x).toBeCloseTo(100);
    expect(bb.nw.y).toBeCloseTo(0);
    expect(bb.se.x).toBeCloseTo(200);
    expect(bb.se.y).toBeCloseTo(100);
    // Unrotated stays exact: cos(0) and sin(0) are 1 and 0 with no rounding.
    expect(absoluteChildBoundingBox(wholeGroup, square)).toEqual(square.boundingBox);
  });
});
