import React from "react";
import { observer } from "mobx-react";
import { DragEndEvent, useDndMonitor, useDroppable } from "@dnd-kit/core";

import { dataflowDroppableId, getNodeType, isNodeDraggableId } from "../dataflow-types";

interface IDataflowDropZoneProps {
  addNode: (nodeType: string) => void;
  children?: any;
  className?: string;
  style?: any;
  tileId: string;
}
export const DataflowDropZone = observer((
  { addNode, children, className, style, tileId }: IDataflowDropZoneProps
) => {

  const droppableId = dataflowDroppableId(tileId);
  const { isOver, setNodeRef } = useDroppable({ id: droppableId });
  const dropTargetStyle = {
    ...(style || {}),
    outline: isOver ? "2px solid #b7e2ec" : undefined
  };
  useDndMonitor({
    onDragEnd: (event: DragEndEvent) => {
      const draggableId = event.active.id.toString();
      if (event.over?.id === droppableId && isNodeDraggableId(draggableId)) {
        const nodeType = getNodeType(draggableId);
        // const pointerEvent = event.activatorEvent as PointerEvent;
        // const clientX = pointerEvent.clientX + event.delta.x;
        // const clientY = pointerEvent.clientY + event.delta.y;
        // const position = diagramHelper?.convertClientToDiagramPosition({x: clientX, y: clientY});
        // const { x, y } = position;
        if (nodeType) {
          addNode(nodeType);
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
