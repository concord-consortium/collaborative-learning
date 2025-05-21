import React from "react";
import { types } from "mobx-state-tree";
import { DrawingComponentType, DrawingObject, DrawingObjectType,
  DrawingTool, HandleObjectHover, HandleObjectDrag,
  IDrawingLayer } from "../objects/drawing-object";
import { EllipseComponent, EllipseDrawingTool, EllipseObject } from "../objects/ellipse";
import { ImageComponent, ImageObject, StampDrawingTool } from "../objects/image";
import { LineComponent, LineDrawingTool, LineObject } from "../objects/line";
import { RectangleComponent, RectangleDrawingTool, RectangleObject} from "../objects/rectangle";
import { VectorComponent, VectorDrawingTool, VectorObject } from "../objects/vector";
import { SelectionDrawingTool } from "./selection-drawing-tool";
import { TextComponent, TextDrawingTool, TextObject } from "../objects/text";

export interface IDrawingObjectInfo {
  type: string;
  component: DrawingComponentType;
  modelClass: typeof DrawingObject;
}

export interface IDrawingToolInfo {
  name: string;
  // using a simple `typeof DrawingTool` can't be used because that type
  // is an abstract class so can't be instantiated.
  toolClass?: { new(drawingLayer: IDrawingLayer): DrawingTool };
}

const gDrawingObjectInfos: Record<string, IDrawingObjectInfo | undefined> = {
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

const gDrawingToolInfos: Record<string, IDrawingToolInfo | undefined> = {
  select: {
    name: "select",
    toolClass: SelectionDrawingTool
  },
  line: {
    name: "line",
    toolClass: LineDrawingTool
  },
  vector: {
    name: "vector",
    toolClass: VectorDrawingTool,
  },
  rectangle: {
    name: "rectangle",
    toolClass: RectangleDrawingTool
  },
  ellipse: {
    name: "ellipse",
    toolClass: EllipseDrawingTool
  },
  text: {
    name: "text",
    toolClass: TextDrawingTool
  },
  stamp: {
    name: "stamp",
    toolClass: StampDrawingTool
  },
  duplicate: {
    name: "duplicate"
  },
  delete: {
    name: "delete"
  }
};

export function getDrawingToolInfos() {
  return Object.values(gDrawingToolInfos).filter(value => value) as IDrawingToolInfo[];
}

export function getDrawingObjectInfos() {
  return Object.values(gDrawingObjectInfos).filter(value => value) as IDrawingObjectInfo[];
}

export function getDrawingObjectComponent(drawingObject: DrawingObjectType) {
  const info = gDrawingObjectInfos[drawingObject.type];
  return info?.component;
}

export function registerDrawingObjectInfo(drawingObjectInfo: IDrawingObjectInfo) {
  gDrawingObjectInfos[drawingObjectInfo.type] = drawingObjectInfo;
}

export function registerDrawingToolInfo(drawingToolInfo: IDrawingToolInfo) {
  gDrawingToolInfos[drawingToolInfo.name] = drawingToolInfo;
}

export function renderDrawingObject(drawingObject: DrawingObjectType, readOnly=false,
                                    handleHover?: HandleObjectHover, handleDrag?: HandleObjectDrag) {
  const DrawingObjectComponent = getDrawingObjectComponent(drawingObject);
  if (!DrawingObjectComponent) return null;
  const element = (<DrawingObjectComponent key={drawingObject.id} model={drawingObject} readOnly={readOnly}
                    handleHover={handleHover} handleDrag={handleDrag}/>);
  if (drawingObject.visible) {
    return element;
  } else {
    // invisible objects, when rendered, are rendered as 'ghosts'
    return (<g key={drawingObject.id} className="ghost">{element}</g>);
  }
}

export const DrawingObjectMSTUnion = types.late<typeof DrawingObject>(() => {
  const drawingObjectModels = Object.values(gDrawingObjectInfos).map(info => info!.modelClass);
  return types.union(...drawingObjectModels) as typeof DrawingObject;
});
