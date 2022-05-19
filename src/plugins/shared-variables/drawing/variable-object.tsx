import React from "react";
import DrawingObject, { DrawingObjectOptions } from "../../../components/tools/drawing-tool/drawing-object";
import { DrawingContentModelType } from "../../../models/tools/drawing/drawing-content";
import { Point, VariableDrawingObjectData } from "../../../models/tools/drawing/drawing-objects";
import { VariableChip } from "../slate/variable-chip";
import { findVariable } from "./drawing-utils";


export class VariableObject extends DrawingObject {
  declare model: VariableDrawingObjectData;
  drawingContent: DrawingContentModelType;

  constructor(model: VariableDrawingObjectData, drawingContent: DrawingContentModelType) {
    super(model);
    this.drawingContent = drawingContent;
  }

  public getBoundingBox() {
    const {x, y, width, height} = this.model;
    const nw: Point = {x, y};
    const se: Point = {x: x + width, y: y + height};
    return {nw, se};
  }

  public render(options: DrawingObjectOptions): JSX.Element|null {
    const {x, y, variableId } = this.model;
    const {id, handleHover} = options;

    const selectedVariable = findVariable(this.drawingContent, variableId);
    if (!selectedVariable) {
      return null;
    }

    return (
      <foreignObject
        key={id}
        x={x}
        y={y}
        overflow="visible"
        onMouseEnter={(e) => handleHover ? handleHover(e, this, true) : null }
        onMouseLeave={(e) => handleHover ? handleHover(e, this, false) : null }
      >
        <span id={id} className="variable-chip">
          <VariableChip variable={selectedVariable} />
        </span>
      </foreignObject>
    );
  }
}
