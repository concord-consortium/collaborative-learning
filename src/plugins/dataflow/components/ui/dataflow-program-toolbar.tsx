import React from "react";
import { DragEndEvent, DragOverlay, useDndMonitor, useDraggable, useDroppable } from "@dnd-kit/core";

import { kNewNodeButtonDraggableId, kNewNodeButtonDroppableId } from "../dataflow-types";
import { NodeType, NodeTypes } from "../../model/utilities/node";
import { useUIStore } from "../../../../hooks/use-stores";

import "./dataflow-program-toolbar.sass";

interface INodeIconProps {
  i: number;
  nodeType: string;
}
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
    <div className={iconClass}>
      {nodeIcons}
    </div>
  );
};

interface IAddNodeButtonProps {
  disabled: boolean;
  i: number;
  nodeType: string;
  onNodeCreateClick: (type: string) => void;
}
const AddNodeButton = ({ disabled, i, nodeType, onNodeCreateClick }: IAddNodeButtonProps) => {
  const ui = useUIStore();
  // const draggableId = `${kNewNodeButtonDraggableId}-${nodeType}-${tileId}`;
  const draggableId = `${kNewNodeButtonDraggableId}-${nodeType}`;
  const { attributes, listeners, setNodeRef } = useDraggable({ id: draggableId });

  const handleAddNodeButtonClick = () => { onNodeCreateClick(nodeType); };
  
  // Because the button is draggable, it can no longer be clicked.
  // Instead, we check to see if it's dropped on itself, and if it is we "click" it.
  // const droppableId = `${kNewNodeButtonDroppableId}-${nodeType}-${tileId}`;
  const droppableId = `${kNewNodeButtonDroppableId}-${nodeType}`;
  const droppableInfo = useDroppable({ id: droppableId });
  const setDroppableNodeRef = droppableInfo.setNodeRef;
  useDndMonitor({
    onDragEnd: (event: DragEndEvent) => {
      if (event.over?.id === droppableId && event.active.id === draggableId) {
        handleAddNodeButtonClick();
      }
    }
  });

  return (
    <div ref={setDroppableNodeRef}>
      <div ref={setNodeRef} {...attributes} {...listeners} >
        <button
          disabled={disabled}
          key={i}
          title={`Add ${nodeType} Block`}
          onClick={handleAddNodeButtonClick}
        >
          <NodeIcon i={i} nodeType={nodeType} />
          <div className="label">{nodeType}</div>
        </button>
      </div>
      <DragOverlay>
        { ui.dragId === draggableId.toString()
          ? <NodeIcon i={i} nodeType={nodeType} />
          : null }
      </DragOverlay>
    </div>
  );
};

interface IProps {
  onNodeCreateClick: (type: string) => void;
  onClearClick: () => void;
  isTesting: boolean;
  disabled: boolean;
}
export const DataflowProgramToolbar = ({ onNodeCreateClick, onClearClick, isTesting, disabled }: IProps) => (
  <div className="program-toolbar" data-test="program-toolbar">
    { NodeTypes.map((nt: NodeType, i: number) => (
      <AddNodeButton
        disabled={disabled}
        i={i}
        key={nt.name}
        nodeType={nt.name}
        onNodeCreateClick={onNodeCreateClick}
      />
    ))}
    { isTesting && <button className="qa" onClick={ onClearClick }>Clear</button> }
  </div>
);
