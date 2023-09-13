import { types } from "mobx-state-tree";
import { DrawingComponentType, DrawingObject } from "../objects/drawing-object";
import { EllipseComponent, EllipseDrawingTool, EllipseObject, EllipseToolbarButton } from "../objects/ellipse";
import { ImageComponent, ImageObject, StampDrawingTool, StampToolbarButton } from "../objects/image";
import { LineComponent, LineDrawingTool, LineObject, LineToolbarButton } from "../objects/line";
import { RectangleComponent, RectangleDrawingTool, RectangleObject, RectangleToolbarButton } 
    from "../objects/rectangle";
import { TextComponent, TextDrawingTool, TextObject, TextToolbarButton } from "../objects/text";
import { VectorComponent, VectorDrawingTool, VectorObject, VectorToolbarButton } from "../objects/vector";
import { IDrawingToolInfo } from "./drawing-object-manager";
import { SelectToolbarButton, DuplicateButton, DeleteButton } from "./drawing-toolbar-buttons";
import { SelectionDrawingTool } from "./selection-drawing-tool";

export interface IDrawingObjectInfo {
  type: string;
  component: DrawingComponentType;
  modelClass: typeof DrawingObject;
}

export const gDrawingObjectInfosNoGroup: Record<string, IDrawingObjectInfo | undefined> = {
  line: {
    type: "line",
    component: LineComponent,
    modelClass: LineObject,
  },
  vector: {
    type: "vector",
    component: VectorComponent,
    modelClass: VectorObject,
  },
  rectangle: {
    type: "rectangle",
    component: RectangleComponent,
    modelClass: RectangleObject,
  },
  ellipse: {
    type: "ellipse",
    component: EllipseComponent,
    modelClass: EllipseObject,
  },
  text: {
    type: "text",
    component: TextComponent,
    modelClass: TextObject,
  },
  image: {
    type: "image",
    component: ImageComponent,
    modelClass: ImageObject,
  }
};

export const gDrawingToolInfosNoGroup: Record<string, IDrawingToolInfo | undefined> = {
  select: {
    name: "select",
    toolClass: SelectionDrawingTool,
    buttonComponent: SelectToolbarButton
  },
  line: {
    name: "line",
    toolClass: LineDrawingTool,
    buttonComponent: LineToolbarButton
  },
  vector: {
    name: "vector",
    toolClass: VectorDrawingTool,
    buttonComponent: VectorToolbarButton
  },
  rectangle: {
    name: "rectangle",
    toolClass: RectangleDrawingTool,
    buttonComponent: RectangleToolbarButton
  },
  ellipse: {
    name: "ellipse",
    toolClass: EllipseDrawingTool,
    buttonComponent: EllipseToolbarButton
  },
  text: {
    name: "text",
    toolClass: TextDrawingTool,
    buttonComponent: TextToolbarButton
  },
  stamp: {
    name: "stamp",
    toolClass: StampDrawingTool,
    buttonComponent: StampToolbarButton
  },
  duplicate: {
    name: "duplicate",
    buttonComponent: DuplicateButton
  },
  delete: {
    name: "delete",
    buttonComponent: DeleteButton
  }
};

export const DrawingObjectMSTUnionNoGroup = types.late<typeof DrawingObject>(() => {
  const drawingObjectModels = Object.values(gDrawingObjectInfosNoGroup).map(info => info!.modelClass);
  return types.union(...drawingObjectModels) as typeof DrawingObject;
});
