import React from "react";
import { CalculatedColumn, RowHeightArgs } from "react-data-grid";
import { kCellHorizontalPadding, kDefaultColumnWidth, kRowHeight, TRow } from "./table-types";
import { useNumberFormat } from "./use-number-format";
import { gImageMap } from "../../../models/image-map";

import './cell-formatter.scss';

export const formatValue = (
    formatter: (n: number | { valueOf(): number }) => string,
    value: unknown,
    lookupImage: (value: string) => string|undefined,
    width?: number,
    row?: TRow,
    rowHeight?: (args: any) => number,
  ) => {
  if ((value == null) || (value === "")) return <span></span>;
  const num = Number(value);
  if (!isFinite(num)) {
    // There have been cases where value is not a string, or a valid number.
    // The cases couldn't be reproduced, so hopefully this will help us track
    // them down.
    if (typeof value !== "string") {
      console.error("Unknown cell value", value);
      return <span>[error]</span>;
    }
    const cellWidth = (width || kDefaultColumnWidth) - kCellHorizontalPadding;
    const height = rowHeight && row ? rowHeight({ row }) : kRowHeight;
    if (gImageMap.isImageUrl(value)) {
      const url = lookupImage(value);
      if (url) {
        return (
          <div className="image-cell" style={{ height, width: cellWidth}}>
            <img src={url}></img>
          </div>
        );
      }
      return (<span>[loading...]</span>);
    }
    return (
      <div className="text-cell" style={{ height, width: cellWidth }}>
        {value}
      </div>
    );
  }
  return <span>{formatter(num)}</span>;
};

interface CellFormatterProps {
  row: TRow;
  column: CalculatedColumn<TRow, any>;
}
export const getCellFormatter = (width: number, rowHeight: (args: RowHeightArgs<TRow>) => number,
                                lookupImage: (value:string)=>string|undefined) => {
  return ({ row, column }: CellFormatterProps) => {
    const formatter = useNumberFormat();
    return formatValue(formatter, row[column.key], lookupImage, width, row, rowHeight);
  };
};
