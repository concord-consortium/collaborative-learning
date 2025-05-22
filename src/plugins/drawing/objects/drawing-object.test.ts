import { SizedObject } from "./sized-object";
import type { BoundingBox } from "../model/drawing-basic-types";

function expectBoundingBoxCloseTo(actual: BoundingBox, expected: BoundingBox) {
  expect(actual.nw.x).toBeCloseTo(expected.nw.x, 6);
  expect(actual.nw.y).toBeCloseTo(expected.nw.y, 6);
  expect(actual.se.x).toBeCloseTo(expected.se.x, 6);
  expect(actual.se.y).toBeCloseTo(expected.se.y, 6);
}

describe("SizedObject setDragBounds with rotation", () => {
  const origX = 100, origY = 100, origWidth = 50, origHeight = 40;
  function createSizedObject({ x = origX, y = origY, width = origWidth, height = origHeight,
                               rotation = 0, type = "test" } = {}) {
    return SizedObject.create({ x, y, width, height, rotation, type });
  }

  it("resizes top edge with no rotation", () => {
    const obj = createSizedObject();
    expectBoundingBoxCloseTo(obj.boundingBox, {
      nw: { x: origX, y: origY },
      se: { x: origX + origWidth, y: origY + origHeight }
    });
    obj.setDragBounds({ top: -10, bottom: 0, left: 0, right: 0 });
    expectBoundingBoxCloseTo(obj.boundingBox, {
      nw: { x: origX, y: origY - 10 }, // y moved up by 10
      se: { x: origX + origWidth, y: origY + origHeight } // unchanged
    });
    expect(obj.dragX).toBeCloseTo(origX, 6);
    expect(obj.dragY).toBeCloseTo(origY - 10, 6);
    expect(obj.dragWidth).toBeCloseTo(origWidth, 6);
    expect(obj.dragHeight).toBeCloseTo(origHeight + 10, 6);
  });

  it("resizes top edge with 90 degree rotation", () => {
    const obj = createSizedObject({ rotation: 90 });
    // Bounding box adjusted to account for rotation around the se corner
    expectBoundingBoxCloseTo(obj.boundingBox, {
      nw: { x: origX + origWidth, y: origY + origHeight - origWidth },
      se: { x: origX + origWidth + origHeight, y: origY + origHeight }
    });
    obj.setDragBounds({ top: -10, bottom: 0, left: 0, right: 0 });
    expectBoundingBoxCloseTo(obj.boundingBox, {
      nw: { x: 150, y: 80 }, // y moved up by 10
      se: { x: 190, y: 140 } // unchanged
    });
    // With 90deg rotation, it's the object X and width rather than Y/height that get changed.
    expect(obj.dragX ?? obj.x).toBeCloseTo(origX - 10, 6); // x moved left by 10.
    // It doesn't actually move left; with the rotation this causes its rendered position to move up.
    expect(obj.dragY ?? obj.y).toBeCloseTo(origY, 6); // unchanged
    expect(obj.dragWidth ?? obj.width).toBeCloseTo(origWidth + 10, 6); // width increased by 10
    expect(obj.dragHeight ?? obj.height).toBeCloseTo(origHeight, 6); // height unchanged
  });

  it("resizes top edge with 180 degree rotation", () => {
    const obj = createSizedObject({ rotation: 180 });
    expectBoundingBoxCloseTo(obj.boundingBox, {
      nw: { x: origX + origWidth, y: origY + origHeight },
      se: { x: origX + 2*origWidth, y: origY + 2*origHeight }
    });
    obj.setDragBounds({ top: -10, bottom: 0, left: 0, right: 0 });
    expectBoundingBoxCloseTo(obj.boundingBox, {
      nw: { x: origX + origWidth, y: origY + origHeight - 10 }, // y moved up by 10
      se: { x: origX + 2*origWidth, y: origY + 2*origHeight } // unchanged
    });
    // With 180deg rotation, dragging 'top' increases height
    expect(obj.dragX ?? obj.x).toBeCloseTo(origX, 6); // x unchanged
    expect(obj.dragY ?? obj.y).toBeCloseTo(origY - 20, 6); // y moved up by 20
    expect(Math.round(obj.dragWidth ?? obj.width)).toBeCloseTo(origWidth, 6); // width unchanged
    expect(Math.round(obj.dragHeight ?? obj.height)).toBeCloseTo(origHeight + 10, 6); // height increased by 10
  });

  it("resizes top edge with 270 degree rotation", () => {
    const obj = createSizedObject({ rotation: 270 });
    expectBoundingBoxCloseTo(obj.boundingBox, {
      nw: { x: 110, y: 140 },
      se: { x: 150, y: 190 }
    });
    obj.setDragBounds({ top: -10, bottom: 0, left: 0, right: 0 });
    expectBoundingBoxCloseTo(obj.boundingBox, {
      nw: { x: 110, y: 130 }, // y moved up by 10
      se: { x: 150, y: 190 } // unchanged
    });
    // With 270deg rotation, dragging 'top' increases width
    expect(obj.dragX ?? obj.x).toBeCloseTo(origX - 10, 6); // x moved left by 10
    expect(obj.dragY ?? obj.y).toBeCloseTo(origY - 10, 6); // y moved up by 10
    expect(obj.dragWidth ?? obj.width).toBeCloseTo(origWidth + 10, 6); // width increased by 10
    expect(obj.dragHeight ?? obj.height).toBeCloseTo(origHeight, 6); // height unchanged
  });

  it("Adding multiples of 360 does not change the end result", () => {
    const obj = createSizedObject({ rotation: 360 + 90 }); // equivalent to 90 degrees
    // Identical to the 90 degree case above.
    expectBoundingBoxCloseTo(obj.boundingBox, {
      nw: { x: origX + origWidth, y: origY + origHeight - origWidth },
      se: { x: origX + origWidth + origHeight, y: origY + origHeight }
    });
    obj.setDragBounds({ top: -10, bottom: 0, left: 0, right: 0 });
    expectBoundingBoxCloseTo(obj.boundingBox, {
      nw: { x: 150, y: 80 }, // y moved up by 10
      se: { x: 190, y: 140 } // unchanged
    });
    // With 90deg rotation, it's the object X and width rather than Y/height that get changed.
    expect(obj.dragX ?? obj.x).toBeCloseTo(origX - 10, 6); // x moved left by 10.
    // It doesn't actually move left; with the rotation this causes its rendered position to move up.
    expect(obj.dragY ?? obj.y).toBeCloseTo(origY, 6); // unchanged
    expect(obj.dragWidth ?? obj.width).toBeCloseTo(origWidth + 10, 6); // width increased by 10
    expect(obj.dragHeight ?? obj.height).toBeCloseTo(origHeight, 6); // height unchanged
  });
});
