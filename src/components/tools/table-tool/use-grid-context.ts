import { useCallback, useMemo, useRef, useState } from "react";
import { DataGridHandle } from "react-data-grid";
import { IGridContext, TPosition } from "./grid-types";

export const useGridContext = (showRowLabels: boolean) => {
  const gridRef = useRef<DataGridHandle>(null);
  // this tracks ReactDataGrid's internal notion of the selected cell
  const selectedCell = useRef<TPosition>();
  // these are passed into ReactDataGrid as the ultimate source of truth
  const [selectedRows, setSelectedRows] = useState(() => new Set<React.Key>());
  const selectOneRow = useCallback((row: string) => setSelectedRows(new Set([row])), []);
  const clearRowSelection = useCallback(() => setSelectedRows(new Set([])), []);
  const clearCellSelection = useCallback(() => gridRef.current?.selectCell({ idx: -1, rowIdx: -1 }), []);
  const gridContext: IGridContext = useMemo(() => ({
          showRowLabels,
          onSelectOneRow: selectOneRow,
          onClearRowSelection: clearRowSelection,
          onClearCellSelection: clearCellSelection,
          onClearSelection: () => {
            clearRowSelection();
            clearCellSelection();
          }
        }), [clearCellSelection, clearRowSelection, selectOneRow, showRowLabels]);
  const onSelectedCellChange = useCallback((position: TPosition) => {
    selectedCell.current = position;
  }, []);
  const onSelectedRowsChange = useCallback((_rows: Set<React.Key>) => {
    setSelectedRows(_rows);
  }, []);
  return {
    ref: gridRef, selectedCell, selectedRows, gridContext, onSelectedCellChange, onSelectedRowsChange
  };
};
