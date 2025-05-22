import { Instance, types } from "mobx-state-tree";
import { BoundingBoxSides, Point } from "../model/drawing-basic-types";
import { DrawingObject, DrawingObjectType } from "./drawing-object";

/** Sized objects have a width and height. */
export const SizedObject = DrawingObject.named("SizedObject")
  .props({
    width: types.number,
    height: types.number
  })
  .volatile(self => ({
    dragWidth: undefined as number | undefined,
    dragHeight: undefined as number | undefined
  }))
  .views(self => ({
    get currentDims() {
      const { width, height, dragWidth, dragHeight } = self;
      return {
        width: dragWidth ?? width,
        height: dragHeight ?? height
      };
    }
  }))
  .views(self => ({
    get undraggedUnrotatedBoundingBox() {
      const nw = { x: self.x, y: self.y };
      const se = { x: self.x + self.width, y: self.y + self.height };
      return { nw, se };
    },
    get unrotatedBoundingBox() {
      const { x, y } = self.position;
      const { width, height } = self.currentDims;
      const nw: Point = { x, y };
      const se: Point = { x: x + width, y: y + height };
      return { nw, se };
    }
  }))
  .actions(self => ({
    setUnrotatedDragBounds(sides: BoundingBoxSides) {
      self.dragX = sides.left;
      self.dragY = sides.top;
      self.dragWidth = sides.right - sides.left;
      self.dragHeight = sides.bottom - sides.top;
    },
    resizeObject() {
      const typedSelf = self as any;
      typedSelf.repositionObject();
      typedSelf.width = typedSelf.dragWidth ?? typedSelf.width;
      typedSelf.height = typedSelf.dragHeight ?? typedSelf.height;
      typedSelf.dragWidth = typedSelf.dragHeight = undefined;
    }
  }));

export interface SizedObjectType extends Instance<typeof SizedObject> {}

export function isSizedObject(object: DrawingObjectType): object is SizedObjectType {
  return "width" in object && "height" in object;
}
