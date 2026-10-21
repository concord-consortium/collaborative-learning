import { calculateFitTransform, kMaxFitScale } from "./fit-transform";
import { MIN_ZOOM } from "./rete-manager";

// A node is drawn at its default size at scale 1, so Fit all must never choose more than that.
describe("calculateFitTransform", () => {
  const bounds = (width: number, height: number) => ({ minX: 0, minY: 0, maxX: width, maxY: height });

  it("does not enlarge content that already fits", () => {
    const { scale } = calculateFitTransform(bounds(100, 100), 800, 600);
    expect(scale).toBe(kMaxFitScale);
  });

  it("scales down content too big for the container", () => {
    const { scale } = calculateFitTransform(bounds(2000, 2000), 800, 600);
    expect(scale).toBeLessThan(1);
    expect(scale).toBeGreaterThanOrEqual(MIN_ZOOM);
  });

  it("centers what it fits", () => {
    const { scale, offsetX, offsetY } = calculateFitTransform(bounds(100, 100), 800, 600);
    expect(offsetX).toBeCloseTo((800 - 100 * scale) / 2);
    expect(offsetY).toBeCloseTo((600 - 100 * scale) / 2);
  });

  it("leaves an empty program alone", () => {
    expect(calculateFitTransform(bounds(0, 0), 800, 600)).toEqual({ scale: 1, offsetX: 0, offsetY: 0 });
  });
});
