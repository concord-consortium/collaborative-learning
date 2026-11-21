import { observer } from "mobx-react";
import React from "react";
import { Node, ReactFlow } from "reactflow";
import { BasicEditableTileTitle } from "../../components/tiles/basic-editable-tile-title";
import { ITileProps } from "../../components/tiles/tile-component";
import "reactflow/dist/style.css";
import "./flowchart-tile.scss";

const kNodes: Node[] = [
  {
    id: "1",
    position: { x: 50, y: 50 },
    data: { label: "Step" },
    style: { width: 120, height: 60 }
  }
];

export const FlowchartToolComponent: React.FC<ITileProps> = observer(() => {
  return (
    <div className="tile-content flowchart-tool">
      <BasicEditableTileTitle />
      <div className="flowchart-canvas">
        <ReactFlow
          nodes={kNodes}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          attributionPosition="bottom-left"
        />
      </div>
    </div>
  );
});
FlowchartToolComponent.displayName = "FlowchartToolComponent";
