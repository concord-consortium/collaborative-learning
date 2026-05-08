import React, { useCallback, useRef } from "react";
import DeleteNodeIcon from "../assets/icons/delete-node.svg";
import { useStopEventPropagation } from "./controls/custom-hooks";
import { ReteManager } from "./rete-manager";
import { handleBlockChildKeyDown } from "./dataflow-node";


interface IProps {
  nodeId: string;
  reteManager: ReteManager;
}

export const Delete = ({reteManager, nodeId}: IProps) => {

  const handleClick = useCallback(() => {
    reteManager.removeNodeAndConnections(nodeId);
  }, [reteManager, nodeId]);

  const buttonRef = useRef<HTMLButtonElement>(null);
  useStopEventPropagation(buttonRef, "pointerdown");
  return (
    <button
      type="button"
      className="close-node-button control-color control-color-hoverable"
      ref={buttonRef}
      tabIndex={-1}
      onClick={handleClick}
      onKeyDown={handleBlockChildKeyDown}
      aria-label="Delete Block"
      title="Delete Block"
    >
      <svg className="icon">
        <DeleteNodeIcon />
      </svg>
    </button>
  );
};
