import { calculateFitContent, maxZoom, minZoom } from "../model/drawing-utils";

describe("calculateFitContent", () => {
  it("should fit content within canvas", () => {
    const result = calculateFitContent({
      canvasSize: { x: 100, y: 100 },
      contentBoundingBox: { nw: { x: 0, y: 0 }, se: { x: 50, y: 50 } }
    });

    expect(result.zoom).toBe(1.8); // (100-10)/50 [10 is for padding]
    expect(result.offsetX).toBe(5); // (100/2 - (0+50/2)*1.8)
    expect(result.offsetY).toBe(5); // (100/2 - (0+50/2)*1.8)
  });

  it("should respect max zoom constraints", () => {
    const result = calculateFitContent({
      canvasSize: { x: 500, y: 500 },
      contentBoundingBox: { nw: { x: 0, y: 0 }, se: { x: 10, y: 10 } }
    });

    expect(result.zoom).toBe(maxZoom);
  });

  it("should respect min zoom constraints", () => {
    const result = calculateFitContent({
      canvasSize: { x: 10, y: 10 },
      contentBoundingBox: { nw: { x: 0, y: 0 }, se: { x: 200, y: 200 } }
    });

    expect(result.zoom).toBe(minZoom);
  });

  it("should handle empty content", () => {
    const result = calculateFitContent({
      canvasSize: { x: 100, y: 100 },
      contentBoundingBox: { nw: { x: 0, y: 0 }, se: { x: 0, y: 0 } }
    });

    // Should handle gracefully without division by zero
    expect(result.zoom).toBe(maxZoom);
    expect(result.offsetX).toBe(50);
    expect(result.offsetY).toBe(50);
  });

  it("should center content when zoom is constrained", () => {
    const result = calculateFitContent({
      canvasSize: { x: 200, y: 200 },
      contentBoundingBox: { nw: { x: 0, y: 0 }, se: { x: 50, y: 50 } }
    });

    expect(result.zoom).toBe(maxZoom);
    expect(result.offsetX).toBe(50);
    expect(result.offsetY).toBe(50);
  });
});
