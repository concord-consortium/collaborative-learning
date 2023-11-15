import React from "react";
import classNames from "classnames";
import { CalculatedColumn, RowHeightArgs } from "react-data-grid";

import { IDataSet } from "../../../models/data/data-set";
import { gImageMap } from "../../../models/image-map";
import { kCellHorizontalPadding, kDefaultColumnWidth, kRowHeight, TRow } from "./table-types";
import { useNumberFormat } from "./use-number-format";

import './cell-formatter.scss';

interface IFormatValueProps {
  column?: CalculatedColumn<TRow, any>;
  dataSet?: IDataSet;
  formatter: (n: number | { valueOf(): number }) => string;
  isLinked?: boolean;
  lookupImage: (value: string) => string|undefined;
  row?: TRow;
  rowHeight?: (args: any) => number;
  value: unknown;
  width?: number;
}
export const formatValue = ({
  column, dataSet, formatter, isLinked, lookupImage, row, rowHeight, value, width
}: IFormatValueProps) => {
  const cell = { attributeId: column?.key ?? "", caseId: row?.__id__ ?? "" };
  const cellSelected = dataSet?.isCellSelected(cell);
  const baseClasses = classNames("cell", { highlighted: cellSelected, linked: isLinked });
  function handleClick() {
    if (!cellSelected) {
      dataSet?.setSelectedCells([cell]);
    }
  }
  if ((value == null) || (value === "")) return <div className={baseClasses} onClick={handleClick}></div>;

  // Print NaN, Infinity, or -Infinity if we receive them.
  // NaN can happen when a formula is applied to something not a number
  // When saved, the NaN is turned into a blank value, so it won't be seen after
  // reload. In the case of invalid formula we should probably provide an error
  // message instead of just showing NaN. Hopefully we can bring in CODAPs new
  // formula engine and that will help with this.
  // We make sure the type of the value is a number otherwise basic strings like
  // "a" would get handled by this.
  if (typeof value === "number" && !isFinite(value)) {
    return <div className={baseClasses} onClick={handleClick}>{value.toString()}</div>;
  }

  const num = Number(value);
  if (!isFinite(num)) {
    // There have been cases where value is not a string, or a valid number.
    // NaN, Infinity, and -Infinity are handled above.
    // But because the type of value is unknown it is in theory possible for
    // objects or arrays to be passed in.
    if (typeof value !== "string") {
      console.error("Unknown cell value", value);
      return <div className={baseClasses} onClick={handleClick}>[error]</div>;
    }
    const cellWidth = (width || kDefaultColumnWidth) - kCellHorizontalPadding;
    const height = rowHeight && row ? rowHeight({ row }) : kRowHeight;
    if (gImageMap.isImageUrl(value)) {
      const url = lookupImage(value);
      if (url) {
        return (
          <div className={`image-cell ${baseClasses}`} onClick={handleClick} style={{ height, width: cellWidth}}>
            <img src={url}></img>
          </div>
        );
      }
      return (<span>[loading...]</span>);
    }
    return (
      <div className={`text-cell ${baseClasses}`} onClick={handleClick}>
        {value}
      </div>
    );
  }
  return <div className={baseClasses} onClick={handleClick}>{formatter(num)}</div>;
};

interface CellFormatterProps {
  row: TRow;
  column: CalculatedColumn<TRow, any>;
}
interface IGetCellFormatterProps {
  dataSet: IDataSet;
  isLinked?: boolean;
  lookupImage: (value: string) => string|undefined;
  rowHeight: (args: RowHeightArgs<TRow>) => number;
  width: number;
}
export const getCellFormatter = ({ dataSet, isLinked, lookupImage, rowHeight, width }: IGetCellFormatterProps) => {
  return ({ row, column }: CellFormatterProps) => {
    const formatter = useNumberFormat();
    return formatValue({
      column, dataSet, formatter, isLinked, lookupImage, row, rowHeight, value: row[column.key], width
    });
  };
};
