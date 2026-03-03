import React, { useCallback, useRef } from "react";
import DeleteNodeIcon from "../assets/icons/delete-node.svg";
import { useStopEventPropagation } from "./controls/custom-hooks";
import { ReteManager } from "./rete-manager";


interface IProps {
  nodeId: string;
  reteManager: ReteManager;
}

export const Delete = ({reteManager, nodeId}: IProps) => {

  const handleClick = useCallback(() => {
    reteManager.removeNodeAndConnections(nodeId);
  }, [reteManager, nodeId]);

  const divRef = useRef<HTMLDivElement>(null);
  useStopEventPropagation(divRef, "pointerdown");
  return (
    <div className="close-node-button control-color control-color-hoverable"
      ref={divRef}
      onClick={handleClick} title={"Delete Block"}>
      <svg className="icon">
        <DeleteNodeIcon />
      </svg>
    </div>
  );
};
