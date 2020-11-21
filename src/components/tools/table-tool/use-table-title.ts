import { useCallback, useEffect } from "react";
import { IDataSet } from "../../../models/data/data-set";
import { TableContentModelType } from "../../../models/tools/table/table-content";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { IGridContext, kControlsColumnWidth, TColumn } from "./grid-types";

interface IProps {
  gridContext: IGridContext;
  model: ToolTileModelType;
  dataSet: IDataSet;
  readOnly?: boolean;
  onRequestUniqueTitle?: () => string | undefined;
}
export const useTableTitle = ({ gridContext, model, dataSet, readOnly, onRequestUniqueTitle }: IProps) => {

  const getTitle = useCallback(() => dataSet.name, [dataSet.name]);

  const onBeginTitleEdit = () => {
    gridContext.onClearSelection();
    return !readOnly;
  };
  const onEndTitleEdit = (title?: string) => {
    const content = model.content as TableContentModelType;
    !readOnly && (title != null) && content.setTableName(title);
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
