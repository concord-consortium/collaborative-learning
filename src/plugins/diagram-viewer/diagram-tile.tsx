import React, { useState } from "react";
import { observer } from "mobx-react";
import { DndContext, DragEndEvent, DragStartEvent, UniqueIdentifier } from "@dnd-kit/core";
import { Diagram, VariableType } from "@concord-consortium/diagram-view";

import { DiagramToolbar } from "./diagram-toolbar";
import { DiagramContentModelType } from "./diagram-content";
import { kQPVersion } from "./diagram-types";
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

  const handleDeleteClick = () => {
    const selectedNode = content.root.selectedNode;
    if (selectedNode) {
      content.root.removeNode(selectedNode);
    }
  };

  const [showEditVariableDialog] = useEditVariableDialog({
    variable: content.root.selectedNode?.variable
  });
  
  const insertVariables = (variablesToInsert: VariableType[]) => {
    let x = 250;
    let y = 50;
    const offset = 25;
    variablesToInsert.forEach(variable => {
      content.root.insertNode(variable, {x, y});
      x += offset;
      y += offset;
      content.root.setSelectedNode(content.root.getNodeFromVariableId(variable.id));
    });
  };
  const insertVariable = (variable: VariableType) => insertVariables([variable]);

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

  const [draggingId, setDraggingId] = useState<UniqueIdentifier | undefined>();
  const onDragStart = (event: DragStartEvent) => setDraggingId(event.active.id);
  const onDragEnd = (event: DragEndEvent) => setDraggingId(undefined);

  return (
    <DndContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="diagram-tool">
        <DiagramToolbar
          content={content}
          disableInsertVariableButton={disableInsertVariableButton}
          draggingId={draggingId}
          documentContent={documentContent}
          handleDeleteClick={handleDeleteClick}
          handleEditVariableClick={showEditVariableDialog}
          handleInsertVariableClick={showInsertVariableDialog}
          handleNewVariableClick={showNewVariableDialog}
          tileElt={tileElt}
          scale={scale}
          { ...toolbarProps }
        />
        <Diagram dqRoot={content.root} />
        <div className="qp-version">{`version: ${kQPVersion}`}</div>
      </div>
    </DndContext>
  );
});
DiagramToolComponent.displayName = "DiagramToolComponent";
