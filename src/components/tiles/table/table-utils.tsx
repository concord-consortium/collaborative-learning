import { RowHeightArgs } from "react-data-grid";
import { kHeaderRowHeight, kRowHeight, TRow, TColumn } from "./table-types";
import { IAttribute } from "../../../models/data/attribute";
import { IDataSet } from "../../../models/data/data-set";

const kDefaultPadding = 10;
const kTableBorder = 2;

interface IGetTableContentHeight {
  getTitleHeight: () => number;
  hasExpressions?: boolean;
  headerHeight: () => number;
  padding?: number;
  readOnly?: boolean;
  rowHeight: (args: RowHeightArgs<TRow>) => number;
  rows: TRow[];
}
export const getTableContentHeight = (props: IGetTableContentHeight) => {
  const { rows, readOnly, padding } = props;
  const topHeight = getTableRowTop({ rowIndex: rows.length, ...props });
  const inputRows = readOnly ? 0 : 1;
  const _padding = padding ?? kDefaultPadding;
  return topHeight + inputRows * kRowHeight + kTableBorder + _padding;
};

interface IGetTableRowTop extends IGetTableContentHeight {
  rowIndex: number;
}
// Returns the y position with respect to the tile for the given row.
// If rowIndex is equal to the numbe of rows, will return the bottom of the last row.
export function getTableRowTop({
  getTitleHeight, hasExpressions, headerHeight, padding, rowHeight, rowIndex, rows
}: IGetTableRowTop) {
  const expressionRows = hasExpressions ? 1 : 0;
  const _padding = padding ?? kDefaultPadding;
  let rowHeights = 0;
  for (let i = 0; i < rowIndex && i < rows.length; i++) {
    const row = rows[i];
    rowHeights += rowHeight({ row, type: 'ROW' });
  }
  return _padding + kTableBorder + getTitleHeight() + headerHeight() +
    expressionRows * kHeaderRowHeight + rowHeights;
}

interface IGetTableColumnLeft {
  columnIndex: number;
  columns: TColumn[];
  dataSet: IDataSet;
  measureColumnWidth: (attr: IAttribute) => number;
  padding?: number;
}
export function getTableColumnLeft({
  columnIndex, columns, dataSet, measureColumnWidth, padding
}: IGetTableColumnLeft) {
  const _padding = padding ?? kDefaultPadding;
  let columnWidths = 0;
  for (let i = 0; i < columnIndex + 1 && i < columns.length; i++) {
    // columns includes the controls column at index 0 so we go to columnIndex + 1
    const column = columns[i];
    const colWidth = Number(column.width);
    if (isFinite(colWidth)) {
      columnWidths += colWidth;
    } else {
      const attribute = dataSet.attrFromID(columns[i].key);
      if (attribute) {
        columnWidths += measureColumnWidth(attribute);
      }
    }
  }
  return _padding + columnWidths;
}
