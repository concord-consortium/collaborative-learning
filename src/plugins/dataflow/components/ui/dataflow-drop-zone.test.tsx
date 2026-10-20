import React from "react";
import { render } from "@testing-library/react";
import type { DragEndEvent } from "@dnd-kit/core";

import { ReadOnlyContext } from "../../../../components/document/read-only-context";
import { dataflowDroppableId, nodeDraggableId } from "../dataflow-types";
import { ReteManager } from "../../rete/rete-manager";
import { DataflowDropZone } from "./dataflow-drop-zone";

// dnd-kit's pointer sensors do not run in jsdom, so the monitor's onDragEnd is captured here and
// invoked directly. The guard under test runs before any of the geometry below it.
let onDragEnd: ((event: DragEndEvent) => void) | undefined;

jest.mock("@dnd-kit/core", () => ({
  useDroppable: () => ({ isOver: false, setNodeRef: jest.fn() }),
  useDndMonitor: (handlers: { onDragEnd: (event: DragEndEvent) => void }) => {
    onDragEnd = handlers.onDragEnd;
  }
}));

const kTileId = "tile1";

// Only the members the drop handler reaches after the guard.
const reteManagerStub = {
  area: { area: {
    content: { getPointerFrom: () => ({ x: 10, y: 20 }) },
    transform: { k: 1 }
  } }
} as unknown as ReteManager;

function dropNodeOnZone(readOnly: boolean) {
  const addNode = jest.fn();
  render(
    <ReadOnlyContext.Provider value={readOnly}>
      <DataflowDropZone addNode={addNode} reteManager={reteManagerStub} tileId={kTileId} />
    </ReadOnlyContext.Provider>
  );
  onDragEnd?.({
    active: { id: nodeDraggableId("Number", kTileId) },
    over: { id: dataflowDroppableId(kTileId) },
    activatorEvent: { clientX: 0, clientY: 0 },
    delta: { x: 0, y: 0 }
  } as unknown as DragEndEvent);
  return addNode;
}

describe("DataflowDropZone read-only state", () => {
  beforeEach(() => { onDragEnd = undefined; });

  it("ignores a dropped block when the document is read-only", () => {
    expect(dropNodeOnZone(true)).not.toHaveBeenCalled();
  });

  it("adds a dropped block when the document is editable", () => {
    expect(dropNodeOnZone(false)).toHaveBeenCalledWith("Number", [10, 20]);
  });
});
