import { useCallback, useMemo } from "react";
import { isDataColumn, kCellLineHeight, kControlsColumnWidth, kDefaultColumnWidth, kHeaderRowHeight, kTitlePadding,
  TColumn } from "./table-types";
import { measureTextLines } from "../hooks/use-measure-text";
import { IDataSet } from "../../../models/data/data-set";
import { IAttribute } from "../../../models/data/attribute";
import { defaultFont } from "../../constants";

interface IProps {
  readOnly?: boolean;
  columns: TColumn[];
  dataSet: IDataSet;
  measureColumnWidth: (attr: IAttribute) => number;
  rowChanges: number;
}
export const useTitleSize = ({ readOnly, columns, dataSet, measureColumnWidth, rowChanges }: IProps) => {
  const titleCellWidth = useMemo(() => {
    const columnWidth = (column: TColumn) => {
      if (!isDataColumn(column)) {
        return Math.max(+(column.width || kDefaultColumnWidth), column.maxWidth || kDefaultColumnWidth);
      } else {
        const attr = dataSet.attrFromID(column.key);
        return measureColumnWidth(attr);
      }
    };
    const getTitleCellWidthFromColumns = () => {
      return columns.reduce(
                      (sum, col, i) => sum + (i ? columnWidth(col) : 0),
                      1 - (readOnly ? 0 : kControlsColumnWidth));
    };
    rowChanges; // eslint-disable-line no-unused-expressions
    const widthFromColumns = getTitleCellWidthFromColumns();
    return widthFromColumns < kDefaultColumnWidth ? kDefaultColumnWidth : widthFromColumns;
  }, [readOnly, columns, dataSet, measureColumnWidth, rowChanges]);

  const getTitleHeight = useCallback(() => {
    const font = `700 ${defaultFont}`;
    const lines = measureTextLines(dataSet.name || 'Table 8', titleCellWidth - 2 * kTitlePadding, font);
    const calculatedHeight = lines * kCellLineHeight + 2 * kTitlePadding;
    return calculatedHeight > (kHeaderRowHeight + 2 * kTitlePadding) ? kHeaderRowHeight : calculatedHeight;
  }, [dataSet, titleCellWidth]);

  return { titleCellWidth, getTitleHeight };
};
