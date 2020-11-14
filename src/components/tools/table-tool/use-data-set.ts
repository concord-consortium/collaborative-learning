import { useCallback, useState } from "react";
import { IDataSet } from "../../../models/data/data-set";
import { IGridContext, TRow } from "./grid-types";
import { useColumnsFromDataSet } from "./use-columns-from-data-set";
import { useRowsFromDataSet } from "./use-rows-from-data-set";

export const useDataSet = (dataSet: IDataSet, showRowLabels: boolean, setShowRowLabels: (show: boolean) => void) => {
  const { name } = dataSet;
  const [columnChanges, setColumnChanges] = useState(0);
  const incColumnChanges = () => setColumnChanges(state => ++state);
  const [rowChanges, setRowChanges] = useState(0);
  const incRowChanges = () => setRowChanges(state => ++state);
  const { columns, onColumnResize } = useColumnsFromDataSet(dataSet, columnChanges, showRowLabels, setShowRowLabels);
  const [selectedRows, setSelectedRows] = useState(() => new Set<React.Key>());
  const selectOneRow = useCallback((row: string) => setSelectedRows(new Set([row])), []);
  const clearRowSelection = useCallback(() => setSelectedRows(new Set([])), []);
  const gridContext: IGridContext = {
          showRowLabels,
          onSelectOneRow: selectOneRow,
          onClearRowSelection: clearRowSelection
        };
  const rows = useRowsFromDataSet(dataSet, rowChanges, gridContext);
  const rowKeyGetter = (row: TRow) => row.__id__;
  const rowHeight = 34;
  const headerRowHeight = rowHeight;
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
  return { name, titleWidth, columns, rows, rowKeyGetter, rowHeight, headerRowHeight,
            selectedRows, onColumnResize: handleColumnResize, onRowsChange, onSelectedRowsChange };
};
