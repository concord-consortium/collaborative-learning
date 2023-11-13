import { useCallback } from "react";
import { DataGridHandle } from "react-data-grid";
import { ICase, IDataSet } from "../../../models/data/data-set";
import { ITileModel } from "../../../models/tiles/tile-model";
import { uniqueId } from "../../../utilities/js-utils";
import { formatValue } from "./cell-formatter";
import { TColumn, TPosition, TRow } from "./table-types";
import { IContentChangeHandlers } from "./use-content-change-handlers";
import { useNumberFormat } from "./use-number-format";

const isCellSelectable = (position: TPosition, columns: TColumn[], readOnly: boolean) => {
  return position.idx !== 0 &&
    (position.idx !== columns.length - (readOnly ? 0 : 1));
};

interface IUseDataSet {
  gridRef: React.RefObject<DataGridHandle>;
  model: ITileModel;
  dataSet: IDataSet;
  triggerColumnChange: () => void;
  rowChanges: number;
  triggerRowChange: () => void;
  readOnly: boolean;
  inputRowId: React.MutableRefObject<string>;
  rows: TRow[];
  changeHandlers: IContentChangeHandlers;
  columns: TColumn[];
  onColumnResize: (idx: number, width: number, complete: boolean) => void;
  lookupImage: (value: string) => string|undefined;
}
export const useDataSet = ({
  gridRef, model, dataSet, triggerColumnChange, triggerRowChange, readOnly, inputRowId, rows,
  changeHandlers, columns, onColumnResize, lookupImage
}: IUseDataSet) => {
  const { onAddRows, onUpdateRow } = changeHandlers;
  function getSelectedCellIndicies() {
    const selectedCellIndecies = { selectedCellColumnIndex: -1, selectedCellRowIndex: -1 };
    if (dataSet.selectedCells.length === 1) {
      const _selectedCell = dataSet.selectedCells[0];
      selectedCellIndecies.selectedCellColumnIndex = dataSet.attrIndexFromID(_selectedCell.attributeId) ?? -1;
      selectedCellIndecies.selectedCellRowIndex = _selectedCell.caseId === inputRowId.current
        ? rows.length - 1
        : dataSet.caseIndexFromID(_selectedCell.caseId);
    }
    return selectedCellIndecies;
  }
  const onSelectedCellChange = (position: TPosition) => {
    // Only modify the selection if a single cell is selected
    if (dataSet.selectedCells.length !== 1) return;
    const { selectedCellColumnIndex, selectedCellRowIndex } = getSelectedCellIndicies();

    // Determine if we're moving forwards or backwards
    const forward = (selectedCellRowIndex < position.rowIdx) ||
      (selectedCellRowIndex === position.rowIdx && selectedCellColumnIndex < position.idx);

    // Set the dataSet's selected cell
    const newRowId = position.rowIdx === rows.length - 1
      ? inputRowId.current
      : dataSet.caseIDFromIndex(position.rowIdx);
    const newColumnId = dataSet.attrIDFromIndex(position.idx - 1);
    if (newColumnId && newRowId
      && !(selectedCellColumnIndex === position.idx - 1 && selectedCellRowIndex === position.rowIdx)
    ) {
      dataSet.setSelectedCells([{ attributeId: newColumnId, caseId: newRowId }]);
      triggerRowChange();
    }

    // Update the position if it's not a legal option (if we're in the control or delete column).
    // Note that rdg will not allow us to move to a row outside of the grid
    let newPosition = { ...position };
    while(!isCellSelectable(newPosition, columns, readOnly)) {
      if (forward) {
        if (newPosition.rowIdx === rows.length - 1 && newPosition.idx >= columns.length - 1) {
          // move from last cell to { 0, 1 }
          newPosition = { rowIdx: 0, idx: 1 };
        } else if (++newPosition.idx >= columns.length) {
          // otherwise advance to next selectable cell
          newPosition.idx = 1;
          ++newPosition.rowIdx;
        }
      } else {
        if (newPosition.rowIdx === 0 && newPosition.idx < 1) {
          // move from first cell to bottom right cell
          newPosition = { rowIdx: rows.length - 1, idx: columns.length };
        } else if (--newPosition.idx < 1) {
          // otherwise move to previous selectable cell
          newPosition.idx = columns.length - (readOnly ? 1 : 2);
          --newPosition.rowIdx;
        }
      }
    }

    // Update rdg if we changed the
    if ((newPosition.rowIdx !== position.rowIdx) || (newPosition.idx !== position.idx)) {
      gridRef.current?.selectCell(newPosition);
    }
  };

  const getUpdatedRowAndColumn = (_rows?: TRow[], _columns?: TColumn[]) => {
    const rs = _rows ?? rows;
    const cs = _columns ?? columns;
    const selectedCellIndecies = getSelectedCellIndicies();
    const selectedCellColumnIndex = selectedCellIndecies.selectedCellColumnIndex;
    // If the row index is -1, assume we're adding to a new row at the bottom
    const selectedCellRowIndex = selectedCellIndecies.selectedCellRowIndex >= 0
      ? selectedCellIndecies.selectedCellRowIndex : rs.length - 1;
    const updatedRow = (selectedCellRowIndex != null) && (selectedCellRowIndex >= 0)
      ? rs[selectedCellRowIndex] : undefined;
    const updatedColumn = (selectedCellColumnIndex != null) && (selectedCellColumnIndex >= 0)
      ? cs[selectedCellColumnIndex + 1] : undefined;
    return { selectedCellRowIndex, selectedCellColIndex: selectedCellColumnIndex, updatedRow, updatedColumn };
  };

  const formatter = useNumberFormat();
  const onRowsChange = (_rows: TRow[]) => {
    // for now, assume that all changes are single cell edits
    const { selectedCellRowIndex, updatedRow, updatedColumn } = getUpdatedRowAndColumn(_rows);
    if (!readOnly && updatedRow && updatedColumn) {
      const originalValue = dataSet.getValue(updatedRow.__id__, updatedColumn.key);
      const originalStrValue = formatValue({ formatter, value: originalValue, lookupImage });
      // only make a change if the value has actually changed
      if (updatedRow[updatedColumn.key] !== originalStrValue) {
        const updatedCaseValues: ICase = {
          __id__: updatedRow.__id__,
          [updatedColumn.key]: updatedRow[updatedColumn.key]
        };
        const inputRowIndex = _rows.findIndex(row => row.__id__ === inputRowId.current);
        if ((inputRowIndex >= 0) && (selectedCellRowIndex === inputRowIndex)) {
          onAddRows([updatedCaseValues]);
          inputRowId.current = uniqueId();
        }
        else {
          onUpdateRow(updatedCaseValues);
        }
      }
    }
  };

  const deleteSelected = () => {
    const { updatedRow, updatedColumn } = getUpdatedRowAndColumn();
    if (!readOnly && updatedRow && updatedColumn) {
      const updatedCaseValues: ICase = {
        __id__: updatedRow.__id__,
        [updatedColumn.key]: ""
      };
      onUpdateRow(updatedCaseValues);
    }
  };

  const handleColumnResize = useCallback((idx: number, width: number, complete?: boolean) => {
    const returnVal = onColumnResize(idx, width, complete || false);
    triggerColumnChange();
    return returnVal;
  }, [onColumnResize, triggerColumnChange]);

  return { onColumnResize: handleColumnResize, onRowsChange, deleteSelected, onSelectedCellChange};
};
