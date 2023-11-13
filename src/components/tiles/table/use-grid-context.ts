import { useCallback, useMemo, useRef } from "react";
import { CellNavigationMode, DataGridHandle } from "react-data-grid";
import { useSharedSelectionStore } from "../../../hooks/use-stores";
import { TableContentModelType } from "../../../models/tiles/table/table-content";
import { uniqueId } from "../../../utilities/js-utils";
import { IGridContext } from "./table-types";

interface IProps {
  content: TableContentModelType;
  modelId: string;
  showRowLabels: boolean;
  triggerColumnChange: () => void;
  triggerRowChange: () => void;
}
export const useGridContext = ({ content, modelId, showRowLabels, triggerColumnChange, triggerRowChange }: IProps) => {
  const gridRef = useRef<DataGridHandle>(null);
  const inputRowId = useRef(uniqueId());
  const dataSet = content.dataSet;

  const isSelectedCellInRow = useCallback((rowIdx: number) => {
    const rowId = dataSet.getCaseAtIndex(rowIdx)?.__id__;
    if (!rowId) return false;
    let containsSelectedCell = false;
    dataSet.selectedCells.forEach(cell => {
      const { caseId } = cell;
      if (rowId === caseId) containsSelectedCell = true;
    });
    return containsSelectedCell;
  }, [dataSet]);
  const isColumnSelected = useCallback((columnId: string) => dataSet.isAttributeSelected(columnId),
    [dataSet]);
  // TODO Remove the sharedSelection.
  // There should just be a single selection mechanism, and it should be the one in the dataSet.
  // However, sharedSelection is still in the code to maintain legacy shared highlighting between
  // tables and geometry tiles.
  const sharedSelection = useSharedSelectionStore();
  const getSelectedRows = useCallback(() => {
    // this is suitable for passing into ReactDataGrid
    const { selectedCaseIds } = dataSet;
    const dataSetSelection = new Set<React.Key>(selectedCaseIds);
    sharedSelection.getSelected(modelId).forEach(caseId => {
      if (!dataSetSelection.has(caseId)) dataSetSelection.add(caseId);
    });
    return dataSetSelection;
  }, [dataSet, modelId, sharedSelection]);

  const clearRowSelection = useCallback(() => {
    dataSet.selectAllCases(false);
    sharedSelection.clear(modelId);
  }, [dataSet, modelId, sharedSelection]);
  const clearColumnSelection = useCallback(() => dataSet.selectAllAttributes(false), [dataSet]);
  const clearCellSelection = useCallback(() => dataSet.selectAllCells(false), [dataSet]);

  // clears all selection by default; options can be used to preserve particular forms of selection
  const clearSelection = useCallback((options?: { row?: boolean, column?: boolean, cell?: boolean }) => {
    const { row, column, cell } = options || {};
    (row !== false) && clearRowSelection();
    (column !== false) && clearColumnSelection();
    (cell !== false) && clearCellSelection();
  }, [clearCellSelection, clearColumnSelection, clearRowSelection]);

  const selectColumn = useCallback((columnId: string) => {
    clearSelection({ column: false });
    dataSet.setSelectedAttributes([columnId]);
    triggerColumnChange();
  }, [clearSelection, dataSet, triggerColumnChange]);

  const selectRowById = useCallback((rowId: string, select: boolean) => {
    const actuallySelectRowById = () => {
      clearSelection({ row: false });
      dataSet.selectCases([rowId], !dataSet.isCaseSelected(rowId));
      triggerRowChange();
    };
    if (select !== dataSet.isCaseSelected(rowId)) {
      actuallySelectRowById();
    }
  }, [clearSelection, dataSet, triggerRowChange]);

  const selectOneRow = useCallback((rowId: string) => {
    clearSelection();
    dataSet.setSelectedCases([rowId]);
    triggerRowChange();
  }, [clearSelection, dataSet, triggerRowChange]);

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
    const rowArray = Array.from(_rows) as string[];
    dataSet.setSelectedCases(rowArray);
  }, [clearSelection, dataSet]);

  const cellNavigationMode: CellNavigationMode = "CHANGE_ROW";
  return {
    ref: gridRef, cellNavigationMode, inputRowId, getSelectedRows, gridContext, onSelectedRowsChange
  };
};
