import { useCallback, useMemo, useRef } from "react";
import { DataGridHandle } from "react-data-grid";
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

  // True iff this row has either a selected cell or a selected case in it.
  // Used by ControlsRowFormatter to decide whether to render the remove-row
  // button — so the button appears when keyboard focus lands on the row label
  // or controls cell (which select the case) as well as on a data cell.
  //
  // NOTE: this is only the per-row gate. There is a second, per-tile gate in
  // table-tile.scss (`.remove-row-button { display: none }` overridden by
  // `.tool-tile.selected ... { display: flex !important }`). The button is
  // visible only when BOTH gates pass: this predicate returns true AND the
  // ancestor tile has the `selected` class.
  const isSelectedCaseInRow = useCallback((rowIdx: number) => {
    const caseId = dataSet.getCaseAtIndex(rowIdx)?.__id__;
    if (!caseId) return false;
    if (dataSet.isCaseSelected(caseId)) return true;
    return dataSet.selectedCells.some(cell => cell.caseId === caseId);
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
    // Don't clear cell selection here. clearCellSelection would call
    // gridRef.selectCell({-1, -1}), which fires onSelectedCellChange({-1, -1})
    // and resets RDG's selectedPosition. We want selectedPosition to stay on
    // whatever cell it was on when selectOneRow was called.
    // RDG uses the cell selection for keyboard focus and Tab cycling, so
    // resetting breaks the expected tabbing behavior.
    // setSelectedCases below clears the dataSet's cellSelection
    // which keeps the dataSet view consistent.
    clearSelection({ cell: false });
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
    isSelectedCaseInRow,
    onSelectRowById: selectRowById,
    onSelectOneRow: selectOneRow,
    onClearSelection: clearSelection
  }), [clearSelection, isColumnSelected, isSelectedCaseInRow, selectColumn, selectOneRow, selectRowById,
        showRowLabels]);

  // called by ReactDataGrid when selected rows change
  const onSelectedRowsChange = useCallback((_rows: Set<React.Key>) => {
    // We don't clear the RDG cell selection here, for the same reason as in
    // selectOneRow.
    clearSelection({ row: false, cell: false });
    _rows.delete(inputRowId.current);
    const rowArray = Array.from(_rows) as string[];
    dataSet.setSelectedCases(rowArray);
  }, [clearSelection, dataSet]);

  return {
    ref: gridRef, inputRowId, getSelectedRows, gridContext, onSelectedRowsChange
  };
};
