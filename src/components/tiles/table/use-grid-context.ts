import { useCallback, useMemo, useRef, useState } from "react";
import { CellNavigationMode, DataGridHandle } from "react-data-grid";
import { useCurrent } from "../../../hooks/use-current";
import { TableContentModelType } from "../../../models/tiles/table/table-content";
import { uniqueId } from "../../../utilities/js-utils";
import { IGridContext, TPosition } from "./table-types";

interface IProps {
  content: TableContentModelType;
  modelId: string;
  showRowLabels: boolean;
  triggerColumnChange: () => void;
}
export const useGridContext = ({ content, modelId, showRowLabels, triggerColumnChange }: IProps) => {
  const gridRef = useRef<DataGridHandle>(null);
  const inputRowId = useRef(uniqueId());
  const dataSet = useMemo(() => content.dataSet, [content]);

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
  const getSelectedRows = useCallback(() => {
    // this is suitable for passing into ReactDataGrid
    return new Set<React.Key>(Array.from(dataSet.selection));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId, dataSet.selection, dataSet.selectedCaseIds]);

  const clearRowSelection = useCallback(() => dataSet.selectAll(false), [dataSet]);
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

  const selectRowById = useCallback((rowId: string, select: boolean) => {
    if (select !== dataSet.isCaseSelected(rowId)) {
      clearSelection({ row: false });
      dataSet.selectCases([rowId], !dataSet.isCaseSelected(rowId));
      triggerColumnChange();
    }
  }, [clearSelection, dataSet, triggerColumnChange]);

  const selectOneRow = useCallback((rowId: string) => {
    clearSelection();
    dataSet.setSelectedCases([rowId]);
    triggerColumnChange();
  }, [clearSelection, dataSet, triggerColumnChange]);

  // Creating a new gridContext can result in focus change thus disrupting cell edits;
  // therefore, it's important that all inputs to the gridContext be wrapped in useCallback()
  // and that state references are mediated through useRef() (e.g. isColumnSelected()).
  const gridContext: IGridContext = useMemo(() => ({
    showRowLabels,
    isColumnSelected,
    onSelectColumn: selectColumn,
    isSelectedCellInRow,
    onSelectRowById: selectRowById,
    onSelectOneRow: selectOneRow,
    onClearSelection: clearSelection
  }), [clearSelection, isColumnSelected, isSelectedCellInRow, selectColumn, selectOneRow, selectRowById,
        showRowLabels]);

  // called by ReactDataGrid when selected rows change
  const onSelectedRowsChange = useCallback((_rows: Set<React.Key>) => {
    clearSelection({ row: false });
    _rows.delete(inputRowId.current);
    dataSet.setSelectedCases(Array.from(_rows) as string[]);
    triggerColumnChange();
  }, [clearSelection, dataSet, triggerColumnChange]);

  const cellNavigationMode: CellNavigationMode = "CHANGE_ROW";
  return {
    ref: gridRef, cellNavigationMode, inputRowId, selectedCell, getSelectedRows, gridContext, onSelectedRowsChange
  };
};
