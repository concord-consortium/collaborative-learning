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
    const {x, y} = this.model;
    const chipWidth = document.getElementById(this.model.variableId)?.getBoundingClientRect().width || 75;
    const chipHeight = document.getElementById(this.model.variableId)?.getBoundingClientRect().height  || 24;
    const nw: Point = {x, y};
    const se: Point = {x: x + chipWidth, y: y + chipHeight};
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
        <span id={variableId} className="drawing-variable variable-chip">
          <VariableChip variable={selectedVariable} />
        </span>
      </foreignObject>
    );
  }
}
