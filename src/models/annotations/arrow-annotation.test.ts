import {
  ArrowAnnotation, ITextSize, kArrowAnnotationTextWidth, kTextHorizontalMargin
} from "./arrow-annotation";

const noDrag = {
  sourceDragOffsetX: 0, sourceDragOffsetY: 0,
  targetDragOffsetX: 0, targetDragOffsetY: 0,
  textDragOffsetX: 0, textDragOffsetY: 0
};

// A sparrow between two cells of a table that sits against the document's left edge, with its label
// dragged hard in one direction. Where it comes to rest is the furthest a teacher can push it.
function labelDraggedBy(dx: number, dy: number, textSize?: ITextSize) {
  const arrow = ArrowAnnotation.create({ textOffset: { dx, dy } });
  const cell = (top: number) => ({ left: 20, top, height: 22, width: 80 });
  return arrow.getPoints(
    0, 800, 0, 600, noDrag,
    cell(100), undefined, cell(122), undefined, undefined, textSize
  );
}

function leftEdgeCenterX(textSize?: ITextSize) {
  const { textCenterX } = labelDraggedBy(-10000, 0, textSize);
  if (textCenterX === undefined) throw new Error("getPoints placed no label");
  return textCenterX;
}

const shortChip = { height: 24, width: 30 };

describe("getPoints label clamping", () => {
  it("lets a narrow label reach the document edge", () => {
    // 15px of margin plus half a 30px chip: the chip stops with its edge 15px inside the document,
    // which is what the margin is for.
    expect(leftEdgeCenterX(shortChip)).toBe(30);
  });

  it("stops a wide label before it runs off the edge", () => {
    expect(leftEdgeCenterX({ height: 24, width: 140 })).toBe(85);
  });

  it("leaves the same gap beside the chip whatever its width", () => {
    const narrowChipLeft = leftEdgeCenterX(shortChip) - 30 / 2;
    const wideChipLeft = leftEdgeCenterX({ height: 24, width: 140 }) - 140 / 2;
    expect(narrowChipLeft).toBe(wideChipLeft);
  });

  it("falls back to the fixed box before the label has been measured", () => {
    expect(leftEdgeCenterX()).toBe(kTextHorizontalMargin);
    expect(kTextHorizontalMargin).toBeLessThan(kArrowAnnotationTextWidth / 2);
  });
});

// The drawn position and the stored offset are computed separately, and only the offset survives
// the drag: it is what the mouse-up handler clamps the new textOffset to. Were the two to drift
// apart, the label would come to rest in one place under the cursor and reappear in another.
describe("getPoints label offset limits", () => {
  it("stores a left-edge drag at the position the label was drawn", () => {
    const { textOriginX, textCenterX, textMinXOffset } = labelDraggedBy(-10000, 0, shortChip);
    expect(textOriginX! + textMinXOffset!).toBe(textCenterX);
    expect(textCenterX).toBe(30);
  });

  it("stores a right-edge drag at the position the label was drawn", () => {
    const { textOriginX, textCenterX, textMaxXOffset } = labelDraggedBy(10000, 0, shortChip);
    expect(textOriginX! + textMaxXOffset!).toBe(textCenterX);
    expect(textCenterX).toBe(770);
  });

  // The only assertion that depends on the chip's height rather than its width.
  it("stores a top-edge drag at the position the label was drawn", () => {
    const { textOriginY, textCenterY, textMinYOffset } = labelDraggedBy(0, -10000, shortChip);
    expect(textOriginY! + textMinYOffset!).toBe(textCenterY);
    expect(textCenterY).toBe(15 + shortChip.height / 2);
  });
});
