import React from "react";
import { observer } from "mobx-react";
import { ITileProps } from "../../components/tiles/tile-component";
import { DiagramToolbar } from "./diagram-toolbar";
import { DiagramContentModelType } from "./diagram-content";
import { kQPVersion } from "./diagram-types";
import { useEditVariableDialog } from "./use-edit-variable-dialog";
import { useToolbarTileApi } from "../../components/tiles/hooks/use-toolbar-tile-api";
import { Diagram } from "@concord-consortium/diagram-view";
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

  const toolbarProps = useToolbarTileApi({ id: model.id, enabled: !readOnly, onRegisterTileApi, onUnregisterTileApi });

  return (
    <div className="diagram-tool">
      <DiagramToolbar
        content={content}
        documentContent={documentContent}
        handleDeleteClick={handleDeleteClick}
        handleDialogClick={() => showEditVariableDialog()}
        tileElt={tileElt}
        scale={scale}
        { ...toolbarProps }
      />
      <Diagram dqRoot={content.root} />
      <div className="qp-version">{`version: ${kQPVersion}`}</div>
    </div>
  );
});
DiagramToolComponent.displayName = "DiagramToolComponent";
