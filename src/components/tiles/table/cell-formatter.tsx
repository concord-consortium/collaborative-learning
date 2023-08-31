import React from "react";
import { CalculatedColumn, RowHeightArgs } from "react-data-grid";
import { kCellHorizontalPadding, kDefaultColumnWidth, kRowHeight, TRow } from "./table-types";
import { useNumberFormat } from "./use-number-format";

import './cell-formatter.scss';

export const formatValue = (
  formatter: (n: number | { valueOf(): number }) => string,
  value: any,
  width?: number,
  row?: TRow,
  rowHeight?: (args: any) => number,
  isImg?: boolean
) => {

  // empty value
  if (value == null || value === "") {
    return <span></span>;
  }

  // string or number value
  else {
    const num = Number(value);
    // string value that may be an image url
    if (!isFinite(num)) {

      // image url
      const regex = /^ccimg:\/\//;
      const isReallyUrl = regex.test(value);

      const cellWidth = (width || kDefaultColumnWidth) - kCellHorizontalPadding;
      const height = rowHeight && row ? rowHeight({ row }) : kRowHeight;

      // POC - problem is the cell height is still being calculated based on the length of the actual value
      if (isReallyUrl){
        return (
          <div>
            <img src="https://placehold.co/600x400" height="30"></img>
          </div>
        );
      }

      // not image url, just a string
      return (
        <div className="text-cell" style={{ height, width: cellWidth }}>
          {value}
        </div>
      );
    }
    // number value
    else {
      return <span>{formatter(num)}</span>;
    }
  }
};

interface CellFormatterProps {
  row: TRow;
  column: CalculatedColumn<TRow, any>;
}
export const getCellFormatter = (width: number, rowHeight: (args: RowHeightArgs<TRow>) => number) => {
  return ({ row, column }: CellFormatterProps) => {
    const formatter = useNumberFormat();
    return formatValue(formatter, row[column.key], width, row, rowHeight);
  };
};
