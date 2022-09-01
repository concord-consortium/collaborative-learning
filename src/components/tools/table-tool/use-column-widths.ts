import { isDataColumn, kControlsColumnWidth, kDefaultColumnWidth, TColumn } from "./table-types";
import { IDataSet } from "../../../models/data/data-set";
import { IAttribute } from "../../../models/data/attribute";

interface IProps {
  readOnly?: boolean;
  columns: TColumn[];
  dataSet: IDataSet;
  measureColumnWidth: (attr: IAttribute) => number;
}
export const useColumnWidths = ({ readOnly, columns, dataSet, measureColumnWidth }: IProps) => {
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

  const titleCellWidth = getTitleCellWidthFromColumns();

  return { titleCellWidth };
};
