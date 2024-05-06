import React, { useCallback, useRef } from "react";
import DeleteNodeIcon from "../assets/icons/delete-node.svg";
import { useStopEventPropagation } from "./controls/custom-hooks";
import { ReteManager } from "./rete-manager";


interface IProps {
  nodeId: string;
  reteManager: ReteManager;
}

export const Delete = ({reteManager, nodeId}: IProps) => {

  // FIXME: for some reason onClick doesn't work on these buttons but onMouseDown does
  const handleClick = useCallback(() => {
    reteManager.removeNodeAndConnections(nodeId);
  }, [reteManager, nodeId]);

  const inputRef = useRef<HTMLInputElement>(null);
  useStopEventPropagation(inputRef, "pointerdown");
  return (
    <div className="close-node-button control-color control-color-hoverable"
      onMouseDown={handleClick} title={"Delete Block"}>
      <svg className="icon">
        <DeleteNodeIcon />
      </svg>
    </div>
  );
};

