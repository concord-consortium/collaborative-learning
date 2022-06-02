import { types } from "mobx-state-tree";
import React from "react";
import { DrawingContentModelType } from "../model/drawing-content";
import { DrawingComponentType, DrawingObject, DrawingObjectType, 
  DrawingTool, HandleObjectHover, IDrawingLayer, IToolbarButtonProps } from "../objects/drawing-object";
import { EllipseComponent, EllipseDrawingTool, EllipseObject, EllipseToolbarButton } from "../objects/ellipse";
import { ImageComponent, ImageObject, StampDrawingTool, StampToolbarButton } from "../objects/image";
import { LineComponent, LineDrawingTool, LineObject, LineToolbarButton } from "../objects/line";
import { RectangleComponent, RectangleDrawingTool, RectangleObject,  
  RectangleToolbarButton} from "../objects/rectangle";
import { VectorComponent, VectorDrawingTool, VectorObject, VectorToolbarButton } from "../objects/vector";

export interface IDrawingObjectInfo {
  type: string;
  component: DrawingComponentType;
  modelClass: typeof DrawingObject;
}

export interface IDrawingToolInfo {
  name: string;
  // using a simple `typeof DrawingTool` can't be used because that type
  // is an abstract class so can't be instantiated. 
  toolClass: { new(drawingLayer: IDrawingLayer): DrawingTool };
  buttonComponent?: React.ComponentType<IToolbarButtonProps>;
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
  image: {
    type: "image",
    component: ImageComponent,
    modelClass: ImageObject,
  }
};

const gDrawingToolInfos: Record<string, IDrawingToolInfo | undefined> = {
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
  stamp: {
    name: "stamp",
    toolClass: StampDrawingTool,
    buttonComponent: StampToolbarButton
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

export function getDrawingToolButtonComponent(toolName: string) {
  return gDrawingToolInfos[toolName]?.buttonComponent;
}

export function registerDrawingObjectInfo(drawingObjectInfo: IDrawingObjectInfo) {
  gDrawingObjectInfos[drawingObjectInfo.type] = drawingObjectInfo;
}

export function registerDrawingToolInfo(drawingToolInfo: IDrawingToolInfo) {
  gDrawingToolInfos[drawingToolInfo.name] = drawingToolInfo;
}

export function renderDrawingObject(drawingObject: DrawingObjectType, drawingContent: DrawingContentModelType, 
                                    handleHover?: HandleObjectHover) {
  const DrawingObjectComponent = getDrawingObjectComponent(drawingObject);
  return DrawingObjectComponent ? 
    <DrawingObjectComponent key={drawingObject.id} model={drawingObject} 
      drawingContent={drawingContent} handleHover={handleHover}/> 
    : null;
}

export const DrawingObjectMSTUnion = types.late<typeof DrawingObject>(() => {
  const drawingObjectModels = Object.values(gDrawingObjectInfos).map(info => info!.modelClass);
  return types.union(...drawingObjectModels) as typeof DrawingObject;
});
