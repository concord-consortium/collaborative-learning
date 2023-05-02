import React from "react";
import { DragEndEvent, useDndMonitor, useDroppable } from "@dnd-kit/core";
import { observer } from "mobx-react";
import { NodeEditor } from "rete";
import { dataCardDroppableId,
  // getNodeType, isNodeDraggableId
} from "./data-card-types";


interface IDataflowDropZoneProps {
  // addNode: (nodeType: string, position?: [number, number]) => void;
  children?: any;
  className?: string;
  // programEditor: NodeEditor;
  style?: any;
  tileId: string;
}
export const DataCardDropZone = observer((
  {
    // addNode,
    children,
    className,
    // programEditor,
    style,
    tileId
  }: IDataflowDropZoneProps
) => {
  // console.log("📁 dataCARD-drop-zone.tsx > \n\t 🔨DataCARDDropZone >  \n\t\t 🍔 tileId:", tileId);

  const droppableId = dataCardDroppableId(tileId);
  const { isOver, setNodeRef } = useDroppable({ id: droppableId });
  // console.log("📁 dataCARD-drop-zone.tsx > \n\t 🔨DataCARDDropZone >  \n\t\t 🍔 ISOVER?:", isOver);


  //added
  if (isOver){
    // console.log("📁 dataCARD-drop-zone.tsx > 🔨 DataCARDDropZone >  🍔 isOver?:", isOver);

  }

  const dropTargetStyle = {
    ...(style || {}),
    outline: isOver ? "2px solid #b7e2ec" : undefined
  };
  useDndMonitor({
    onDragEnd: (event: DragEndEvent) => {
      // console.log("📁 dataflow-drop-zone.tsx > 🔨 DataCARDDropZone > 🔨useDndMonitor > 🔨 onDragEnd:");3
      const draggableId = event.active.id.toString();
      if (event.over?.id === droppableId) { //old
        // console.log("is droppable? yes");

      }
    }
  });

  return (
    <div className={`drop-target ${className}`} ref={setNodeRef} style={dropTargetStyle}>
      { children }
    </div>
  );
});
