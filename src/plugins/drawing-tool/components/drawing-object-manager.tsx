import { SnapshotIn, types } from "mobx-state-tree";
import React from "react";
import {  
  VariableChipObjectSnapshot, 
} from "../../shared-variables/drawing/variable-object";
import { DrawingContentModelType } from "../model/drawing-content";
import { DrawingComponentType, DrawingObject, DrawingObjectType, 
  DrawingTool, HandleObjectHover, IDrawingLayer, IToolbarButtonProps } from "../objects/drawing-object";
import { EllipseComponent, EllipseDrawingTool, EllipseObject, 
  EllipseObjectSnapshot, EllipseToolbarButton } from "../objects/ellipse";
import { ImageComponent, ImageObject, ImageObjectSnapshot, 
  StampDrawingTool, StampToolbarButton } from "../objects/image";
import { LineComponent, LineDrawingTool, LineObject, LineObjectSnapshot, LineToolbarButton } from "../objects/line";
import { RectangleComponent, RectangleDrawingTool, RectangleObject, 
  RectangleObjectSnapshot, 
  RectangleToolbarButton} from "../objects/rectangle";
import { VectorComponent, VectorDrawingTool, VectorObject, 
  VectorObjectSnapshot, VectorToolbarButton } from "../objects/vector";

// FIXME: the other info object should be renamed
export interface IDrawingObjectInfo2 {
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

const gDrawingObjectInfos: Record<string, IDrawingObjectInfo2 | undefined> = {
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
  return Object.values(gDrawingObjectInfos).filter(value => value) as IDrawingObjectInfo2[];
}

export function getDrawingObjectComponent(drawingObject: DrawingObjectType) {
  const info = gDrawingObjectInfos[drawingObject.type];
  return info?.component;
}

export function getDrawingToolButtonComponent(toolName: string) {
  return gDrawingToolInfos[toolName]?.buttonComponent;
}

export function registerDrawingObjectInfo(drawingObjectInfo: IDrawingObjectInfo2) {
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



// FIXME: this is temporary, to support plugin based objects
// we can't use a static union. 
export type DrawingObjectSnapshotUnion = 
  LineObjectSnapshot  |
  VectorObjectSnapshot  |
  RectangleObjectSnapshot  |
  EllipseObjectSnapshot  |
  ImageObjectSnapshot  |
  VariableChipObjectSnapshot;

export const DrawingObjectMSTUnion = types.late<typeof DrawingObject>(() => {
  const drawingObjectModels = Object.values(gDrawingObjectInfos).map(info => info!.modelClass);
  return types.union(...drawingObjectModels) as typeof DrawingObject;
});
