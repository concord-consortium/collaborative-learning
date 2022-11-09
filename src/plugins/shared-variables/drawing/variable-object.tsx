import { Instance, SnapshotIn, types } from "mobx-state-tree";
import React, { useContext, useRef } from "react";
import { observer } from "mobx-react";
import useResizeObserver from "use-resize-observer";
import { DrawingObject, DrawingTool, IDrawingComponentProps, IDrawingLayer, IToolbarButtonProps, IToolbarManager,
  typeField } from "../../drawing/objects/drawing-object";
import { Point } from "../../drawing/model/drawing-basic-types";
import { VariableChip } from "@concord-consortium/diagram-view";
import { findVariable, getOrFindSharedModel } from "./drawing-utils";
import { useEditVariableDialog } from "../../diagram-viewer/use-edit-variable-dialog";
import { useNewVariableDialog } from "./use-new-variable-dialog";
import VariableToolIcon from "../../../clue/assets/icons/variable-tool.svg";
import { SvgToolbarButton } from "../../drawing/components/drawing-toolbar-buttons";
import { DrawingContentModelContext } from "../../drawing/components/drawing-content-context";
import { DrawingContentModelType } from "../../drawing/model/drawing-content";
import { useInsertVariableDialog } from "./use-insert-variable-dialog";

import "./variable-object.scss";

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
        (model as VariableChipObjectType).setRenderedSize(chipWidth + 2, chipHeight + 2);
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
        <span ref={variableChipRef} className="drawing-variable-container">
          <VariableChip variable={selectedVariable} className="drawing-variable" />
        </span>
      </foreignObject>
    );
  }
);

// If the only object selected is a variable chip, returns the variable associated with it.
// Otherwise, returns undefined.
const getSelectedVariable = (drawingContent: DrawingContentModelType) => {
  const selectedId = drawingContent.selectedIds.length === 1 ? drawingContent.selectedIds[0] : "";
  const selectedObject = drawingContent.objectMap[selectedId];
  return selectedObject?.type === "variable"
    ? findVariable(drawingContent, (selectedObject as VariableChipObjectType).variableId)
    : undefined;
};

export class InsertVariableTool extends DrawingTool {
  constructor(drawingLayer: IDrawingLayer) {
    super(drawingLayer);
  }
}

interface IInsertVariableButton {
  toolbarManager: IToolbarManager;
}
export const InsertVariableButton = observer(({ toolbarManager }: IInsertVariableButton) => {
  const sharedModel = getOrFindSharedModel(toolbarManager as DrawingContentModelType);
  const variables = sharedModel?.variables || [];

  const [showInsertVariableDialog] = useInsertVariableDialog({ variables });

  const disabled = variables.length < 1;

  return <SvgToolbarButton SvgIcon={VariableToolIcon} buttonClass="insert-variable" title="Insert Variable"
    onClick={showInsertVariableDialog} disabled={disabled} />;
});

export class NewVariableTool extends DrawingTool {
  constructor(drawingLayer: IDrawingLayer) {
    super(drawingLayer);
  }
}

interface INewVariableButtonProps {
  toolbarManager: IToolbarManager;
}
export const NewVariableButton = observer(({ toolbarManager }: INewVariableButtonProps) => {
  const [showVariableDialog] = useNewVariableDialog();

  const disabled = toolbarManager.hasSelectedObjects;
  const onClick = () => {
    showVariableDialog(); 
  };

  return <SvgToolbarButton SvgIcon={VariableToolIcon} buttonClass="new-variable" title="New Variable" 
    onClick={onClick} disabled={disabled} />;
});

export class EditVariableTool extends DrawingTool {
  constructor(drawingLayer: IDrawingLayer) {
    super(drawingLayer);
  }
}

interface IEditVariableButtonProps {
  toolbarManager: IToolbarManager;
}
export const EditVariableButton = observer(({ toolbarManager }: IEditVariableButtonProps) => {
  const selectedVariable = getSelectedVariable(toolbarManager as DrawingContentModelType);

  const [showVariableDialog] = useEditVariableDialog({ variable: selectedVariable });

  const disabled = !selectedVariable;
  const onClick = () => {
    showVariableDialog();
  };

  return <SvgToolbarButton SvgIcon={VariableToolIcon} buttonClass="edit-variable" title="Edit Variable"
    onClick={onClick} disabled={disabled} />;
});
