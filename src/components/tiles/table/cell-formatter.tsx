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
    // There are cases where value is not a string, or a valid number.
    // Currently one way for this to happen is when a formula is applied to a string
    // instead of a number. That results in a NaN value. This specific case should
    // be expected and not trigger a console.error, but there have been other cases
    // that couldn't be replicated. Hopefully we can deal with the NaN formula value
    // before it gets to this point. And then this error will only be triggered on
    // the other cases that we can't reproduce yet.
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
