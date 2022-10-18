import React, { useEffect, useState } from "react";
import { IToolTileProps } from "../../components/tools/tool-tile";
import { DiagramToolbar } from "./diagram-toolbar";
import { DiagramContentModelType } from "./diagram-content";
import { kQPVersion } from "./diagram-types";
import { useDiagramDialog } from "./use-diagram-dialog";
import { useToolbarToolApi } from "../../components/tools/hooks/use-toolbar-tool-api";
import { Diagram } from "@concord-consortium/diagram-view";
import "@concord-consortium/diagram-view/dist/index.css";

import "./diagram-tool.scss";

export const DiagramToolComponent: React.FC<IToolTileProps> = (
  { documentContent, model, onRegisterToolApi, onUnregisterToolApi, readOnly, scale, toolTile }
) => {
  const content = model.content as DiagramContentModelType;

  const [diagramDialogOpen, setDiagramDialogOpen] = useState(false);
  const [showDiagramDialog, hideDiagramDialog] = useDiagramDialog({
    onAccept: () => console.log("Acceptable."),
    onClear: () => true,
    onClose: () => setDiagramDialogOpen(false)
  });
  useEffect(() => {
    if (diagramDialogOpen) {
      showDiagramDialog();
    } else {
      hideDiagramDialog();
    }
  }, [diagramDialogOpen, hideDiagramDialog, showDiagramDialog]);

  const toolbarProps = useToolbarToolApi({ id: model.id, enabled: !readOnly, onRegisterToolApi, onUnregisterToolApi });
  
  return (
    <div className="diagram-tool">
      <DiagramToolbar
        documentContent={documentContent}
        handleDialogClick={() => setDiagramDialogOpen(true)}
        toolTile={toolTile}
        scale={scale}
        { ...toolbarProps }
      />
      <Diagram dqRoot={content.root} />
      <div className="qp-version">{`version: ${kQPVersion}`}</div>
    </div>
  );
};
DiagramToolComponent.displayName = "DiagramToolComponent";
