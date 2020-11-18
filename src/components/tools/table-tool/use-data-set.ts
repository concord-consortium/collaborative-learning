import { useCallback, useRef, useState } from "react";
import { DataGridHandle } from "react-data-grid";
import { ICase, IDataSet } from "../../../models/data/data-set";
import { uniqueId, uniqueName } from "../../../utilities/js-utils";
import { IGridContext, kControlsColumnWidth, kRowHeight, TColumn, TPosition, TRow } from "./grid-types";
import { useColumnsFromDataSet } from "./use-columns-from-data-set";
import { useRowsFromDataSet } from "./use-rows-from-data-set";

const optimalTileRowHeight = (rowCount: number) => {
  const kPadding = 2 * 10;
  const kBorders = 4;
  return (rowCount + 2) * kRowHeight + kPadding + kBorders;
};

interface IUseDataSet {
  dataSet: IDataSet;
  readOnly: boolean;
  showRowLabels: boolean;
  setShowRowLabels: (show: boolean) => void;
  onRequestRowHeight: (options: { height?: number, deltaHeight?: number }) => void;
}
export const useDataSet = ({
  dataSet, readOnly, showRowLabels, setShowRowLabels, onRequestRowHeight
}: IUseDataSet) => {
  const gridRef = useRef<DataGridHandle>(null);
  const inputRowId = useRef(uniqueId());
  const selectedCell = useRef<TPosition>();
  const [selectedRows, setSelectedRows] = useState(() => new Set<React.Key>());
  const selectOneRow = useCallback((row: string) => setSelectedRows(new Set([row])), []);
  const clearRowSelection = useCallback(() => setSelectedRows(new Set([])), []);
  const clearCellSelection = useCallback(() => gridRef.current?.selectCell({ idx: -1, rowIdx: -1 }), []);
  const gridContext: IGridContext = {
          showRowLabels,
          onSelectOneRow: selectOneRow,
          onClearRowSelection: clearRowSelection,
          onClearCellSelection: clearCellSelection,
          onClearSelection: () => {
            clearRowSelection();
            clearCellSelection();
          }
        };
  const [tableTitle, setTableTitle] = useState(dataSet.name);
  const [columnChanges, setColumnChanges] = useState(0);
  const incColumnChanges = () => setColumnChanges(state => ++state);
  const [rowChanges, setRowChanges] = useState(0);
  const incRowChanges = () => setRowChanges(state => ++state);
  const onBeginTitleEdit = () => {
    gridContext.onClearSelection();
    return !readOnly;
  };
  const onEndTitleEdit = (title?: string) => {
    !readOnly && (title != null) && dataSet.setName(title);
  };
  const setColumnName = (column: TColumn, columnName: string) => {
    !readOnly && dataSet.setAttributeName(column.key, columnName);
    incColumnChanges();
  };
  const onAddColumn = () => {
    !readOnly && dataSet.addAttributeWithID({
                          id: uniqueId(),
                          name: uniqueName("y", (name: string) => !dataSet.attrFromName(name))
                        });
    incColumnChanges();
  };
  const onRemoveRow = (rowId: string) => {
    !readOnly && dataSet.removeCases([rowId]);
    incColumnChanges();
  };
  const { columns, onColumnResize } = useColumnsFromDataSet({
                                        gridContext, dataSet, readOnly, inputRowId: inputRowId.current, columnChanges,
                                        showRowLabels, setShowRowLabels, setColumnName, onAddColumn, onRemoveRow });
  const { rows, rowKeyGetter, rowClass } = useRowsFromDataSet({
                                            dataSet, readOnly, inputRowId: inputRowId.current,
                                            rowChanges, context: gridContext});
  const rowHeight = kRowHeight;
  const headerRowHeight = kRowHeight;
  const onSelectedCellChange = (position: TPosition) => {
    selectedCell.current = position;
  };
  const onSelectedRowsChange = (_rows: Set<React.Key>) => {
    setSelectedRows(_rows);
  };
  const onRowsChange = (_rows: TRow[]) => {
    // for now, assume that all changes are single cell edits
    const selectedCellRowIndex = selectedCell.current?.rowIdx;
    const selectedCellColIndex = selectedCell.current?.idx;
    const updatedRow = (selectedCellRowIndex != null) && (selectedCellRowIndex >= 0)
                        ? _rows[selectedCellRowIndex] : undefined;
    const updatedColumn = (selectedCellColIndex != null) && (selectedCellColIndex >= 0)
                            ? columns[selectedCellColIndex] : undefined;
    if (updatedRow && updatedColumn) {
      const updatedCaseValues: ICase[] = [{
        __id__: updatedRow.__id__,
        [updatedColumn.key]: updatedRow[updatedColumn.key]
      }];
      const inputRowIndex = _rows.findIndex(row => row.__id__ === inputRowId.current);
      if ((inputRowIndex >= 0) && (selectedCellRowIndex === inputRowIndex)) {
        dataSet.addCanonicalCasesWithIDs(updatedCaseValues);
        onRequestRowHeight({ height: optimalTileRowHeight(rows.length + 1) });
        inputRowId.current = uniqueId();
      }
      else {
        dataSet.setCanonicalCaseValues(updatedCaseValues);
      }
      incRowChanges();
    }
  };
  const handleColumnResize = useCallback((idx: number, width: number) => {
    onColumnResize(idx, width);
    incColumnChanges();
  }, [onColumnResize]);
  const kDefaultWidth = 80;
  const columnWidth = (column: TColumn) => {
    return Math.max(+(column.width || kDefaultWidth), column.maxWidth || kDefaultWidth);
  };
  const titleWidth = columns.reduce(
                              (sum, col, i) => sum + (i ? columnWidth(col) : 0),
                              1 - kControlsColumnWidth);
  return { ref: gridRef, tableTitle, setTableTitle, titleWidth, onBeginTitleEdit, onEndTitleEdit,
            columns, rows, rowKeyGetter, rowClass, rowHeight, headerRowHeight, selectedRows,
            onSelectedRowsChange, onSelectedCellChange, onColumnResize: handleColumnResize, onRowsChange };
};
