import { Instance, SnapshotIn, types } from "mobx-state-tree";
import React, { useContext, useRef } from "react";
import useResizeObserver from "use-resize-observer";
import { DrawingObject, DrawingTool, IDrawingComponentProps, IDrawingLayer, IToolbarButtonProps, typeField }
  from "../../drawing-tool/objects/drawing-object";
import { Point } from "../../drawing-tool/model/drawing-basic-types";
import { VariableChip } from "../slate/variable-chip";
import { findVariable } from "./drawing-utils";
import { useVariableDialog } from "./use-variable-dialog";
import VariableToolIcon from "../../../clue/assets/icons/variable-tool.svg";
import { SvgToolbarButton } from "../../drawing-tool/components/drawing-toolbar-buttons";
import { DrawingContentModelContext } from "../../drawing-tool/components/drawing-content-context";
import { observer } from "mobx-react";

export const VariableChipObject = DrawingObject.named("VariableObject")
  .props({
    type: typeField("variable"),
    variableId: types.string
  })
  .volatile(self => ({
    width: 75,
    height: 24
  }))
  .actions(self => ({
    setRenderedSize(width: number, height: number) {
      self.width = width;
      self.height = height;
    }
  }))
  .views(self => ({
    get boundingBox() {
      const {x, y, width, height} = self;
      const nw: Point = {x, y};
      const se: Point = {x: x + width, y: y + height};
      return {nw, se};
    }
  }));
export interface VariableChipObjectType extends Instance<typeof VariableChipObject> {}
export interface VariableChipObjectSnapshot extends SnapshotIn<typeof VariableChipObject> {}
export interface VariableChipObjectSnapshotForAdd extends SnapshotIn<typeof VariableChipObject> {type: string}

export const VariableChipComponent: React.FC<IDrawingComponentProps> = observer(
  function VariableChipComponent({model, handleHover, handleDrag}){
    const drawingContent = useContext(DrawingContentModelContext);
    const variableChipRef = useRef(null);
    useResizeObserver({ref: variableChipRef, box: "border-box",
      // Volatile model props are used to track with the size. This way
      // the bounding box view will be updated when the size changes.
      // This is necessary so a selection box around the variable gets
      // re-rendered when the size changes.
      onResize({width: chipWidth, height: chipHeight}){
        if (!chipWidth || !chipHeight) {
          return;
        }
        // For some reason the resize observer border box width is off slightly
        (model as VariableChipObjectType).setRenderedSize(chipWidth + 2, chipHeight);
      }
    });

    if (model.type !== "variable") return null;
    const { x, y, width, height, variableId } = model as VariableChipObjectType;

    const selectedVariable = findVariable(drawingContent, variableId);
    if (!selectedVariable) {
      return null;
    }

    return (
      <foreignObject
        x={x}
        y={y}
        width={width}
        height={height}
        onMouseEnter={(e) => handleHover ? handleHover(e, model, true) : null }
        onMouseLeave={(e) => handleHover ? handleHover(e, model, false) : null }
        onMouseDown={(e)=> handleDrag?.(e, model)}
        >
        { // inline-block is required for the resize observer to monitor the size
        }
        <span ref={variableChipRef} className="drawing-variable variable-chip" style={{display: "inline-block"}}>
          <VariableChip variable={selectedVariable} />
        </span>
      </foreignObject>
    );
  }
);

export class VariableDrawingTool extends DrawingTool {
  constructor(drawingLayer: IDrawingLayer) {
    super(drawingLayer);
  }
}

export function VariableChipToolbarButton(props: IToolbarButtonProps) {
  const [showVariableDialog] = useVariableDialog();

  const handleShowVariableDialog = () => {
    showVariableDialog();
  };

  return <SvgToolbarButton SvgIcon={VariableToolIcon} buttonClass="variable"
    title="Variable" onClick={handleShowVariableDialog} />;
}
