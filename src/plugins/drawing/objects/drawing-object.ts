import { getMembers, Instance, SnapshotIn, types } from "mobx-state-tree";
import { uniqueId } from "../../../utilities/js-utils";
import { SelectionBox } from "../components/selection-box";
import { BoundingBox, BoundingBoxDelta, DefaultToolbarSettings, Point, ToolbarSettings }
   from "../model/drawing-basic-types";
import { StampModelType } from "../model/stamp";

export type ToolbarModalButton = "select" | "line" | "vector" | "rectangle" | "ellipse" | "stamp" | "variable";

// This interface is a subset of what the DrawingContentModel provides.
// It is used to break the circular reference between DrawingContentModel
// and the toolbar components.
export interface IToolbarManager {
  objectMap: ObjectMap;
  setSelectedButton(button: ToolbarModalButton): void;
  selectedButton: string;
  toolbarSettings: ToolbarSettings;
  hasSelectedObjects: boolean;
  selectedIds: string [];
  deleteObjects(ids: string[]): void;
  duplicateObjects(ids: string[]): void;
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
  y: types.number
})
.volatile(self => ({
  dragX: undefined as number | undefined,
  dragY: undefined as number | undefined
}))
.views(self => ({
  get position() {
    // Uses the volatile dragX and dragY while the object is being dragged
    return {
      x: self.dragX ?? self.x,
      y: self.dragY ?? self.y
    };
  },
  get boundingBox(): BoundingBox {
    // SC: I tried an approach of tracking the SVG elements that were rendered,
    // and using a generic SVG getBBox() here, but it had performance issues.
    // The bounding box is used to draw a highlight around the element when the
    // element is moving its x and y are changing and then the x and y of the
    // getBBox get updated after it moves and then the highlight updates after
    // this move using getBBox causes a weird lag in how the highlight tracks
    // the box. Additionally if the implementation doesn't access the x or y of
    // self then MobX observation is not triggered so moving the element doesn't
    // cause the selection highlight to update.
    throw "Subclass needs to implement this";
  }
}))
.views(self => ({
  inSelection(selectionBox: SelectionBox) {
    const {nw, se} = self.boundingBox;
    return selectionBox.overlaps(nw, se);
  },
  get supportsResize() {
    return true;
  }
}))
.actions(self => ({
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
  setDragBounds(deltas: BoundingBoxDelta) {
    // Temporarily adjust the edges of the object's bounding box by the given deltas.
    // This will change the size and origin position of the object, with changes stored as volatile fields.

    // Implementated in subclasses since this will affect object types differently.
    console.error("setDragBounds is unimplemented for this type");
  },
  resizeObject() {
    // Move any volatile resizing into the persisted object model.
    console.error("resizeObject is unimplemented for this type");
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
// stroked property defined in the object's properties. In a real type system
// like Java it'd be possible to identify if the object is an instanceof
// StrokedObject. There is an un-resolved MST issue about exposing the type
// hierarchy: https://github.com/mobxjs/mobx-state-tree/issues/1114
// Alternatively, I tried to add static volatile props like isStrokedObject to
// the drawing object itself. But there isn't a good way to start that property
// out as false, set it to true in the stroked object, and then pickup up this
// default in each of the instances of stroked object.
export function isStrokedObject(object: DrawingObjectType): object is StrokedObjectType {
  const typeMembers = getMembers(object);
  return !!(typeMembers.properties?.stroke);
}

export const FilledObject = DrawingObject.named("FilledObject")
.props({
  fill: types.string
})
.actions(self => ({
  setFill(fill: string){ self.fill = fill; }
}));
export interface FilledObjectType extends Instance<typeof FilledObject> {}

export function isFilledObject(object: DrawingObjectType): object is FilledObjectType {
  const typeMembers = getMembers(object);
  return !!(typeMembers.properties?.fill);
}

export const DeltaPoint = types.model("DeltaPoint", {
  dx: types.number, dy: types.number
});

export type HandleObjectHover =
  (e: MouseEvent|React.MouseEvent<any>, obj: DrawingObjectType, hovering: boolean) => void;

export type HandleObjectDrag =
(e: React.MouseEvent<any>, obj: DrawingObjectType) => void;

export interface IDrawingComponentProps {
  model: DrawingObjectType;
  handleHover?: HandleObjectHover;
  handleDrag?: HandleObjectDrag;
}



// TODO: the support for palettes is hard coded to specific tools
export interface IPaletteState {
  showStamps: boolean;
  showStroke: boolean;
  showFill: boolean;
  showVectors: boolean;
}
export type PaletteKey = keyof IPaletteState;
export const kClosedPalettesState = { showStamps: false, showStroke: false, showFill: false, showVectors: false };

export interface IToolbarButtonProps {
  toolbarManager: IToolbarManager;
  // TODO: the support for palettes is hard coded to specific tools
  togglePaletteState: (palette: PaletteKey, show?: boolean) => void;
  clearPaletteState: () => void;
}

export type DrawingComponentType = React.ComponentType<IDrawingComponentProps>;

export interface IDrawingLayer {
  getWorkspacePoint: (e:MouseEvent|React.MouseEvent) => Point|null;
  setCurrentDrawingObject: (object: DrawingObjectType|null) => void;
  addNewDrawingObject: (object: DrawingObjectSnapshotForAdd) => DrawingObjectType;
  getCurrentStamp: () => StampModelType|null;
  startSelectionBox: (start: Point) => void;
  updateSelectionBox: (p: Point) => void;
  endSelectionBox: (addToSelectedObjects: boolean) => void;
  setSelectedObjects: (selectedObjects: DrawingObjectType[]) => void;
  getSelectedObjects: () => DrawingObjectType[];
}

export abstract class DrawingTool {
  public drawingLayer: IDrawingLayer;
  public settings: ToolbarSettings;

  constructor(drawingLayer: IDrawingLayer) {
    const {stroke, fill, strokeDashArray, strokeWidth} = DefaultToolbarSettings;
    this.drawingLayer = drawingLayer;
    this.settings = {
      stroke,
      fill,
      strokeDashArray,
      strokeWidth
    };
  }

  public setSettings(settings: ToolbarSettings) {
    this.settings = settings;
    return this;
  }

  public handleMouseDown(e: React.MouseEvent<HTMLDivElement>): void {
    // handled in subclass
  }

  public handleObjectClick(e: MouseEvent|React.MouseEvent<any>, obj: DrawingObjectType): void   {
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
