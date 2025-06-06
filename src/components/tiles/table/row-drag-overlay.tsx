import React from "react";
import { TColumn, TRow } from "./table-types";

import "./table-tile.scss";

const kControlColumnWidth = 36; // Width of the controls column in pixels

interface IRowDragOverlayProps {
  row: TRow;
  columns: TColumn[];
}

export const RowDragOverlay = ({ row, columns }: IRowDragOverlayProps) => {
  const rowWidth = columns.reduce((sum, col) => sum + (Number(col.width) || 80), 0) - kControlColumnWidth;

  const rowStyle = { width: rowWidth };
  return (
    <div className="drag-overlay-row" style={rowStyle}>
      {columns
        .filter(col => col.key !== "__controls__") // skip the control column
        .map((col) => {
          const cellStyle = {width: col.width ?? 80};
          return(
            <span key={col.key} style={cellStyle} className="drag-overlay-cell">
              {row[col.key]}
            </span>
          );
        })}
    </div>
  );
};
