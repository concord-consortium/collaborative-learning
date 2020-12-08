import { useCallback, useMemo, useRef, useState } from "react";
import { CellNavigationMode, DataGridHandle } from "react-data-grid";
import { useCurrent } from "../../../hooks/use-current";
import { uniqueId } from "../../../utilities/js-utils";
import { IGridContext, TPosition } from "./table-types";

export const useGridContext = (showRowLabels: boolean, triggerColumnChange: () => void) => {
  const gridRef = useRef<DataGridHandle>(null);
  const inputRowId = useRef(uniqueId());

  // this tracks ReactDataGrid's notion of the selected cell
  const selectedCell = useRef<TPosition>({ rowIdx: -1, idx: -1 });
  const isSelectedCellInRow = useCallback((rowIdx: number) => selectedCell.current.rowIdx === rowIdx, []);
  // local since ReactDataGrid doesn't have a notion of column selection
  const [selectedColumns, setSelectedColumns] = useState(new Set<string>());
  const selectedColumnsRef = useCurrent(selectedColumns);
  // we use a Set to eventually support multiple selected columns, but
  // currently the API constrains to a single selected column.
  const isColumnSelected = useCallback((columnId: string) =>
                            selectedColumnsRef.current.has(columnId), [selectedColumnsRef]);
  // these are passed into ReactDataGrid as the ultimate source of truth
  const [selectedRows, setSelectedRows] = useState(new Set<React.Key>());

  const clearRowSelection = useCallback(() => setSelectedRows(new Set([])), []);
  const clearColumnSelection = useCallback(() => setSelectedColumns(new Set([])), []);
  const clearCellSelection = useCallback(() => gridRef.current?.selectCell({ idx: -1, rowIdx: -1 }), []);

  // clears all selection by default; options can be used to preserve particular forms of selection
  const clearSelection = useCallback((options?: { row?: boolean, column?: boolean, cell?: boolean }) => {
    const { row, column, cell } = options || {};
    (row !== false) && clearRowSelection();
    (column !== false) && clearColumnSelection();
    (cell !== false) && clearCellSelection();
  }, [clearCellSelection, clearColumnSelection, clearRowSelection]);

  const selectColumn = useCallback((columnId: string) => {
    clearSelection({ column: false });
    setSelectedColumns(new Set([columnId]));
    triggerColumnChange();
  }, [clearSelection, triggerColumnChange]);

  const selectOneRow = useCallback((row: string) => {
    clearColumnSelection();
    setSelectedRows(new Set([row]));
  }, [clearColumnSelection]);

  // Creating a new gridContext can result in focus change thus disrupting cell edits;
  // therefore, it's important that all inputs to the gridContext be wrapped in useCallback()
  // and that state references are mediated through useRef() (e.g. isColumnSelected()).
  const gridContext: IGridContext = useMemo(() => ({
    showRowLabels,
    isColumnSelected,
    onSelectColumn: selectColumn,
    isSelectedCellInRow,
    onSelectOneRow: selectOneRow,
    onClearSelection: clearSelection
  }), [clearSelection, isColumnSelected, isSelectedCellInRow, selectColumn, selectOneRow, showRowLabels]);

  const onSelectedRowsChange = useCallback((_rows: Set<React.Key>) => {
    _rows.delete(inputRowId.current);
    setSelectedRows(_rows);
  }, []);

  const cellNavigationMode: CellNavigationMode = "CHANGE_ROW";
  return {
    ref: gridRef, cellNavigationMode, inputRowId, selectedCell, selectedRows, gridContext, onSelectedRowsChange
  };
};
