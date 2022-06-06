import { getMembers, Instance, SnapshotIn, types } from "mobx-state-tree";
import { uniqueId } from "../../../utilities/js-utils";
import { SelectionBox } from "../components/selection-box";
import { BoundingBox, DefaultToolbarSettings, Point, ToolbarSettings } from "../model/drawing-basic-types";
import { DrawingContentModelType } from "../model/drawing-content";
import { StampModelType } from "../model/stamp";

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
export interface DrawingObjectSnapshot extends SnapshotIn<typeof DrawingObject> {} 

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

// TODO there should be a better way to do this 
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

export interface IDrawingComponentProps {
  model: DrawingObjectType;
  // TODO: this basically causes a circular reference. The drawingContent needs to know
  // about all of the tools and the tools need to use this IDrawingComponentProps.
  // This drawingContent prop is only needed by the variable chip. When the variable chip
  // is a real plugin to the drawing tile, hopefully this circular dependency can be removed.
  // A possible solution for this is to put this in a context. This way the chip component
  // embedded in what should be a generic drawing component can access info about the parent
  // of the drawing component. This might already be available in an existing context.
  drawingContent: DrawingContentModelType;
  handleHover?: HandleObjectHover;
}

// TODO: the support for palettes is hard coded to specific tools
export interface IPaletteState {
  showStamps: boolean;
  showStroke: boolean;
  showFill: boolean;
}
export type PaletteKey = keyof IPaletteState;
export const kClosedPalettesState = { showStamps: false, showStroke: false, showFill: false };

export interface IToolbarButtonProps {
  drawingContent: DrawingContentModelType;
  // TODO: the support for palettes is hard coded to specific tools
  togglePaletteState: (palette: PaletteKey, show?: boolean) => void;  
  clearPaletteState: () => void;
}

export type DrawingComponentType = React.ComponentType<IDrawingComponentProps>;

export interface IDrawingLayer {
  getWorkspacePoint: (e:MouseEvent|React.MouseEvent) => Point|null;
  setCurrentDrawingObject: (object: DrawingObjectType|null) => void;
  addNewDrawingObject: (object: DrawingObjectType) => void;
  getCurrentStamp: () => StampModelType|null;
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
