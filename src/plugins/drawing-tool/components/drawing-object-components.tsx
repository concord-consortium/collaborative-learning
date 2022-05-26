import { types } from "mobx-state-tree";
import React from "react";
import { VariableChipComponent, VariableChipObject, 
  VariableChipObjectSnapshot } from "../../shared-variables/drawing/variable-object";
import { DrawingContentModelType } from "../model/drawing-content";
import { DrawingObjectType } from "../model/drawing-objects";
import { DrawingComponentType } from "../objects/drawing-object-types";
import { EllipseComponent, EllipseObject, EllipseObjectSnapshot } from "../objects/ellipse";
import { ImageComponent, ImageObject, ImageObjectSnapshot } from "../objects/image";
import { LineComponent, LineObject, LineObjectSnapshot } from "../objects/line";
import { RectangleComponent, RectangleObject, RectangleObjectSnapshot } from "../objects/rectangle";
import { VectorComponent, VectorObject, VectorObjectSnapshot } from "../objects/vector";

const gDrawingObjectComponents: Record<string, DrawingComponentType | undefined> = {
  "line": LineComponent,
  "vector": VectorComponent,
  "rectangle": RectangleComponent,
  "ellipse": EllipseComponent,
  "image": ImageComponent,
  "variable": VariableChipComponent,
};

export function getDrawingObjectComponent(drawingObject: DrawingObjectType) {
  return gDrawingObjectComponents[drawingObject.type];
}

type HandleObjectHover = (e: MouseEvent|React.MouseEvent<any>, obj: DrawingObjectType, hovering: boolean) => void;

export function renderDrawingObject(drawingObject: DrawingObjectType, drawingContent: DrawingContentModelType, 
  handleHover?: HandleObjectHover) {
  const DrawingObjectComponent = getDrawingObjectComponent(drawingObject);
  if (!DrawingObjectComponent) return null;
  return <DrawingObjectComponent key={drawingObject.id} model={drawingObject} drawingContent={drawingContent} 
    handleHover={handleHover}/>;
}

// FIXME: this is temporary, to support plugin based objects
// we can't use a static union. Also if we keep it here the name of this file
// isn't correct.
export type DrawingObjectSnapshotUnion = 
  LineObjectSnapshot  |
  VectorObjectSnapshot  |
  RectangleObjectSnapshot  |
  EllipseObjectSnapshot  |
  ImageObjectSnapshot  |
  VariableChipObjectSnapshot;

// FIXME: This is temporary it will need to be dynamic
// I'm also not sure if MST will be smart enough to figure out the 
// type based on the type field (especially since it is optional)
export const DrawingObjectMSTUnion = 
  types.union(LineObject, VectorObject, RectangleObject, EllipseObject, ImageObject, VariableChipObject);
