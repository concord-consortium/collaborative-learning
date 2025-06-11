import React from "react";
import { RowHeightArgs } from "react-data-grid";
import { TColumn, TRow, kControlsColumnKey } from "./table-types";
import { kTableDefaultHeight } from "../../../models/tiles/table/table-content";

import "./table-tile.scss";

const kControlColumnWidth = 36; // Width of the controls column in pixels

interface IRowDragOverlayProps {
  row: TRow;
  columns: TColumn[];
  rowHeight: (args: RowHeightArgs<TRow>) => number;
}

export const RowDragOverlay = ({ row, columns, rowHeight }: IRowDragOverlayProps) => {
  const rowWidth = columns.reduce((sum, col) => sum + (Number(col.width) || 80), 0) - kControlColumnWidth;
  const height = row && rowHeight ? rowHeight({ row, type: "ROW" }) : kTableDefaultHeight;

  const rowStyle = { width: rowWidth, height };
  return (
    <div className="drag-overlay-row" style={rowStyle}>
      {columns
        .filter(col => col.key !== kControlsColumnKey) // skip the control column
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
