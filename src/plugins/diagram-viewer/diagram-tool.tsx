import React, { useState } from "react";
import { IToolTileProps } from "../../components/tools/tool-tile";
import { DiagramToolbar } from "./diagram-toolbar";
import { DiagramContentModelType } from "./diagram-content";
import { kQPVersion } from "./diagram-types";
import { IToolApi } from "src/components/tools/tool-api";
import { Diagram } from "@concord-consortium/diagram-view";
import "@concord-consortium/diagram-view/dist/index.css";
import "./diagram-tool.scss";

export const DiagramToolComponent: React.FC<IToolTileProps> = ({ documentContent, model }) => {
  const content = model.content as DiagramContentModelType;
  const [toolbarToolApi, setToolbarToolApi] = useState<any>();

  return (
    <div className="diagram-tool">
      <DiagramToolbar
        onRegisterToolApi={(toolApi: IToolApi) => setToolbarToolApi(toolApi)}
        onUnregisterToolApi={() => setToolbarToolApi(undefined)}
        documentContent={documentContent}
        toolTile={undefined}
        scale={1}
        onIsEnabled={() => true}
      />
      <Diagram dqRoot={content.root} />
      <div className="qp-version">{`version: ${kQPVersion}`}</div>
    </div>
  );
};
DiagramToolComponent.displayName = "DiagramToolComponent";
