import React from "react";
import { IToolTileProps } from "../../components/tools/tool-tile";
import { DiagramToolbar } from "./diagram-toolbar";
import { DiagramContentModelType } from "./diagram-content";
import { kQPVersion } from "./diagram-types";
import { useToolbarToolApi } from "../../components/tools/hooks/use-toolbar-tool-api";
import { Diagram } from "@concord-consortium/diagram-view";
import "@concord-consortium/diagram-view/dist/index.css";

import "./diagram-tool.scss";

export const DiagramToolComponent: React.FC<IToolTileProps> = (
  { documentContent, model, onRegisterToolApi, onUnregisterToolApi, readOnly, scale, toolTile }
) => {
  const content = model.content as DiagramContentModelType;

  const toolbarProps = useToolbarToolApi({ id: model.id, enabled: !readOnly, onRegisterToolApi, onUnregisterToolApi });
  
  return (
    <div className="diagram-tool">
      <DiagramToolbar
        documentContent={documentContent}
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
