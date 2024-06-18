import React from "react";
import { DragOverlay, useDraggable } from "@dnd-kit/core";
import { getNodeType, isNodeDraggableId, nodeDraggableId } from "../dataflow-types";
import { NodeType, NodeTypes } from "../../model/utilities/node";
import { useUIStore } from "../../../../hooks/use-stores";
import { getNodeLetter } from "../../nodes/utilities/view-utilities";

import "./dataflow-program-toolbar.scss";


interface INodeIconProps {
  i: number;
  nodeType: string;
  nodeDisplayName?: string;
}

const NodeIcon = ({ i, nodeType, nodeDisplayName }: INodeIconProps) => {
  const iconClass = "icon-block " + nodeType.toLowerCase().replace(" ", "-");
  const iconDisplayName = nodeDisplayName ?? nodeType;
  const nodeIcons = [];
  const nodeLetter = getNodeLetter(nodeType);

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
      <div className="node-icon-letter">{ nodeLetter }</div>
      <div className="label">{iconDisplayName}</div>
    </div>
  );
};

interface IAddNodeButtonProps {
  disabled: boolean;
  i: number;
  nodeType: string;
  nodeDisplayName?: string;
  onNodeCreateClick: (type: string) => void;
  tileId: string;
}
const AddNodeButton = ({ disabled, i, nodeType, nodeDisplayName, onNodeCreateClick, tileId }: IAddNodeButtonProps) => {
  const draggableId = nodeDraggableId(nodeType, tileId);
  const { attributes, listeners, setNodeRef } = useDraggable({ id: draggableId });

  const handleAddNodeButtonClick = () => { onNodeCreateClick(nodeType); };

  return (
    <div ref={setNodeRef} {...attributes} {...listeners} >
      <button
        disabled={disabled}
        key={i}
        title={`Add ${nodeDisplayName} Block`}
        onClick={handleAddNodeButtonClick}
        data-testid={`add-${nodeType.toLowerCase().replace(" ", "-")}-button`}
      >
        <NodeIcon i={i} nodeType={nodeType} nodeDisplayName={nodeDisplayName} />
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
          nodeDisplayName={nt.displayName}
          onNodeCreateClick={onNodeCreateClick}
          tileId={tileId}
        />
      ))}
      {<DragOverlay dropAnimation={null}>{ dragOverlay }</DragOverlay> }
      { isTesting && <button className="qa" onClick={ onClearClick }>Clear</button> }
    </div>
  );
};
