import { useCallback, useMemo, useRef, useState } from "react";
import { CellNavigationMode, DataGridHandle } from "react-data-grid";
import { useCurrent } from "../../../hooks/use-current";
import { useSharedSelectionStore } from "../../../hooks/use-stores";
import { TableContentModelType } from "../../../models/tiles/table/table-content";
import { uniqueId } from "../../../utilities/js-utils";
import { IGridContext, TPosition } from "./table-types";

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
  // TODO Remove the sharedSelection.
  // There should just be a single selection mechanism, and it should be the one in the dataSet.
  // However, sharedSelection is still in the code to maintain legacy shared highlighting between
  // tables and geometry tiles.
  const sharedSelection = useSharedSelectionStore();
  const getSelectedRows = useCallback(() => {
    // this is suitable for passing into ReactDataGrid
    const { selection } = dataSet;
    const dataSetSelection = new Set<React.Key>(selection);
    sharedSelection.getSelected(modelId).forEach(caseId => {
      if (!dataSetSelection.has(caseId)) dataSetSelection.add(caseId);
    });
    return dataSetSelection;
  }, [dataSet, modelId, sharedSelection]);

  const clearRowSelection = useCallback(() => {
    dataSet.selectAll(false);
    sharedSelection.clear(modelId);
  }, [dataSet, modelId, sharedSelection]);
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
    const actuallySelectRowById = () => {
      clearSelection({ row: false });
      dataSet.selectCases([rowId], !dataSet.isCaseSelected(rowId));
      sharedSelection.select(modelId, rowId, select);
      triggerRowChange();
    };
    if (select !== dataSet.isCaseSelected(rowId)) {
      actuallySelectRowById();
    } else if (select !== sharedSelection.isSelected(modelId, rowId)) {
      actuallySelectRowById();
    }
  }, [clearSelection, dataSet, modelId, sharedSelection, triggerRowChange]);

  const selectOneRow = useCallback((rowId: string) => {
    clearSelection();
    dataSet.setSelectedCases([rowId]);
    sharedSelection.setSelected(modelId, [rowId]);
    triggerRowChange();
  }, [clearSelection, dataSet, modelId, sharedSelection, triggerRowChange]);

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
    sharedSelection.setSelected(modelId, rowArray);
  }, [clearSelection, dataSet, modelId, sharedSelection]);

  const cellNavigationMode: CellNavigationMode = "CHANGE_ROW";
  return {
    ref: gridRef, cellNavigationMode, inputRowId, selectedCell, getSelectedRows, gridContext, onSelectedRowsChange
  };
};
