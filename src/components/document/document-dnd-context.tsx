import React from "react";
import {
  DndContext, DragEndEvent, DragStartEvent, PointerSensor, MouseSensor, useSensor, useSensors
} from "@dnd-kit/core";

import { useStores } from "../../hooks/use-stores";
import { urlParams } from "../../utilities/url-params";

interface IDocumentDndContextProps {
  children: any;
}
export const DocumentDndContext = ({ children }: IDocumentDndContextProps) => {

  const useMouseSensor = useSensor(MouseSensor);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3
      }
    }),
    // mouse sensor can be enabled for cypress tests, for instance
    urlParams.mouseSensor !== undefined ? useMouseSensor : null
  );
  // We use useStores instead of useUIStore because the ui store is not set up for some jest tests.
  const stores = useStores();
  const onDragStart = (event: DragStartEvent) => stores.persistentUi?.setDraggingId(event.active.id.toString());
  const onDragEnd = (event: DragEndEvent) => stores.persistentUi?.setDraggingId(undefined);
  return (
    <DndContext onDragStart={onDragStart} onDragEnd={onDragEnd} sensors={sensors} >
      { children }
    </DndContext>
  );
};
