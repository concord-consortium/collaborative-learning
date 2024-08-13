import { Instance, SnapshotIn, types } from "mobx-state-tree";
import React, { useContext, useRef } from "react";
import { observer } from "mobx-react";
import useResizeObserver from "use-resize-observer";
import { VariableChip, VariableType } from "@concord-consortium/diagram-view";
import { addChipToContent, findVariable, getOrFindSharedModel, getValidInsertPosition } from "./drawing-utils";
import { useInsertVariableDialog } from "../dialog/use-insert-variable-dialog";
import { variableBuckets } from "../shared-variables-utils";
import { DrawingObject, IDrawingComponentProps,
   ObjectTypeIconViewBox, typeField } from "../../drawing/objects/drawing-object";
import { Point } from "../../drawing/model/drawing-basic-types";
import { DrawingContentModelContext } from "../../drawing/components/drawing-content-context";
import { DrawingContentModelType, OpenPaletteValues } from "../../drawing/model/drawing-content";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { useDrawingAreaContext } from "../../drawing/components/drawing-area-context";
import { useNewVariableDialog } from "../dialog/use-new-variable-dialog";
import { useEditVariableDialog } from "../dialog/use-edit-variable-dialog";
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
    get label() {
      return "Variable";
    },
    get icon() {
      return (<AddVariableChipIcon viewBox={ObjectTypeIconViewBox} />);
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
        onPointerDown={(e)=> handleDrag?.(e, model)}
        pointerEvents={handleHover ? "visible" : "none"}
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

export const NewVariableButton = observer(() => {
  const drawingModel = useContext(DrawingContentModelContext);
  const drawingAreaContext = useDrawingAreaContext();
  const getVisibleCanvasSize = drawingAreaContext?.getVisibleCanvasSize || (() => undefined);
  const sharedModel = getOrFindSharedModel(drawingModel);

  const addVariable = (variable: VariableType) => {
    const variableId = variable.id;
    const pos = getValidInsertPosition(drawingModel, getVisibleCanvasSize);
    addChipToContent(drawingModel, variableId, pos);
  };
  const [showVariableDialog] = useNewVariableDialog({ addVariable, sharedModel });

  const disabled = drawingModel.hasSelectedObjects;

  function handleClick() {
    drawingModel.setOpenPalette(OpenPaletteValues.None);
    showVariableDialog();
  }

  return (
    <TileToolbarButton
      name="new-variable"
      title="New Variable"
      onClick={handleClick}
      disabled={disabled}
    >
      <AddVariableChipIcon />
    </TileToolbarButton>
  );
});

export const InsertVariableButton = observer(() => {
  const drawingModel = useContext(DrawingContentModelContext);
  const drawingAreaContext = useDrawingAreaContext();
  const getVisibleCanvasSize = drawingAreaContext?.getVisibleCanvasSize || (() => undefined);
  const sharedModel = getOrFindSharedModel(drawingModel);
  const { selfVariables, otherVariables, unusedVariables } = variableBuckets(drawingModel, sharedModel);
  const disabled = selfVariables.length < 1 && otherVariables.length < 1 && unusedVariables.length < 1;

  const insertVariables = (variablesToInsert: VariableType[]) => {
    variablesToInsert.forEach(variable => {
      const pos = getValidInsertPosition(drawingModel, getVisibleCanvasSize);
      addChipToContent(drawingModel, variable.id, pos);
    });
  };

  const [showInsertVarDialog] = useInsertVariableDialog(
    {insertVariables, otherVariables, selfVariables, unusedVariables }
  );

  function handleClick() {
    drawingModel.setOpenPalette(OpenPaletteValues.None);
    showInsertVarDialog();
  }

  return (
    <TileToolbarButton
      name="insert-variable"
      title="Insert Variable"
      onClick={handleClick}
      disabled={disabled}
    >
      <InsertVariableChipIcon />
    </TileToolbarButton>
  );
});

export const EditVariableButton = observer(() => {
  const drawingModel = useContext(DrawingContentModelContext);
  const selectedVariable = getSelectedVariable(drawingModel);
  const disabled = !selectedVariable;

  const [showVariableDialog] = useEditVariableDialog({ variable: selectedVariable });

  function handleClick() {
    drawingModel.setOpenPalette(OpenPaletteValues.None);
    showVariableDialog();
  }

  return (
    <TileToolbarButton
      name="edit-variable"
      title="Edit Variable"
      onClick={handleClick}
      disabled={disabled}
    >
      <VariableEditorIcon />
    </TileToolbarButton>
  );
});

