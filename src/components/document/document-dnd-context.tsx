import React from "react";
import {
  DndContext, DragEndEvent, DragStartEvent, PointerSensor, useSensor, useSensors
} from "@dnd-kit/core";

import { useUIStore } from "../../hooks/use-stores";

interface IDocumentDndContextProps {
  children: any;
}
export const DocumentDndContext = ({ children }: IDocumentDndContextProps) => {
  const ui = useUIStore();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 15
      }
    })
  );
  const onDragStart = (event: DragStartEvent) => ui.setDraggingId(event.active.id.toString());
  const onDragEnd = (event: DragEndEvent) => ui.setDraggingId(undefined);
  return (
    <DndContext onDragStart={onDragStart} onDragEnd={onDragEnd} sensors={sensors} >
      { children }
    </DndContext>
  );
};
