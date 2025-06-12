import { clsx } from "clsx";
import { observer } from "mobx-react-lite";
import React, { useEffect, useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import { kControlsColumnWidth } from "./table-types";
import { kTableRowDividerHeight } from "./use-row-label-column";

import "./table-tile.scss";

const kTableWidthOffset = 12; // Offset for the table width to account for borders and padding

interface IRowDividerProps {
  rowId: string;
  before?: boolean;
  topPosition: number;
  gridElement: HTMLDivElement | null;
  onDropRow?: (draggedRowId: string, targetRowId: string, before: boolean) => void;
  dragOverRowId?: string | null;
  setDragOverRowId: (rowId: string | null) => void;
}

export const RowDivider =
          observer(function RowDivider({ rowId, before = false, topPosition, gridElement, setDragOverRowId}: IRowDividerProps) {
  const droppableId = `${rowId}:${before ? "before" : "after"}`;
  const { over, isOver, setNodeRef: setDropRef } = useDroppable({ id: droppableId });

  useEffect(() => {
    over !== null && setDragOverRowId(String(over.id));
  }, [over]);

  return (
    <div ref={setDropRef} className={clsx("row-divider", { "over": isOver})}
          data-testid={`row-divider-${rowId}-${before ? "before" : "after"}`}
        style={{
          width: gridElement?.clientWidth ? gridElement?.clientWidth - kControlsColumnWidth - kTableWidthOffset : "100%",
          top: topPosition,
          height: kTableRowDividerHeight
        }}
      />
  );
});
