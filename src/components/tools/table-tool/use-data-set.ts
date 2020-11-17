import { useCallback, useRef, useState } from "react";
import { DataGridHandle } from "react-data-grid";
import { IDataSet } from "../../../models/data/data-set";
import { IGridContext, kRowHeight, TColumn, TRow } from "./grid-types";
import { useColumnsFromDataSet } from "./use-columns-from-data-set";
import { useRowsFromDataSet } from "./use-rows-from-data-set";

export const useDataSet = (dataSet: IDataSet, showRowLabels: boolean, setShowRowLabels: (show: boolean) => void) => {
  const gridRef = useRef<DataGridHandle>(null);
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
  };
  const onEndTitleEdit = (title?: string) => {
    (title != null) && dataSet.setName(title);
  };
  const setColumnName = (column: TColumn, columnName: string) => {
    dataSet.setAttributeName(column.key, columnName);
    incColumnChanges();
  };
  const { columns, onColumnResize } = useColumnsFromDataSet({
                                        gridContext, dataSet, columnChanges, showRowLabels, setShowRowLabels,
                                        setColumnName });
  const rows = useRowsFromDataSet(dataSet, rowChanges, gridContext);
  const rowKeyGetter = (row: TRow) => row.__id__;
  const rowHeight = kRowHeight;
  const headerRowHeight = kRowHeight;
  const onRowsChange = (_rows: TRow[]) => {
    if (_rows.length) {
      dataSet.setCanonicalCaseValues(_rows);
      incRowChanges();
    }
  };
  const onSelectedRowsChange = (_selectedRows: Set<React.Key>) => {
    setSelectedRows(_selectedRows);
  };
  const handleColumnResize = useCallback((idx: number, width: number) => {
    onColumnResize(idx, width);
    incColumnChanges();
  }, [onColumnResize]);
  const kMinWidth = 80;
  const titleWidth = columns.reduce((sum, col, i) => sum + (i ? Math.max(+(col.width || kMinWidth), kMinWidth) : 0), 1);
  return { ref: gridRef, tableTitle, setTableTitle, titleWidth, onBeginTitleEdit, onEndTitleEdit,
            columns, rows, rowKeyGetter, rowHeight, headerRowHeight, selectedRows,
            onColumnResize: handleColumnResize, onRowsChange, onSelectedRowsChange };
};
