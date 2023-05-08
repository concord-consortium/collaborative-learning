import React from "react";
import { DragOverlay, useDraggable, DragEndEvent, useDndMonitor, useDroppable } from "@dnd-kit/core";
import { observer } from "mobx-react";
import { NodeEditor } from "rete";

import { dataflowDroppableId, getNodeType, isNodeDraggableId } from "../dataflow-types";

interface IDataflowDropZoneProps {
  addNode: (nodeType: string, position?: [number, number]) => void;
  children?: any;
  className?: string;
  programEditor: NodeEditor;
  style?: any;
  tileId: string;
}
export const DataflowDropZone = observer((
  { addNode, children, className, programEditor, style, tileId }: IDataflowDropZoneProps
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
        const pointerEvent = event.activatorEvent as PointerEvent;
        const clientX = pointerEvent.clientX + event.delta.x;
        const clientY = pointerEvent.clientY + event.delta.y;
        const { x, y, k } = programEditor.view.area.transform;
        const boundingBox = programEditor.view.area.container.getBoundingClientRect();
        const rawX = clientX - boundingBox.x;
        const rawY = clientY - boundingBox.y;
        const position: [number, number] = [
          (rawX - x) / k,
          (rawY - y) / k
        ];
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
