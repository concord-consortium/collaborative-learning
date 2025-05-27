import React from "react";
import { getMembers, Instance, SnapshotIn, types } from "mobx-state-tree";
import { uniqueId } from "../../../utilities/js-utils";
import { SelectionBox } from "../components/selection-box";
import { BoundingBox, BoundingBoxSides, Point, ToolbarSettings }
   from "../model/drawing-basic-types";
import { StampModelType } from "../model/stamp";
import { boundingBoxForPoints, normalizeRotation, rotateBoundingBox,
  rotatePoint, rotationPoint } from "../model/drawing-utils";

import ErrorIcon from "../../../assets/icons/error.svg";

export type ToolbarModalButton = "select" | "line" | "vector" | "rectangle" | "ellipse" | "text" | "stamp" | "variable";

export type Transform = {
  corner: Point,
  position: Point,
  center: Point,
  scale: Point,
  rotation: number
};

export const ObjectTypeIconViewBox = "0 0 36 34";

// This interface is a subset of what the DrawingContentModel provides.
// It is used to break the circular reference between DrawingContentModel
// and the toolbar components.
export interface IToolbarManager {
  objectMap: ObjectMap;
  setSelectedButton(button: ToolbarModalButton): void;
  selectedButton: string;
  toolbarSettings: ToolbarSettings;
  selection: string[];
  hasSelectedObjects: boolean;
  addAndSelectObject(drawingObject: DrawingObjectSnapshotForAdd): DrawingObjectType;
  deleteObjects(ids: string[]): void;
  duplicateObjects(ids: string[]): void;
  createGroup(objectIds: string[]): void;
  ungroupGroups(ids: string[]): void;
  stamps: StampModelType[];
  currentStamp: StampModelType | null;
  stroke: string;
}

/**
 * This creates the definition for a type field in MST.
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
  y: types.number,
  hFlip: types.optional(types.boolean, false),
  vFlip: types.optional(types.boolean, false),
  rotation: types.optional(types.number, 0),
  visible: true
})
.volatile(self => ({
  dragX: undefined as number | undefined,
  dragY: undefined as number | undefined,
  animating: false
}))
.views(self => ({
  get position() {
    // Uses the volatile dragX and dragY while the object is being dragged
    return {
      x: self.dragX ?? self.x,
      y: self.dragY ?? self.y
    };
  },
  /** The bounding box of the object without considering rotation. */
  get unrotatedBoundingBox(): BoundingBox {
    // SC: I tried an approach of tracking the SVG elements that were rendered,
    // and using a generic SVG getBBox() here, but it had performance issues.
    // The bounding box is used to draw a highlight around the element when the
    // element is moving its x and y are changing and then the x and y of the
    // getBBox get updated after it moves and then the highlight updates after
    // this move using getBBox causes a weird lag in how the highlight tracks
    // the box. Additionally if the implementation doesn't access the x or y of
    // self then MobX observation is not triggered so moving the element doesn't
    // cause the selection highlight to update.
    throw "Subclass needs to implement unrotatedBoundingBox";
  },
  /** The bounding box of the object without considering rotation or drag. */
  get undraggedUnrotatedBoundingBox(): BoundingBox {
    throw "Subclass needs to implement undraggedUnrotatedBoundingBox";
  },
  get label(): string {
    // Object types should implement this to return a user-friendly short label,
    // used in the show/sort panel.
    return "Unknown object";
  },
  get icon(): JSX.Element {
    // Should be overridden by all subclasses
    return (<ErrorIcon viewBox={ObjectTypeIconViewBox}/>);
  },
  get isRotatedToHorizontal() {
    return [90, 270].includes(normalizeRotation(self.rotation));
  }
}))
.actions(self => ({
  setUnrotatedDragBounds(bounds: BoundingBoxSides) {
    console.error("setUnrotatedDragBounds is unimplemented for type", self.type);
  },
  resizeObject() {
    console.error("resizeObject is unimplemented for type", self.type);
  }
}))
.views(self => ({
  get boundingBox(): BoundingBox {
    return rotateBoundingBox(self.unrotatedBoundingBox, self.rotation);
  },
  get undraggedBoundingBox(): BoundingBox {
    return rotateBoundingBox(self.undraggedUnrotatedBoundingBox, self.rotation);
  },
  get supportsResize() {
    return true;
  },
  /**
   * Returns the translation and scaling transform that should be applied
   * to the Transformable group element to account for the objects's flip state.
   */
  get transform(): Transform {
    const {unrotatedBoundingBox, hFlip, vFlip, position, rotation} = self;
    const transform = {
      corner: {x: unrotatedBoundingBox.se.x, y: unrotatedBoundingBox.se.y},
      position: {x: position.x, y: position.y},
      center: {x: 0, y: 0},
      scale: {x: hFlip ? -1 : 1, y: vFlip ? -1 : 1},
      rotation };
    // The x,y "position" of an object is the zero point that we flip over.
    // But depending on the object type, this position can be anywhere in its bounding box.
    // So for the bounding box to stay the same, we need to move the object to account
    // for the position-to-center distance.

    // Center of the object relative to its "position" point.
    const center: Point = {
      x: (unrotatedBoundingBox.nw.x + unrotatedBoundingBox.se.x) / 2 - position.x,
      y: (unrotatedBoundingBox.nw.y + unrotatedBoundingBox.se.y) / 2 - position.y
    };
    if (hFlip) {
      transform.center.x = center.x*2;
    }
    if (vFlip) {
      transform.center.y = center.y*2;
    }
    return transform;
  }
}))
.views(self => ({
  inSelection(selectionBox: SelectionBox) {
    const {nw, se} = self.boundingBox;
    return selectionBox.overlaps(nw, se);
  },
}))
.actions(self => ({
  setVisible(visible: boolean) {
    self.visible = visible;
  },
  setAnimating(animating: boolean) {
    self.animating = animating;
  },
  setPosition(x: number, y: number) {
    self.x = x;
    self.y = y;
  },
  setDragPosition(x: number, y: number) {
    self.dragX = x;
    self.dragY = y;
  },
  repositionObject() {
    self.x = self.dragX ?? self.x;
    self.y = self.dragY ?? self.y;
    self.dragX = self.dragY = undefined;
  },
  setDragBoundsAbsolute(sides: BoundingBoxSides) {
    const nw = { x: sides.left,  y: sides.top };
    const ne = { x: sides.right, y: sides.top };
    const sw = { x: sides.left,  y: sides.bottom };
    const se = { x: sides.right, y: sides.bottom };
    // Center of rotation is the original se corner, but where that is depends on the rotation.
    const center = rotationPoint({ nw, se }, self.rotation);
    // Reverse-rotate each corner around the center of rotation
    // to get back to where it would be before rotation.
    const rotatedNW = rotatePoint(nw, center, -self.rotation);
    const rotatedNE = rotatePoint(ne, center, -self.rotation);
    const rotatedSE = rotatePoint(se, center, -self.rotation);
    const rotatedSW = rotatePoint(sw, center, -self.rotation);
    const trueBoundingBox = boundingBoxForPoints([rotatedNW, rotatedNE, rotatedSE, rotatedSW]);
    self.setUnrotatedDragBounds(trueBoundingBox);
  },
}))
.actions(self => ({
  /**
   * Temporarily adjust the edges of the object's bounding box by the given deltas.
   * This will change the size and origin position of the object, with changes stored as volatile fields.
   *
   * @param deltas
   */
    setDragBounds(deltas: BoundingBoxSides) {
      const currentBoundingBox = self.undraggedBoundingBox;
      const newSides = {
        top: currentBoundingBox.nw.y + deltas.top,
        bottom: currentBoundingBox.se.y + deltas.bottom,
        left: currentBoundingBox.nw.x + deltas.left,
        right: currentBoundingBox.se.x + deltas.right
      };
      self.setDragBoundsAbsolute(newSides);
  }
}));
export interface DrawingObjectType extends Instance<typeof DrawingObject> {}
export interface DrawingObjectSnapshot extends SnapshotIn<typeof DrawingObject> {}
// Snapshots being passed to addNewDrawingObject need to have a type so the MST Union can figure out
// what they are.  They do not need an id because object will add that when it is created
export interface DrawingObjectSnapshotForAdd extends SnapshotIn<typeof DrawingObject> {type: string}

export interface ObjectMap {
  [key: string]: DrawingObjectType|null;
}

/** Stroked objects have a stroke color, stroke width, and stroke dash array. */
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
export interface StrokedObjectType extends Instance<typeof StrokedObject> {}

// There might be a better way to do this. It is currently just looking for a
// setStroke action. In a real type system
// like Java it'd be possible to identify if the object is an instanceof
// StrokedObject. There is an un-resolved MST issue about exposing the type
// hierarchy: https://github.com/mobxjs/mobx-state-tree/issues/1114
// Alternatively, I tried to add static volatile props like isStrokedObject to
// the drawing object itself. But there isn't a good way to start that property
// out as false, set it to true in the stroked object, and then pickup up this
// default in each of the instances of stroked object.
export function isStrokedObject(object: DrawingObjectType): object is StrokedObjectType {
  return getMembers(object).actions.includes("setStroke");
}

/** Filled objects have a fill color. */
export const FilledObject = DrawingObject.named("FilledObject")
.props({
  fill: types.string
})
.actions(self => ({
  setFill(fill: string){ self.fill = fill; }
}));
export interface FilledObjectType extends Instance<typeof FilledObject> {}

export function isFilledObject(object: DrawingObjectType): object is FilledObjectType {
  return getMembers(object).actions.includes("setFill");
}

/** "Editable" objects go into an "editing" state if you click them while they are already selected.
 * For example, text labels go into a state where you can edit the text.
 */
export const EditableObject = DrawingObject.named("EditableObject")
.volatile(self => ({
  isEditing: false
}))
.actions(self=> ({
  setEditing(editing: boolean){ self.isEditing = editing; }
}));
export interface EditableObjectType extends Instance<typeof EditableObject> {}
export function isEditableObject(object: DrawingObjectType): object is EditableObjectType {
  return getMembers(object).actions.includes("setEditing");
}

export const DeltaPoint = types.model("DeltaPoint", {
  dx: types.number, dy: types.number
});

export type HandleObjectHover =
  (e: MouseEvent|React.MouseEvent<any>, obj: DrawingObjectType, hovering: boolean) => void;

export type HandleObjectDrag =
(e: React.PointerEvent<any>, obj: DrawingObjectType) => void;

export interface IDrawingComponentProps {
  model: DrawingObjectType;
  readOnly?: boolean,
  handleHover?: HandleObjectHover;
  handleDrag?: HandleObjectDrag;
}

export type DrawingComponentType = React.ComponentType<IDrawingComponentProps>;

export interface IDrawingLayer {
  selectTile: (append: boolean) => void;
  getWorkspacePoint: (e:PointerEvent|React.PointerEvent) => Point|null;
  setCurrentDrawingObject: (object: DrawingObjectType|null) => void;
  addNewDrawingObject:
    (object: DrawingObjectSnapshotForAdd,
      options?: { addAtBack?: boolean, keepToolActive?: boolean }) => DrawingObjectType;
  getCurrentStamp: () => StampModelType|null;
  startSelectionBox: (start: Point) => void;
  updateSelectionBox: (p: Point) => void;
  endSelectionBox: (addToSelectedObjects: boolean) => void;
  setSelectedObjects: (selectedObjects: DrawingObjectType[]) => void;
  getSelectedObjects: () => DrawingObjectType[];
  toolbarSettings: () => ToolbarSettings;
}

export abstract class DrawingTool {
  public drawingLayer: IDrawingLayer;

  constructor(drawingLayer: IDrawingLayer) {
    this.drawingLayer = drawingLayer;
  }

  public handlePointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    // handled in subclass
  }

  public handleObjectClick(e: PointerEvent|React.PointerEvent<any>, obj: DrawingObjectType): void   {
    // handled in subclass
  }
}

export const computeStrokeDashArray = (type?: string, strokeWidth?: string|number) => {
  const dotted = isFinite(Number(strokeWidth)) ? Number(strokeWidth) : 0;
  const dashed = dotted * 3;
  switch (type) {
    case "dotted":
      return `${dotted},${dotted}`;
    case "dashed":
      return `${dashed},${dashed}`;
    default:
      return "";
  }
};
