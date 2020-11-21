import { useCallback, useRef } from "react";
import { ICase, IDataSet } from "../../../models/data/data-set";
import { TableContentModelType } from "../../../models/tools/table/table-content";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { uniqueId, uniqueName } from "../../../utilities/js-utils";
import { IGridContext, kRowHeight, TColumn, TPosition, TRow } from "./grid-types";
import { useColumnsFromDataSet } from "./use-columns-from-data-set";
import { useRowsFromDataSet } from "./use-rows-from-data-set";

const optimalTileRowHeight = (rowCount: number) => {
  const kPadding = 2 * 10;
  const kBorders = 4;
  return (rowCount + 2) * kRowHeight + kPadding + kBorders;
};

interface IUseDataSet {
  gridContext: IGridContext;
  selectedCell: React.MutableRefObject<TPosition | undefined>;
  model: ToolTileModelType;
  dataSet: IDataSet;
  columnChanges: number;
  triggerColumnChange: () => void;
  rowChanges: number;
  readOnly: boolean;
  getTitleWidthFromColumns: (columns: TColumn[]) => number;
  showRowLabels: boolean;
  setShowRowLabels: (show: boolean) => void;
  onRequestRowHeight: (options: { height?: number, deltaHeight?: number }) => void;
}
export const useDataSet = ({
  gridContext, selectedCell, model, dataSet, columnChanges, triggerColumnChange, rowChanges,
  readOnly, showRowLabels, setShowRowLabels, getTitleWidthFromColumns, onRequestRowHeight
}: IUseDataSet) => {
  const inputRowId = useRef(uniqueId());
  const setColumnName = (column: TColumn, columnName: string) => {
    const content = model.content as TableContentModelType;
    !readOnly && content.setAttributeName(column.key, columnName);
  };
  const onAddColumn = () => {
    const content = model.content as TableContentModelType;
    !readOnly && content.addAttribute(uniqueId(), uniqueName("y", (name: string) => !dataSet.attrFromName(name)));
  };
  const onRemoveRow = (rowId: string) => {
    const content = model.content as TableContentModelType;
    !readOnly && content.removeCases([rowId]);
  };
  const { columns, onColumnResize } = useColumnsFromDataSet({
                                        gridContext, dataSet, readOnly, inputRowId: inputRowId.current, columnChanges,
                                        showRowLabels, setShowRowLabels, setColumnName, onAddColumn, onRemoveRow });
  const { rows, rowKeyGetter, rowClass } = useRowsFromDataSet({
                                            dataSet, readOnly, inputRowId: inputRowId.current,
                                            rowChanges, context: gridContext});
  const rowHeight = kRowHeight;
  const headerRowHeight = kRowHeight;
  const onRowsChange = (_rows: TRow[]) => {
    // for now, assume that all changes are single cell edits
    const content = model.content as TableContentModelType;
    const selectedCellRowIndex = selectedCell.current?.rowIdx;
    const selectedCellColIndex = selectedCell.current?.idx;
    const updatedRow = (selectedCellRowIndex != null) && (selectedCellRowIndex >= 0)
                        ? _rows[selectedCellRowIndex] : undefined;
    const updatedColumn = (selectedCellColIndex != null) && (selectedCellColIndex >= 0)
                            ? columns[selectedCellColIndex] : undefined;
    if (!readOnly && updatedRow && updatedColumn) {
      const updatedCaseValues: ICase[] = [{
        __id__: updatedRow.__id__,
        [updatedColumn.key]: updatedRow[updatedColumn.key]
      }];
      const inputRowIndex = _rows.findIndex(row => row.__id__ === inputRowId.current);
      if ((inputRowIndex >= 0) && (selectedCellRowIndex === inputRowIndex)) {
        content.addCanonicalCases(updatedCaseValues);
        onRequestRowHeight({ height: optimalTileRowHeight(rows.length + 1) });
        inputRowId.current = uniqueId();
      }
      else {
        content.setCanonicalCaseValues(updatedCaseValues);
      }
    }
  };
  const handleColumnResize = useCallback((idx: number, width: number) => {
    onColumnResize(idx, width);
    triggerColumnChange();
  }, [onColumnResize, triggerColumnChange]);
  const getTitleWidth = () => getTitleWidthFromColumns(columns);
  return { getTitleWidth, columns, rows, rowKeyGetter, rowClass, rowHeight, headerRowHeight,
            onColumnResize: handleColumnResize, onRowsChange };
};
