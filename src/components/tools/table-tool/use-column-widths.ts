import { isDataColumn, kControlsColumnWidth, kDefaultColumnWidth, kHeaderCellHorizontalPadding,
  TColumn } from "./table-types";

interface IProps {
  readOnly?: boolean;
  getTitle: () => string | undefined;
  columns: TColumn[];
  measureText: (text: string) => number;
}
export const useColumnWidths = ({ readOnly, getTitle, columns, measureText }: IProps) => {

  const desiredTitleCellWidth = measureText(getTitle() || "Table 8") + kHeaderCellHorizontalPadding;

  const columnWidth = (column: TColumn) => {
    return Math.max(+(column.width || kDefaultColumnWidth), column.maxWidth || kDefaultColumnWidth);
  };
  const getTitleCellWidthFromColumns = () => {
    return columns.reduce(
                    (sum, col, i) => sum + (i ? columnWidth(col) : 0),
                    1 - (readOnly ? 0 : kControlsColumnWidth));
  };

  const titleCellWidthFromColumns = getTitleCellWidthFromColumns();
  let titleCellWidth = titleCellWidthFromColumns;
  // if necessary, increase width of columns to accommodate longer titles
  if (desiredTitleCellWidth > titleCellWidthFromColumns) {
    // distribute the additional width equally among the data columns
    const dataColumnCount = columns.reduce((count, col) => count + (isDataColumn(col) ? 1 : 0), 0);
    const widthAdjustment = (desiredTitleCellWidth - titleCellWidthFromColumns) / dataColumnCount;
    const roundedWidthAdjustment = Math.ceil(10 * widthAdjustment) / 10;
    columns.forEach((col, i) => isDataColumn(col) && (col.width = columnWidth(col) + roundedWidthAdjustment));
    titleCellWidth = getTitleCellWidthFromColumns();
  }

  return { columns, titleCellWidth };
};
