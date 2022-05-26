import { Instance, types } from "mobx-state-tree";
import { uniqueId } from "../../../utilities/js-utils";
import { VariableChipObjectSnapshot } from "../../shared-variables/drawing/variable-object";
import { SelectionBox } from "../components/drawing-object";
import { EllipseObjectSnapshot } from "../objects/ellipse";
import { ImageObjectSnapshot } from "../objects/image";
import { LineObjectSnapshot } from "../objects/line";
import { RectangleObjectSnapshot } from "../objects/rectangle";
import { VectorObjectSnapshot } from "../objects/vector";

export interface Point {x: number; y: number; }

export interface BoundingBox {
  nw: Point;
  se: Point;
  start?: Point;
  end?: Point;
}

/**
 * This creates the definition for a type filed in MST.
 * The field is optional so it doesn't have to be specified when creating
 * an instance.
 * 
 * @param typeName the type
 * @returns 
 */
export function typeField(typeName: string) {
  return types.optional(types.literal(typeName), typeName);
}

export const DrawingObject = types.model("DrawingObject", {
  type: types.optional(types.string, () => {throw "Type must be overridden";}),
  id: types.optional(types.identifier, () => uniqueId()),  
  x: types.number,
  y: types.number
})
.views(self => ({
  get boundingBox(): BoundingBox {
    throw "Subclass needs to implement this";
  }
}))
.views(self => ({
  inSelection(selectionBox: SelectionBox) {
    const {nw, se} = self.boundingBox;
    return selectionBox.overlaps(nw, se);
  }
}))
.actions(self => ({
  setPosition(x: number, y: number) {
    self.x = x;
    self.y = y;
  }
}));
export interface DrawingObjectType extends Instance<typeof DrawingObject> {}


export const StrokedObject = DrawingObject.named("StrokedObject")
.props({
  stroke: types.string,
  strokeDashArray: types.string,
  strokeWidth: types.number
})
.actions(self => ({
  setStroke(stroke: string){ self.stroke = stroke; },
  setStrokeDashArray(strokeDashArray: string){ self.strokeDashArray = strokeDashArray; },
  setStrokeWidth(strokeWidth: number){ self.strokeWidth = strokeWidth; }
}));

export const FilledObject = DrawingObject.named("FilledObject")
.props({
  fill: types.string
})
.actions(self => ({
  setFill(fill: string){ self.fill = fill; }
}));

export const DeltaPoint = types.model("DeltaPoint", {
  dx: types.number, dy: types.number
});

export type DrawingObjectDataType = LineObjectSnapshot | VectorObjectSnapshot
  | RectangleObjectSnapshot | EllipseObjectSnapshot | ImageObjectSnapshot | VariableChipObjectSnapshot;
