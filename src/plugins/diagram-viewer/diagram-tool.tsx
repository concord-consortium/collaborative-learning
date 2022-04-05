import React from "react";
import { IToolTileProps } from "../../components/tools/tool-tile";
import { DiagramContentModelType } from "./diagram-content";
import { kQPVersion } from "./diagram-types";
import { Diagram } from "@concord-consortium/diagram-view";
import "@concord-consortium/diagram-view/dist/index.css";
import "./diagram-tool.scss";

export const DiagramToolComponent: React.FC<IToolTileProps> = ({ model }) => {
  const content = model.content as DiagramContentModelType;

  return (
    <div className="diagram-tool">
      <Diagram dqRoot={content.root} />
      <div className="qp-version">{`version: ${kQPVersion}`}</div>
    </div>
  );
};
DiagramToolComponent.displayName = "DiagramToolComponent";
