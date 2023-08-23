import { Instance, SnapshotIn, types } from "mobx-state-tree";
import React, { useContext, useRef } from "react";
import { observer } from "mobx-react";
import useResizeObserver from "use-resize-observer";
import { VariableChip, VariableType } from "@concord-consortium/diagram-view";

import { addChipToContent, findVariable, getOrFindSharedModel, getValidInsertPosition } from "./drawing-utils";
import { useEditVariableDialog } from "../dialog/use-edit-variable-dialog";
import { useInsertVariableDialog } from "../dialog/use-insert-variable-dialog";
import { useNewVariableDialog } from "../dialog/use-new-variable-dialog";
import { SharedVariablesType } from "../shared-variables";
import { variableBuckets } from "../shared-variables-utils";
import { DrawingObject, IDrawingComponentProps, IToolbarManager,
  typeField } from "../../drawing/objects/drawing-object";
import { Point } from "../../drawing/model/drawing-basic-types";
import { SvgToolbarButton } from "../../drawing/components/drawing-toolbar-buttons";
import { DrawingContentModelContext } from "../../drawing/components/drawing-content-context";
import { DrawingContentModelType } from "../../drawing/model/drawing-content";

import AddVariableChipIcon from "../assets/add-variable-chip-icon.svg";
import InsertVariableChipIcon from "../assets/insert-variable-chip-icon.svg";
import VariableEditorIcon from "../assets/variable-editor-icon.svg";
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
      const {width, height} = self;
      const {x, y} = self.position;
      const nw: Point = {x, y};
      const se: Point = {x: x + width, y: y + height};
      return {nw, se};
    },
    get supportsResize() {
      return false;
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
    const { width, height, variableId } = model as VariableChipObjectType;
    const { x, y } = model.position;
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
  const selectedId = drawingContent.selection.length === 1 ? drawingContent.selection[0] : "";
  const selectedObject = drawingContent.objectMap[selectedId];
  return selectedObject?.type === "variable"
    ? findVariable(drawingContent, (selectedObject as VariableChipObjectType).variableId)
    : undefined;
};

// Returns a list of the variables used by the given drawingContent
export const drawingVariables = (drawingContent: DrawingContentModelType) => {
  const variableIds: string[] = [];
  drawingContent.objects.forEach(object => {
    if (object.type === "variable") {
      const variableId = (object as VariableChipObjectType).variableId;
      if (!variableIds.includes((object as VariableChipObjectType).variableId)) {
        variableIds.push(variableId);
      }
    }
  });
  const variables = variableIds.map(id => findVariable(drawingContent, id));
  const filteredVariables = variables.filter(variable => variable !== undefined);
  return filteredVariables as VariableType[];
};  

interface IInsertVariableButton {
  toolbarManager: IToolbarManager;
  getVisibleCanvasSize: () => Point|undefined;
}
export const InsertVariableButton = observer(({ toolbarManager, getVisibleCanvasSize }: IInsertVariableButton) => {
  const drawingContent = toolbarManager as DrawingContentModelType;
  const sharedModel = getOrFindSharedModel(drawingContent);
  const insertVariables = (variablesToInsert: VariableType[]) => {
    variablesToInsert.forEach(variable => {
      const pos = getValidInsertPosition(drawingContent, getVisibleCanvasSize);
      addChipToContent(drawingContent, variable.id, pos);
    });
  };
  const { selfVariables, otherVariables, unusedVariables } = variableBuckets(drawingContent, sharedModel);
  const [showInsertVariableDialog] = useInsertVariableDialog({
    insertVariables, otherVariables, selfVariables, unusedVariables });

  const disabled = selfVariables.length < 1 && otherVariables.length < 1 && unusedVariables.length < 1;

  return <SvgToolbarButton SvgIcon={InsertVariableChipIcon} buttonClass="insert-variable" title="Insert Variable"
    onClick={showInsertVariableDialog} disabled={disabled} />;
});

interface INewVariableButtonProps {
  toolbarManager: IToolbarManager;
  getVisibleCanvasSize: () => Point|undefined;
}
export const NewVariableButton = observer(({ toolbarManager, getVisibleCanvasSize }: INewVariableButtonProps) => {
  const drawingContent = useContext(DrawingContentModelContext);
  const sharedModel = getOrFindSharedModel(drawingContent) as SharedVariablesType;
  const addVariable = (variable: VariableType) => {
    const variableId = variable.id;
    const pos = getValidInsertPosition(drawingContent, getVisibleCanvasSize);
    addChipToContent(drawingContent, variableId, pos);
  };
  const [showVariableDialog] = useNewVariableDialog({ addVariable, sharedModel });

  const disabled = toolbarManager.hasSelectedObjects;
  const onClick = () => {
    showVariableDialog(); 
  };

  return <SvgToolbarButton SvgIcon={AddVariableChipIcon} buttonClass="new-variable" title="New Variable" 
    onClick={onClick} disabled={disabled} />;
});

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

  return <SvgToolbarButton SvgIcon={VariableEditorIcon} buttonClass="edit-variable" title="Edit Variable"
    onClick={onClick} disabled={disabled} />;
});
