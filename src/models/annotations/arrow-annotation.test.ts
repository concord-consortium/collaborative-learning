import { ArrowAnnotation, kArrowAnnotationTextWidth, kTextHorizontalMargin } from "./arrow-annotation";

const noDrag = {
  sourceDragOffsetX: 0, sourceDragOffsetY: 0,
  targetDragOffsetX: 0, targetDragOffsetY: 0,
  textDragOffsetX: 0, textDragOffsetY: 0
};

// A sparrow between two cells of a table that sits against the document's left edge, with its label
// dragged hard to the left. Where it comes to rest is what a teacher sees as the leftmost position.
function labelDraggedToLeftEdge(textSize?: { height: number, width: number }) {
  const arrow = ArrowAnnotation.create({ textOffset: { dx: -10000, dy: 0 } });
  const cell = (top: number) => ({ left: 20, top, height: 22, width: 80 });
  const { textCenterX } = arrow.getPoints(
    0, 800, 0, 600, noDrag,
    cell(100), undefined, cell(122), undefined, undefined, textSize
  );
  if (textCenterX === undefined) throw new Error("getPoints placed no label");
  return textCenterX;
}

describe("getPoints label clamping", () => {
  it("lets a narrow label reach the document edge", () => {
    // 15px of margin plus half a 30px chip: the chip stops with its edge 15px inside the document,
    // which is what the margin is for.
    expect(labelDraggedToLeftEdge({ height: 24, width: 30 })).toBe(30);
  });

  it("stops a wide label before it runs off the edge", () => {
    expect(labelDraggedToLeftEdge({ height: 24, width: 140 })).toBe(85);
  });

  it("leaves the same gap beside the chip whatever its width", () => {
    const narrowChipLeft = labelDraggedToLeftEdge({ height: 24, width: 30 }) - 30 / 2;
    const wideChipLeft = labelDraggedToLeftEdge({ height: 24, width: 140 }) - 140 / 2;
    expect(narrowChipLeft).toBe(wideChipLeft);
  });

  it("falls back to the fixed box before the label has been measured", () => {
    expect(labelDraggedToLeftEdge()).toBe(kTextHorizontalMargin);
    expect(kTextHorizontalMargin).toBeLessThan(kArrowAnnotationTextWidth / 2);
  });
});
