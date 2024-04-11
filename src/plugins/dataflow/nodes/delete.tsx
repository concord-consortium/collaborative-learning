import React, { useCallback, useRef } from "react";
import DeleteNodeIcon from "../assets/icons/delete-node.svg";
import { NodeEditorMST } from "./node-editor-mst";

// TODO: why is this imported here?
import "./controls/num-control.sass";
import { useStopEventPropagation } from "./controls/custom-hooks";

interface IProps {
  nodeId: string;
  editor: NodeEditorMST;
}

export const Delete = ({editor, nodeId}: IProps) => {

  // FIXME: for some reason onClick doesn't work on these buttons but onMouseDown does
  const handleClick = useCallback(() => {
    console.log("Delete.handleClick");
    editor.removeNodeAndConnections(nodeId);
  }, [editor, nodeId]);

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

