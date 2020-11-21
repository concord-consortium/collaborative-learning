import { useCallback, useEffect } from "react";
import { IDataSet } from "../../../models/data/data-set";
import { IGridContext, kControlsColumnWidth, TColumn } from "./grid-types";

interface IProps {
  gridContext: IGridContext;
  dataSet: IDataSet;
  readOnly?: boolean;
  onRequestUniqueTitle?: () => string | undefined;
}
export const useTableTitle = ({ gridContext, dataSet, readOnly, onRequestUniqueTitle }: IProps) => {

  const getTitle = useCallback(() => dataSet.name, [dataSet.name]);

  const onBeginTitleEdit = () => {
    gridContext.onClearSelection();
    return !readOnly;
  };
  const onEndTitleEdit = (title?: string) => {
    !readOnly && (title != null) && dataSet.setName(title);
  };

  const kDefaultWidth = 80;
  const columnWidth = (column: TColumn) => {
    return Math.max(+(column.width || kDefaultWidth), column.maxWidth || kDefaultWidth);
  };
  const getTitleWidthFromColumns = (columns: TColumn[]) => {
    return columns.reduce(
                    (sum, col, i) => sum + (i ? columnWidth(col) : 0),
                    1 - kControlsColumnWidth);
  };

  // request a default title if we don't already have one
  useEffect(() => {
    if (!dataSet.name) {
      // wait for all tiles to have registered their callbacks
      setTimeout(() => {
        const _title = onRequestUniqueTitle?.();
        if (_title) {
          dataSet.setName(_title);
        }
      }, 100);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { getTitle, getTitleWidthFromColumns, onBeginTitleEdit, onEndTitleEdit };
};
