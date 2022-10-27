import React from "react";
import { observer } from "mobx-react";
import { IToolTileProps } from "../../components/tools/tool-tile";
import { DiagramToolbar } from "./diagram-toolbar";
import { DiagramContentModelType } from "./diagram-content";
import { kQPVersion } from "./diagram-types";
import { useEditVariableDialog } from "./use-edit-variable-dialog";
import { useToolbarToolApi } from "../../components/tools/hooks/use-toolbar-tool-api";
import { Diagram } from "@concord-consortium/diagram-view";
import "@concord-consortium/diagram-view/dist/index.css";

import "./diagram-tool.scss";

export const DiagramToolComponent: React.FC<IToolTileProps> = observer((
  { documentContent, model, onRegisterToolApi, onUnregisterToolApi, readOnly, scale, toolTile }
) => {
  const content = model.content as DiagramContentModelType;

  const [showEditVariableDialog] = useEditVariableDialog({
    variable: content.root.selectedNode?.variable
  });

  const toolbarProps = useToolbarToolApi({ id: model.id, enabled: !readOnly, onRegisterToolApi, onUnregisterToolApi });
  
  return (
    <div className="diagram-tool">
      <DiagramToolbar
        documentContent={documentContent}
        handleDialogClick={() => showEditVariableDialog()}
        toolTile={toolTile}
        scale={scale}
        selectedVariable={content.root.selectedNode?.variable}
        { ...toolbarProps }
      />
      <Diagram dqRoot={content.root} />
      <div className="qp-version">{`version: ${kQPVersion}`}</div>
    </div>
  );
});
DiagramToolComponent.displayName = "DiagramToolComponent";
