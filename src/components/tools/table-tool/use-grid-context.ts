import { useCallback, useMemo, useRef, useState } from "react";
import { CellNavigationMode, DataGridHandle } from "react-data-grid";
import { uniqueId } from "../../../utilities/js-utils";
import { IGridContext, TPosition } from "./grid-types";

export const useGridContext = (showRowLabels: boolean) => {
  const gridRef = useRef<DataGridHandle>(null);
  const inputRowId = useRef(uniqueId());
  const selectedCell = useRef<TPosition>({ rowIdx: -1, idx: -1 });
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
  const onSelectedRowsChange = useCallback((_rows: Set<React.Key>) => {
    _rows.delete(inputRowId.current);
    setSelectedRows(_rows);
  }, []);
  const cellNavigationMode: CellNavigationMode = "CHANGE_ROW";
  return {
    ref: gridRef, cellNavigationMode, inputRowId, selectedCell, selectedRows, gridContext, onSelectedRowsChange
  };
};
