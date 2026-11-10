import {
  fitNodeRadius, fitStemHitWidth, kAnnotationNodeDefaultRadius, kMaxStemHitWidth, kSmallAnnotationNodeRadius
} from "./annotation-utilities";

// Sparrows attach to objects of wildly different sizes across nine tile types, and only graph and
// numberline declare a node size of their own. These are the sizes the rest actually report.
describe("fitNodeRadius", () => {
  const maxRadius = kAnnotationNodeDefaultRadius / 2;

  it("shrinks to fit a geometry point, whose bounding box is 14px square", () => {
    // The same radius graph and numberline pass by hand for their points.
    expect(fitNodeRadius({ width: 14, height: 14 })).toBe(kSmallAnnotationNodeRadius);
  });

  it("fits the short side of a table cell, which is the 22px row height", () => {
    expect(fitNodeRadius({ width: 80, height: 22 })).toBe(11);
  });

  it("stops growing once the object is bigger than the node drawn on it", () => {
    expect(fitNodeRadius({ width: 400, height: 300 })).toBe(maxRadius);
  });

  it("never shrinks below a grabbable size, however small the object", () => {
    expect(fitNodeRadius({ width: 2, height: 2 })).toBe(kSmallAnnotationNodeRadius);
  });

  it("uses the full size when there is no bounding box to fit", () => {
    expect(fitNodeRadius()).toBe(maxRadius);
    expect(fitNodeRadius(null)).toBe(maxRadius);
  });
});

describe("fitStemHitWidth", () => {
  it("narrows the clickable band on a sparrow between adjacent table rows", () => {
    // 11px of hit area across a 22px gap is a blob covering both endpoints.
    expect(fitStemHitWidth(22)).toBeCloseTo(7.33);
  });

  it("gives a long sparrow the full band", () => {
    expect(fitStemHitWidth(300)).toBe(kMaxStemHitWidth);
  });

  it("keeps a band wide enough to hit when the endpoints nearly coincide", () => {
    expect(fitStemHitWidth(0)).toBe(3);
  });
});
