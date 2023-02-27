import React, { useState } from "react";
import { observer } from "mobx-react";
import { DragEndEvent, useDndMonitor, useDroppable } from "@dnd-kit/core";
import { Diagram, DiagramHelper, Variable, VariableType } from "@concord-consortium/diagram-view";

import { DiagramToolbar } from "./diagram-toolbar";
import { DiagramContentModelType } from "./diagram-content";
import { kDiagramDroppableId, kNewVariableButtonDraggableId, kQPVersion } from "./diagram-types";
import { variableBuckets } from "../shared-variables/shared-variables-utils";
import { useEditVariableDialog } from "../shared-variables/dialog/use-edit-variable-dialog";
import { useInsertVariableDialog } from "../shared-variables/dialog/use-insert-variable-dialog";
import { SharedVariablesType } from "../shared-variables/shared-variables";
import { useNewVariableDialog } from "../shared-variables/dialog/use-new-variable-dialog";
import { ITileProps } from "../../components/tiles/tile-component";
import { useToolbarTileApi } from "../../components/tiles/hooks/use-toolbar-tile-api";

import InsertVariableCardIcon from "./src/assets/insert-variable-card-icon.svg";
import "@concord-consortium/diagram-view/dist/index.css";
import "./diagram-tile.scss";

export const DiagramToolComponent: React.FC<ITileProps> = observer((
  { documentContent, model, onRegisterTileApi, onUnregisterTileApi, readOnly, scale, tileElt }
) => {
  const content = model.content as DiagramContentModelType;

  const [diagramHelper, setDiagramHelper] = useState<DiagramHelper | undefined>();
  const [interactionLocked, setInteractionLocked] = useState(false);
  const toggleInteractionLocked = () => {
    if (!interactionLocked) {
      content.root.setSelectedNode(undefined);
    }
    setInteractionLocked(!interactionLocked);
  };

  const handleDeleteClick = () => {
    const selectedNode = content.root.selectedNode;
    if (selectedNode) {
      content.root.removeNode(selectedNode);
    }
  };

  const [showEditVariableDialog] = useEditVariableDialog({
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

  const [showNewVariableDialog] =
    useNewVariableDialog({ addVariable: insertVariable, sharedModel: content.sharedModel as SharedVariablesType });

  const { selfVariables, otherVariables, unusedVariables } = variableBuckets(content, content.sharedModel);
  const [showInsertVariableDialog] = useInsertVariableDialog({
    disallowSelf: true,
    Icon: InsertVariableCardIcon,
    insertVariables,
    otherVariables,
    selfVariables,
    unusedVariables
  });
  const disableInsertVariableButton =
    otherVariables.length < 1 && unusedVariables.length < 1;

  const toolbarProps = useToolbarTileApi({ id: model.id, enabled: !readOnly, onRegisterTileApi, onUnregisterTileApi });

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

  return (
    <div className="diagram-tool">
      <DiagramToolbar
        content={content}
        diagramHelper={diagramHelper}
        disableInsertVariableButton={disableInsertVariableButton}
        documentContent={documentContent}
        handleDeleteClick={handleDeleteClick}
        handleEditVariableClick={showEditVariableDialog}
        handleInsertVariableClick={showInsertVariableDialog}
        handleNewVariableClick={showNewVariableDialog}
        hideNavigator={!!content.hideNavigator}
        interactionLocked={interactionLocked}
        tileElt={tileElt}
        tileId={model.id}
        toggleInteractionLocked={toggleInteractionLocked}
        toggleNavigator={() => content.setHideNavigator(!content.hideNavigator)}
        scale={scale}
        { ...toolbarProps }
      />
      <div className="drop-target" ref={setNodeRef} style={dropTargetStyle}>
        <Diagram
          dqRoot={content.root}
          hideControls={true}
          hideNavigator={!!content.hideNavigator}
          hideNewVariableButton={true}
          interactionLocked={interactionLocked}
          setDiagramHelper={setDiagramHelper}
        />
      </div>
      <div className="qp-version">{`version: ${kQPVersion}`}</div>
    </div>
  );
});
DiagramToolComponent.displayName = "DiagramToolComponent";
