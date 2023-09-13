import { types } from "mobx-state-tree";
import React from "react";
import { DrawingObject, DrawingObjectType,
  DrawingTool, HandleObjectHover, HandleObjectDrag,
  IDrawingLayer, IToolbarButtonProps } from "../objects/drawing-object";
import { IDrawingObjectInfo, gDrawingObjectInfosNoGroup, gDrawingToolInfosNoGroup } 
  from "./drawing-object-manager-no-group";
import { GroupComponent, GroupObject } from "../objects/group";
import { GroupObjectsButton, UngroupObjectsButton } from "./drawing-toolbar-group-buttons";

export interface IDrawingToolInfo {
  name: string;
  // using a simple `typeof DrawingTool` can't be used because that type
  // is an abstract class so can't be instantiated.
  toolClass?: { new(drawingLayer: IDrawingLayer): DrawingTool };
  buttonComponent: React.ComponentType<IToolbarButtonProps>;
}


const gDrawingObjectInfos: Record<string, IDrawingObjectInfo | undefined> = {
  ...gDrawingObjectInfosNoGroup,
  group: {
    type: "group",
    component: GroupComponent,
    modelClass: GroupObject
  }
};

const gDrawingToolInfos: Record<string, IDrawingToolInfo | undefined> = {
  ...gDrawingToolInfosNoGroup,
  group: {
    name: "group",
    buttonComponent: GroupObjectsButton
  },
  ungroup: {
    name: "ungroup",
    buttonComponent: UngroupObjectsButton
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
  gDrawingObjectInfosNoGroup[drawingObjectInfo.type] = drawingObjectInfo;
  gDrawingObjectInfos[drawingObjectInfo.type] = drawingObjectInfo;
}

export function registerDrawingToolInfo(drawingToolInfo: IDrawingToolInfo) {
  gDrawingToolInfosNoGroup[drawingToolInfo.name] = drawingToolInfo;
  gDrawingToolInfos[drawingToolInfo.name] = drawingToolInfo;
}

export function renderDrawingObject(drawingObject: DrawingObjectType, readOnly=false,
                                    handleHover?: HandleObjectHover, handleDrag?: HandleObjectDrag) {
  const DrawingObjectComponent = getDrawingObjectComponent(drawingObject);
  return DrawingObjectComponent ?
    <DrawingObjectComponent key={drawingObject.id} model={drawingObject} readOnly={readOnly}
      handleHover={handleHover} handleDrag={handleDrag}/>
    : null;
}



export const DrawingObjectMSTUnion = types.late<typeof DrawingObject>(() => {
  const drawingObjectModels = Object.values(gDrawingObjectInfos).map(info => info!.modelClass);
  return types.union(...drawingObjectModels) as typeof DrawingObject;
});
