import React, { useEffect, useRef } from "react";
import { DragOverlay, useDraggable } from "@dnd-kit/core";
import { getNodeType, isNodeDraggableId, nodeDraggableId } from "../dataflow-types";
import { NodeType, NodeTypes } from "../../model/utilities/node";
import { useUIStore } from "../../../../hooks/use-stores";
import { useRovingTabindex } from "../../../../hooks/use-roving-tabindex";
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
  onActivate: () => void;
}
const AddNodeButton = ({
  disabled, i, nodeType, nodeDisplayName, onNodeCreateClick, tileId, onActivate,
}: IAddNodeButtonProps) => {
  const draggableId = nodeDraggableId(nodeType, tileId);
  const { attributes, listeners, setNodeRef } = useDraggable({ id: draggableId });

  const handleAddNodeButtonClick = () => {
    onNodeCreateClick(nodeType);
    onActivate();
  };

  // dnd-kit's useDraggable adds attributes (incl. role="button" and tabIndex) to the wrapper.
  // The actual focus target is the inner <button>, so we strip dnd-kit's role/tabindex from
  // the wrapper to avoid two focus stops per palette item and to keep the roving tabindex
  // hook (which queries `<button>` descendants) authoritative.
  const { tabIndex: _ignoredTabIndex, role: _ignoredRole, ...wrapperAttrs } = attributes;

  return (
    <div ref={setNodeRef} {...wrapperAttrs} {...listeners}>
      <button
        disabled={disabled}
        key={i}
        aria-label={`Add ${nodeDisplayName ?? nodeType} block`}
        title={`Add ${nodeDisplayName ?? nodeType} Block`}
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
  const containerRef = useRef<HTMLElement>(null);
  const { handleKeyDown } = useRovingTabindex(containerRef, "vertical");

  // Live region for "Added X block" announcements. Lives inside the toolbar nav
  // because the assistive tech is interacting with this region. Clear-then-set
  // with a 150ms gap (long enough for SR pollers ~100-150ms to observe the
  // empty state) so identical back-to-back messages are still re-announced.
  const announcerRef = useRef<HTMLDivElement>(null);
  const announceTimeoutRef = useRef<number | null>(null);
  const announce = (text: string) => {
    if (!announcerRef.current) return;
    if (announceTimeoutRef.current !== null) {
      window.clearTimeout(announceTimeoutRef.current);
    }
    announcerRef.current.textContent = "";
    announceTimeoutRef.current = window.setTimeout(() => {
      announceTimeoutRef.current = null;
      if (announcerRef.current) announcerRef.current.textContent = text;
    }, 150);
  };
  useEffect(() => () => {
    if (announceTimeoutRef.current !== null) {
      window.clearTimeout(announceTimeoutRef.current);
    }
  }, []);

  let dragOverlay = null;
  if (ui.dragId && isNodeDraggableId(ui.dragId)) {
    dragOverlay = (
      <div className="dragged-node">
        <NodeIcon i={0} nodeType={getNodeType(ui.dragId) || ""} />
      </div>
    );
  }

  return (
    <nav
      ref={containerRef}
      className="program-toolbar"
      role="toolbar"
      aria-orientation="vertical"
      aria-label="Add block"
      data-test="program-toolbar"
      onKeyDown={handleKeyDown}
    >
      { NodeTypes.map((nt: NodeType, i: number) => (
        <AddNodeButton
          disabled={disabled}
          i={i}
          key={nt.name}
          nodeType={nt.name}
          nodeDisplayName={nt.displayName}
          onNodeCreateClick={onNodeCreateClick}
          tileId={tileId}
          onActivate={() => announce(`Added ${nt.displayName ?? nt.name} block`)}
        />
      ))}
      {<DragOverlay dropAnimation={null}>{ dragOverlay }</DragOverlay> }
      { isTesting && (
        <button className="qa" onClick={onClearClick} aria-label="Clear program">Clear</button>
      ) }
      <div ref={announcerRef} aria-live="polite" className="visually-hidden" />
    </nav>
  );
};
