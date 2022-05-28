import { types } from "mobx-state-tree";
import React from "react";
import { VariableChipComponent, VariableChipObject, 
  VariableChipObjectSnapshot } from "../../shared-variables/drawing/variable-object";
import { DrawingContentModelType } from "../model/drawing-content";
import { DrawingComponentType, DrawingObjectType, HandleObjectHover } from "../objects/drawing-object";
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

export function renderDrawingObject(drawingObject: DrawingObjectType, drawingContent: DrawingContentModelType, 
                                    handleHover?: HandleObjectHover) {
  const DrawingObjectComponent = getDrawingObjectComponent(drawingObject);
  return DrawingObjectComponent ? 
    <DrawingObjectComponent key={drawingObject.id} model={drawingObject} 
      drawingContent={drawingContent} handleHover={handleHover}/> 
    : null;
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
export const DrawingObjectMSTUnion = 
  types.union(LineObject, VectorObject, RectangleObject, EllipseObject, ImageObject, VariableChipObject);
