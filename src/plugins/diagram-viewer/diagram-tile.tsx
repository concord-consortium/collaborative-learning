import React, { createContext, useState } from "react";
import { observer } from "mobx-react";
import { DragEndEvent, useDndMonitor, useDroppable } from "@dnd-kit/core";
import { Diagram, DiagramHelper, Variable, VariableType } from "@concord-consortium/diagram-view";
import { DiagramContentModelType } from "./diagram-content";
import { kDiagramDroppableId, kNewVariableButtonDraggableId, kQPVersion } from "./diagram-types";
import { variableBuckets } from "../shared-variables/shared-variables-utils";
import { useEditVariableDialog } from "../shared-variables/dialog/use-edit-variable-dialog";
import { useInsertVariableDialog } from "../shared-variables/dialog/use-insert-variable-dialog";
import { SharedVariablesType } from "../shared-variables/shared-variables";
import { useNewVariableDialog } from "../shared-variables/dialog/use-new-variable-dialog";
import { ITileProps } from "../../components/tiles/tile-component";
import { useUIStore } from "../../hooks/use-stores";
import { BasicEditableTileTitle } from "../../components/tiles/basic-editable-tile-title";
import { DiagramHelperContext } from "./use-diagram-helper-context";
import { TileToolbar } from "../../components/toolbar/tile-toolbar";

import InsertVariableCardIcon from "./src/assets/insert-variable-card-icon.svg";

import "./diagram-tile.scss";

/**
 * A packet of callbacks provided to the toolbar via context.
 */
export interface DiagramTileMethods {
  isInteractionLocked: () => boolean;
  toggleInteractionLocked: () => void;
  isNavigatorHidden: () => boolean;
  toggleNavigatorHidden: () => void;
  isDisplayingSomeVariables: () => boolean;
  isUnusedVariableAvailable: () => boolean;
  showDialog: (showDialogFunction: () => void) => void;
  showNewVariableDialog: () => void;
  showInsertVariableDialog: () => void;
  showEditVariableDialog: () => void;
}

export const DiagramTileMethodsContext = createContext<DiagramTileMethods|undefined>(undefined);

export const DiagramToolComponent: React.FC<ITileProps> = observer((
  { documentContent, model, onRegisterTileApi, onUnregisterTileApi, readOnly, scale, tileElt }
) => {
  const content = model.content as DiagramContentModelType;
  const ui = useUIStore();
  const isTileSelected = ui.isSelectedTile(model);

  const [diagramHelper, setDiagramHelper] = useState<DiagramHelper | undefined>();
  const [interactionLocked, setInteractionLocked] = useState(false);

  const toggleInteractionLocked = () => {
    if (!interactionLocked) {
      content.root.setSelectedNode(undefined);
    }
    setInteractionLocked(!interactionLocked);
  };

  const [dialogOpen, setDialogOpen] = useState(false);
  const onClose = () => setDialogOpen(false);

  const showDialog = (showDialogFunction: () => void) => {
    setDialogOpen(true);
    showDialogFunction();
  };

  const [showEditVariableDialog] = useEditVariableDialog({
    onClose,
    variable: content.root.selectedNode?.variable
  });

  const insertVariables = (variablesToInsert: VariableType[], startX?: number, startY?: number) => {
    // Start at an arbitrary point...
    let x = 250;
    let y = 50;

    // ...unless we can find the center of the tile...
    const center = diagramHelper?.newCardPosition;
    if (center) {
      x = center.x;
      y = center.y;
    }

    // ...or the client specified a position.
    x = startX !== undefined ? startX : x;
    y = startY !== undefined ? startY : y;

    const offset = 25;
    variablesToInsert.forEach(variable => {
      content.root.insertNode(variable, {x, y});
      x += offset;
      y += offset;
      content.root.setSelectedNode(content.root.getNodeFromVariableId(variable.id));
    });
  };
  const insertVariable = (variable: VariableType, x?: number, y?: number) => insertVariables([variable], x, y);

  const [showNewVariableDialog] = useNewVariableDialog({
    addVariable: insertVariable,
    onClose,
    sharedModel: content.sharedModel as SharedVariablesType
  });

  const { selfVariables, otherVariables, unusedVariables } = variableBuckets(content, content.sharedModel);

  const isDisplayingSomeVariables = () => {
    return selfVariables.length > 0;
  };

  const [showInsertVariableDialog] = useInsertVariableDialog({
    onClose,
    disallowSelf: true,
    Icon: InsertVariableCardIcon,
    insertVariables,
    otherVariables,
    selfVariables,
    unusedVariables
  });

  const isUnusedVariableAvailable = () => {
    return !(otherVariables.length < 1 && unusedVariables.length < 1);
  };

  const diagramMethods: DiagramTileMethods = {
    isInteractionLocked: () => interactionLocked,
    toggleInteractionLocked,
    isNavigatorHidden: () => !!content.hideNavigator,
    toggleNavigatorHidden: () => { content.setHideNavigator(!content.hideNavigator); },
    isDisplayingSomeVariables,
    isUnusedVariableAvailable,
    showDialog,
    showNewVariableDialog,
    showInsertVariableDialog,
    showEditVariableDialog,
  };

  const droppableId = `${kDiagramDroppableId}-${model.id}`;
  const { isOver, setNodeRef } = useDroppable({ id: droppableId });
  const dropTargetStyle = {
    backgroundColor: isOver ? "#eef8ff" : undefined
  };
  useDndMonitor({
    onDragEnd: (event: DragEndEvent) => {
      if (event.over?.id === droppableId && event.active.id.toString().includes(kNewVariableButtonDraggableId)) {
        const pointerEvent = event.activatorEvent as PointerEvent;
        const clientX = pointerEvent.clientX + event.delta.x;
        const clientY = pointerEvent.clientY + event.delta.y;
        const position = diagramHelper?.convertClientToDiagramPosition({x: clientX, y: clientY});
        const { x, y } = position;

        const variable = Variable.create({});
        content.sharedModel?.addAndInsertVariable(
          variable,
          (v: VariableType) => insertVariable(variable, x, y)
        );
      }
    }
  });

  const preventKeyboardDelete = dialogOpen || !isTileSelected || readOnly;
  return (
    <DiagramHelperContext.Provider value={diagramHelper}>
      <DiagramTileMethodsContext.Provider value={diagramMethods}>
        <div className="tile-content diagram-tool">
          <BasicEditableTileTitle />
          <TileToolbar tileType="diagram" readOnly={!!readOnly} tileElement={tileElt} />
          <div className="drop-target" ref={setNodeRef} style={dropTargetStyle}>
            <Diagram
              dqRoot={content.root}
              hideControls={true}
              hideNavigator={!!content.hideNavigator}
              hideNewVariableButton={true}
              interactionLocked={interactionLocked || readOnly}
              preventKeyboardDelete={preventKeyboardDelete}
              readOnly={readOnly}
              setDiagramHelper={setDiagramHelper}
            />
          </div>
          <div className="qp-version">{`version: ${kQPVersion}`}</div>
        </div>
      </DiagramTileMethodsContext.Provider>
    </DiagramHelperContext.Provider>
  );
});
DiagramToolComponent.displayName = "DiagramToolComponent";
