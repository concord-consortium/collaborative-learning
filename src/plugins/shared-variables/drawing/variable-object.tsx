import { Instance, SnapshotIn, types } from "mobx-state-tree";
import React from "react";
import { DrawingObject, Point, typeField } from "../../drawing-tool/model/drawing-objects";
import { DrawingTool, IDrawingComponentProps, IDrawingLayer } from "../../drawing-tool/objects/drawing-object-types";
import { VariableChip } from "../slate/variable-chip";
import { findVariable } from "./drawing-utils";

export const VariableChipObject = DrawingObject.named("VariableObject")
  .props({
    type: typeField("variable"),
    variableId: types.string
  })
  .views(self => ({
    get boundingBox() {
      const {x, y} = self;
      // FIXME: this is a problem. The model is looking at the rendered element.
      // Also MobX might not be able to cache this correctly.  
      // We only really know the size once the text is rendered. 
      // A possible solution is to add volatile props for chipWidth and chipHeight and then have
      // a size observer on the component so it updates these props on the model.
      // Another solution is to somehow move the boundingBox calculation into the component so
      // it can work with its ref. 
      const chipWidth = document.getElementById(self.variableId)?.getBoundingClientRect().width || 75;
      const chipHeight = document.getElementById(self.variableId)?.getBoundingClientRect().height  || 24;
      const nw: Point = {x, y};
      const se: Point = {x: x + chipWidth, y: y + chipHeight};
      return {nw, se};  
    }
  }));
export interface VariableChipObjectType extends Instance<typeof VariableChipObject> {}
export interface VariableChipObjectSnapshot extends SnapshotIn<typeof VariableChipObject> {}

export const VariableChipComponent: React.FC<IDrawingComponentProps> = function ({model, handleHover, drawingContent}){
  if (model.type !== "variable") return null;
  const { id, x, y, variableId } = model as VariableChipObjectType;

  const selectedVariable = findVariable(drawingContent, variableId);
  if (!selectedVariable) {
    return null;
  }

  return (
    <foreignObject
      key={id}
      x={x}
      y={y}
      overflow="visible"
      onMouseEnter={(e) => handleHover ? handleHover(e, model, true) : null }
      onMouseLeave={(e) => handleHover ? handleHover(e, model, false) : null }
    >
      { // FIXME: the same variable can have multiple chips so that would mean multiple
        // spans with the same id. The model.id would be a better id to use.
      }
      <span id={variableId} className="drawing-variable variable-chip">
        <VariableChip variable={selectedVariable} />
      </span>
    </foreignObject>
  );
};

export class VariableDrawingTool extends DrawingTool {
  constructor(drawingLayer: IDrawingLayer) {
    super(drawingLayer);
  }
}
