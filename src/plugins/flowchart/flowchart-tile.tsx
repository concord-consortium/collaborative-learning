import { observer } from "mobx-react";
import React, { useId } from "react";
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
  // React Flow builds its element ids from flowId, so each instance (including read-only copies
  // and thumbnails of the same tile) needs its own.
  const flowId = useId();
  return (
    <div className="tile-content flowchart-tool">
      <BasicEditableTileTitle />
      <div className="flowchart-canvas">
        <ReactFlow
          id={flowId}
          nodes={kNodes}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          elementsSelectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          disableKeyboardA11y
          attributionPosition="bottom-left"
          // React Flow listens for these keys on the whole document and cancels their default
          // action, so a static canvas turns them all off.
          deleteKeyCode={null}
          selectionKeyCode={null}
          multiSelectionKeyCode={null}
          panActivationKeyCode={null}
          zoomActivationKeyCode={null}
        />
      </div>
    </div>
  );
});
FlowchartToolComponent.displayName = "FlowchartToolComponent";
