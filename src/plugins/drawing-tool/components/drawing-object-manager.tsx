import { types } from "mobx-state-tree";
import React from "react";
import { VariableChipComponent, VariableChipObject, 
  VariableChipObjectSnapshot, 
  VariableDrawingTool} from "../../shared-variables/drawing/variable-object";
import { DrawingContentModelType } from "../model/drawing-content";
import { DrawingComponentType, DrawingObject, DrawingObjectType, 
  DrawingTool, HandleObjectHover, IDrawingLayer, IToolbarButtonProps } from "../objects/drawing-object";
import { EllipseComponent, EllipseDrawingTool, EllipseObject, EllipseObjectSnapshot } from "../objects/ellipse";
import { ImageComponent, ImageObject, ImageObjectSnapshot, 
  StampDrawingTool, StampToolbarButton } from "../objects/image";
import { LineComponent, LineDrawingTool, LineObject, LineObjectSnapshot, LineToolbarButton } from "../objects/line";
import { RectangleComponent, RectangleDrawingTool, RectangleObject, 
  RectangleObjectSnapshot } from "../objects/rectangle";
import { VectorComponent, VectorDrawingTool, VectorObject, VectorObjectSnapshot } from "../objects/vector";

// FIXME: the other info object should be renamed
export interface IDrawingObjectInfo2 {
  type: string;
  component: DrawingComponentType;
  modelClass: typeof DrawingObject;
  // using a simple `typeof DrawingTool` can't be used because that type
  // is an abstract class so can't be instantiated. 
  toolClass: { new(drawingLayer: IDrawingLayer): DrawingTool };
  toolbarButtons?: Record<string, React.ComponentType<IToolbarButtonProps>>
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
    toolClass: LineDrawingTool,
    toolbarButtons: {
      "line": LineToolbarButton
    }
  },
  vector: {
    type: "vector",
    component: VectorComponent,
    modelClass: VectorObject,
    toolClass: VectorDrawingTool
  },
  rectangle: {
    type: "rectangle",
    component: RectangleComponent,
    modelClass: RectangleObject,
    toolClass: RectangleDrawingTool
  },
  ellipse: {
    type: "ellipse",
    component: EllipseComponent,
    modelClass: EllipseObject,
    toolClass: EllipseDrawingTool
  },
  image: {
    type: "image",
    component: ImageComponent,
    modelClass: ImageObject,
    toolClass: StampDrawingTool,
    toolbarButtons: {
      "stamp": StampToolbarButton
    }
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
    toolClass: VectorDrawingTool
  },
  rectangle: {
    name: "rectangle",
    toolClass: RectangleDrawingTool
  },
  ellipse: {
    name: "ellipse",
    toolClass: EllipseDrawingTool
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

export function registerDrawingObjectInfo(drawingObjectInfo: IDrawingObjectInfo2) {
  gDrawingObjectInfos[drawingObjectInfo.type] = drawingObjectInfo;
}

registerDrawingObjectInfo({
  type: "variable",
  component:VariableChipComponent,
  modelClass: VariableChipObject,
  toolClass: VariableDrawingTool
});

export function getDrawingObjectInfos() {
  return Object.values(gDrawingObjectInfos).filter(value => value) as IDrawingObjectInfo2[];
}

export function getDrawingObjectComponent(drawingObject: DrawingObjectType) {
  const info = gDrawingObjectInfos[drawingObject.type];
  return info?.component;
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
