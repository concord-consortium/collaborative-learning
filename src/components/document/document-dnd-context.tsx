import React from "react";
import {
  DndContext, DragEndEvent, DragStartEvent, PointerSensor, useSensor, useSensors
} from "@dnd-kit/core";

import { useStores } from "../../hooks/use-stores";

interface IDocumentDndContextProps {
  children: any;
}
export const DocumentDndContext = ({ children }: IDocumentDndContextProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3
      }
    })
  );
  // We use useStores instead of useUIStore because the ui store is not set up for some jest tests.
  const stores = useStores();
  const onDragStart = (event: DragStartEvent) => stores.ui?.setDraggingId(event.active.id.toString());
  const onDragEnd = (event: DragEndEvent) => stores.ui?.setDraggingId(undefined);
  return (
    <DndContext onDragStart={onDragStart} onDragEnd={onDragEnd} sensors={sensors} >
      { children }
    </DndContext>
  );
};
