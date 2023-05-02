import React from "react";
import { DragOverlay, useDraggable } from "@dnd-kit/core";

import { getNodeType, isNodeDraggableId, nodeDraggableId } from "../dataflow-types";
import { NodeType, NodeTypes } from "../../model/utilities/node";
import { useUIStore } from "../../../../hooks/use-stores";

import "./dataflow-program-toolbar.scss";

interface INodeIconProps {
  i: number;
  nodeType: string;
}

//this is just the circle node icon to the right
const NodeIcon = ({ i, nodeType }: INodeIconProps) => {
  const iconClass = "icon-block " + nodeType.toLowerCase().replace(" ", "-");
  const nodeIcons = [];
  switch (nodeType) {
    case "Number":
    case "Sensor":
    case "Generator":
    case "Timer":
      nodeIcons.push(<div className="icon-node right mid" key={"icon-node-r-m" + i}/>);
      break;
    case "Math":
    case "Logic":
    case "Control":
      nodeIcons.push(<div className="icon-node left top" key={"icon-node-l-t" + i}/>);
      nodeIcons.push(<div className="icon-node right mid" key={"icon-node-r-m" + i}/>);
      nodeIcons.push(<div className="icon-node left bottom" key={"icon-node-l-b" + i}/>);
      break;
    case "Transform":
      nodeIcons.push(<div className="icon-node left mid" key={"icon-node-l-m" + i}/>);
      nodeIcons.push(<div className="icon-node right mid" key={"icon-node-r-m" + i}/>);
      break;
    case "Demo Output":
    case "Live Output":
      nodeIcons.push(<div className="icon-node left mid" key={"icon-node-l-m" + i}/>);
      break;
  }
  return (
    <div className="node-icon">
      <div className={iconClass}>
        {nodeIcons}
      </div>
      <div className="label">{nodeType}</div>
    </div>
  );
};

interface IAddNodeButtonProps {
  disabled: boolean;
  i: number;
  nodeType: string;
  onNodeCreateClick: (type: string) => void;
  tileId: string;
}
const AddNodeButton = (props: IAddNodeButtonProps) => {
  const { disabled, i, nodeType, onNodeCreateClick, tileId } = props;

  console.log("📁 dataflow-program-toolbar.tsx > \n\t 🔨 addNodeButton  >  props:", props);

  const draggableId = nodeDraggableId(nodeType, tileId);
  const { attributes, listeners, setNodeRef } = useDraggable({ id: draggableId });

  const handleAddNodeButtonClick = () => { onNodeCreateClick(nodeType); };

  return (
    <div ref={setNodeRef} {...attributes} {...listeners} >
      <button
        disabled={disabled}
        key={i}
        title={`Add ${nodeType} Block`}
        onClick={handleAddNodeButtonClick}
      >
        <NodeIcon i={i} nodeType={nodeType} />
      </button>
    </div>
  );
};

interface IProps {
  disabled: boolean;
  isTesting: boolean;
  onClearClick: () => void;
  onNodeCreateClick: (type: string) => void;
  tileId: string;
}
export const DataflowProgramToolbar = ({ disabled, isTesting, onClearClick, onNodeCreateClick, tileId }: IProps) => {
  const ui = useUIStore();
  let dragOverlay = null;
  if (ui.dragId && isNodeDraggableId(ui.dragId)) {
    dragOverlay = (
      <div className="dragged-node">
        <NodeIcon i={0} nodeType={getNodeType(ui.dragId) || ""} />
      </div>
    );
  }

  return (
    <div className="program-toolbar" data-test="program-toolbar">
      { NodeTypes.map((nt: NodeType, i: number) => (
        <AddNodeButton
          disabled={disabled}
          i={i}
          key={nt.name}
          nodeType={nt.name}
          onNodeCreateClick={onNodeCreateClick}
          tileId={tileId}
        />
      ))}
      <DragOverlay>
        { dragOverlay }
      </DragOverlay>
      { isTesting && <button className="qa" onClick={ onClearClick }>Clear</button> }
    </div>
  );
};
