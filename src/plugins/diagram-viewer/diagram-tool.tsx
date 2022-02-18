import React from "react";
import { FlowTransform } from "react-flow-renderer";
import { IToolTileProps } from "../../components/tools/tool-tile";
import { DiagramContentModelType } from "./diagram-content";
import { Diagram } from "./src/components/diagram";
import "./diagram-tool.scss";

export const DiagramToolComponent: React.FC<IToolTileProps> = ({ model }) => {
  const content = model.content as DiagramContentModelType;

  const handleChangeFlowTransform = (transform?: FlowTransform) => {
    transform && content.setTransform(transform);
  };

  return (
    <div className="diagram-tool">
      <Diagram
        dqRoot={content.root}
        initialFlowTransform={content.transform}
        onChangeFlowTransform={handleChangeFlowTransform} />
    </div>
  );
};
DiagramToolComponent.displayName = "DiagramToolComponent";
