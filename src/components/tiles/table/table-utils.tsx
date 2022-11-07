import { RowHeightArgs } from "react-data-grid";
import { kHeaderRowHeight, kRowHeight, TRow } from "./table-types";

interface IGetTableContentHeight {
  rows: TRow[];
  rowHeight: (args: RowHeightArgs<TRow>) => number;
  headerHeight: () => number;
  getTitleHeight: () => number;
  readOnly?: boolean;
  hasExpressions?: boolean;
  padding?: number;
}
export const getTableContentHeight = ({
  rows, rowHeight, headerHeight, getTitleHeight, readOnly, hasExpressions, padding
}: IGetTableContentHeight) => {
  const kDefaultPadding = 10;
  const expressionRows = hasExpressions ? 1 : 0;
  const inputRows = readOnly ? 0 : 1;
  const kBorders = 2 * 2;
  const _padding = 2 * (padding || kDefaultPadding);
  let rowHeights = 0;
  rows.forEach(row => {
    rowHeights += rowHeight({ row, type: 'ROW' });
  });
  return getTitleHeight() + headerHeight() + expressionRows * kHeaderRowHeight + inputRows * kRowHeight
    + rowHeights + kBorders + _padding;
};
