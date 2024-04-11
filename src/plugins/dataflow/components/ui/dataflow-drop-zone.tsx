import React from "react";
import { DragEndEvent, useDndMonitor, useDroppable } from "@dnd-kit/core";
import { observer } from "mobx-react";

import { dataflowDroppableId, getNodeType, isNodeDraggableId } from "../dataflow-types";
import { NodeEditorMST } from "../../nodes/node-editor-mst";

interface IDataflowDropZoneProps {
  addNode: (nodeType: string, position?: [number, number]) => void;
  children?: any;
  className?: string;
  programEditor: NodeEditorMST;
  readOnly?: boolean;
  style?: any;
  tileId: string;
}
export const DataflowDropZone = observer((
  { addNode, children, className, programEditor, readOnly, style, tileId }: IDataflowDropZoneProps
) => {

  const droppableId = dataflowDroppableId(tileId);
  const { isOver, setNodeRef } = useDroppable({ id: droppableId });
  const dropTargetStyle = {
    ...(style || {}),
    outline: isOver ? "2px solid #b7e2ec" : undefined
  };
  useDndMonitor({
    onDragEnd: (event: DragEndEvent) => {
      if (readOnly) return;
      const draggableId = event.active.id.toString();
      if (event.over?.id === droppableId && isNodeDraggableId(draggableId)) {
        const nodeType = getNodeType(draggableId);
        const pointerEvent = event.activatorEvent as PointerEvent;

        const clientX = pointerEvent.clientX + event.delta.x;
        const clientY = pointerEvent.clientY + event.delta.y;
        const reteArea = programEditor.area.area;

        // This was taken from Rete's Area.setPointerFrom
        const { x, y } = reteArea.content.getPointerFrom({clientX, clientY} as MouseEvent);
        const { k } = reteArea.transform;
        const position: [number, number] = [ x / k, y / k ];

        if (nodeType) {
          addNode(nodeType, position);
        }
      }
    }
  });

  return (
    <div className={`drop-target ${className}`} ref={setNodeRef} style={dropTargetStyle}>
      { children }
    </div>
  );
});
