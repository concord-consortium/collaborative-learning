import { useCallback, useRef } from "react";
import { DataGridHandle } from "react-data-grid";
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

const isCellSelectable = (position: TPosition, columns: TColumn[]) => {
  return (position.idx !== 0) && (position.idx !== columns.length - 1);
};

interface IUseDataSet {
  gridRef: React.RefObject<DataGridHandle>;
  gridContext: IGridContext;
  model: ToolTileModelType;
  dataSet: IDataSet;
  columnChanges: number;
  triggerColumnChange: () => void;
  rowChanges: number;
  readOnly: boolean;
  getTitleWidthFromColumns: (columns: TColumn[]) => number;
  showRowLabels: boolean;
  inputRowId: React.MutableRefObject<string>;
  setShowRowLabels: (show: boolean) => void;
  onRequestRowHeight: (options: { height?: number, deltaHeight?: number }) => void;
}
export const useDataSet = ({
  gridRef, gridContext, model, dataSet, columnChanges, triggerColumnChange, rowChanges,
  readOnly, inputRowId, showRowLabels, setShowRowLabels, getTitleWidthFromColumns, onRequestRowHeight
}: IUseDataSet) => {
  const selectedCell = useRef<TPosition>({ rowIdx: -1, idx: -1 });
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
  const onSelectedCellChange = (position: TPosition) => {
    const forward = (selectedCell.current.rowIdx < position.rowIdx) ||
                    ((selectedCell.current.rowIdx === position.rowIdx) &&
                      (selectedCell.current.idx < position.idx));
    selectedCell.current = position;

    if (!isCellSelectable(position, columns) && (columns.length > 2)) {
      let newPosition = { ...position };
      if (forward) {
        while (!isCellSelectable(newPosition, columns)) {
          // move from last cell to { -1, -1 }
          if ((newPosition.rowIdx >= rows.length) ||
              ((newPosition.rowIdx === rows.length - 1) && (newPosition.idx >= columns.length - 1))) {
            newPosition = { rowIdx: -1, idx: -1 };
          }
          // otherwise advance to next selectable cell
          else if (++newPosition.idx >= columns.length) {
            newPosition.idx = 1;
            ++newPosition.rowIdx;
          }
        }
      }
      else {  // backward
        while (!isCellSelectable(newPosition, columns)) {
          // move from first cell to { -1, -1 }
          if ((newPosition.rowIdx <= -1) || ((newPosition.rowIdx === 0) && (newPosition.idx < 1))) {
            newPosition = { rowIdx: -1, idx: -1 };
          }
          // otherwise move to previous selectable cell
          else if (--newPosition.idx < 1) {
            newPosition.idx = columns.length - 2;
            --newPosition.rowIdx;
          }
        }
      }
      if ((newPosition.rowIdx !== position.rowIdx) || (newPosition.idx !== position.idx)) {
        gridRef.current?.selectCell(newPosition);
      }
    }
  };


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
            onColumnResize: handleColumnResize, onRowsChange, onSelectedCellChange};
};
