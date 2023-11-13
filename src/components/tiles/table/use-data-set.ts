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
      selectedCellIndecies.selectedCellRowIndex = dataSet.caseIndexFromID(_selectedCell.caseId);
    }
    return selectedCellIndecies;
  }
  const onSelectedCellChange = (position: TPosition) => {
    // Only modify the selection if a single cell is selected
    if (dataSet.selectedCells.length !== 1) return;
    const { selectedCellColumnIndex, selectedCellRowIndex } = getSelectedCellIndicies();
    // if (selectedCellColumnIndex === -1 && selectedCellRowIndex === -1) return;
    // if (dataSet.selectedCells.length !== 1) return;

    // Determine if we're moving forwards or backwards
    // const _selectedCell = dataSet.selectedCells[0];
    // const selectedCellRowIndex = dataSet.caseIndexFromID(_selectedCell.caseId);
    // const selectedCellColumnIndex = dataSet.attrIndexFromID(_selectedCell.attributeId) ?? -1;
    const forward = (selectedCellRowIndex < position.rowIdx) ||
      (selectedCellRowIndex === position.rowIdx && selectedCellColumnIndex < position.idx);

    // Set the dataSet's selected cell
    const newRowId = dataSet.caseIDFromIndex(position.rowIdx);
    const newColumnId = dataSet.attrIDFromIndex(position.idx - 1);
    console.log(`@@@ newRowId`, newRowId);
    if (newColumnId && newRowId
      && !(selectedCellColumnIndex === position.idx - 1 && selectedCellRowIndex === position.rowIdx)
    ) {
      dataSet.setSelectedCells([{ attributeId: newColumnId, caseId: newRowId }]);
      triggerRowChange();
    }

    let newPosition = { ...position };
    while(!isCellSelectable(newPosition, columns, readOnly)) {
      if (forward) {
        if (newPosition.rowIdx >= rows.length - 1) {
          // If we've moved down past the last row, go back to the top
          // TODO Should we create a new row in this case?
          // onAddRows([{}]);
          // newPosition.rowIdx = rows.length - 2;
        } else if (newPosition.rowIdx === rows.length - 1 && newPosition.idx >= columns.length - 1) {
          // move from last cell to { 0, 1 }
          newPosition = { rowIdx: 0, idx: 1 };
        } else if (++newPosition.idx >= columns.length) {
          // otherwise advance to next selectable cell
          newPosition.idx = 1;
          ++newPosition.rowIdx;
        }
      } else {
        if (newPosition.rowIdx < 0) {
          // If we've moved above the first row, go to the bottom
          // NOTE This never happens because RDG won't let you select rows < 0
          newPosition.rowIdx = rows.length - 1;
        } else if (newPosition.rowIdx === 0 && newPosition.idx < 1) {
          // move from first cell to bottom right cell
          newPosition = { rowIdx: rows.length - 1, idx: columns.length };
        } else if (--newPosition.idx < 1) {
          // otherwise move to previous selectable cell
          newPosition.idx = columns.length - (readOnly ? 1 : 2);
          --newPosition.rowIdx;
        }
      }
    }

    if ((newPosition.rowIdx !== position.rowIdx) || (newPosition.idx !== position.idx)) {
      console.log(`!!! gridRef.selectCell`, newPosition);
      gridRef.current?.selectCell(newPosition);
    }
  };

  const getUpdatedRowAndColumn = (_rows?: TRow[], _columns?: TColumn[]) => {
    console.log(`ooo getUpdatedRowAndColumn`, _rows);
    const rs = _rows ?? rows;
    const cs = _columns ?? columns;
    const selectedCellIndecies = getSelectedCellIndicies();
    const selectedCellColumnIndex = selectedCellIndecies.selectedCellColumnIndex;
    // If the row index is -1, assume we're adding to a new row at the bottom
    const selectedCellRowIndex = selectedCellIndecies.selectedCellRowIndex >= 0
      ? selectedCellIndecies.selectedCellRowIndex : rs.length - 1;
    // const selectedCellRowIndex = selectedCell.current?.rowIdx;
    // const selectedCellColumnIndex = selectedCell.current?.idx;
    const updatedRow = (selectedCellRowIndex != null) && (selectedCellRowIndex >= 0)
      ? rs[selectedCellRowIndex] : undefined;
    console.log(`  o updatedRow`, updatedRow);
    console.log(` oo selectedCellColumnIndex`, selectedCellColumnIndex);
    const updatedColumn = (selectedCellColumnIndex != null) && (selectedCellColumnIndex >= 0)
      ? cs[selectedCellColumnIndex + 1] : undefined;
    console.log(`  o updatedColumn`, updatedColumn);
    return { selectedCellRowIndex, selectedCellColIndex: selectedCellColumnIndex, updatedRow, updatedColumn };
  };

  const formatter = useNumberFormat();
  const onRowsChange = (_rows: TRow[]) => {
    console.log(`--- onRowsChange`);
    // for now, assume that all changes are single cell edits
    const { selectedCellRowIndex, updatedRow, updatedColumn } = getUpdatedRowAndColumn(_rows);
    console.log(` -- updatedRow, updatedColumn`, updatedRow, updatedColumn);
    if (!readOnly && updatedRow && updatedColumn) {
      const originalValue = dataSet.getValue(updatedRow.__id__, updatedColumn.key);
      const originalStrValue = formatValue({ formatter, value: originalValue, lookupImage });
      console.log(` -- updatedValue, originalValue`, updatedRow[updatedColumn.key], originalStrValue);
      // only make a change if the value has actually changed
      if (updatedRow[updatedColumn.key] !== originalStrValue) {
        const updatedCaseValues: ICase = {
          __id__: updatedRow.__id__,
          [updatedColumn.key]: updatedRow[updatedColumn.key]
        };
        const inputRowIndex = _rows.findIndex(row => row.__id__ === inputRowId.current);
        if ((inputRowIndex >= 0) && (selectedCellRowIndex === inputRowIndex)) {
          console.log(`  - adding row`, updatedCaseValues);
          onAddRows([updatedCaseValues]);
          inputRowId.current = uniqueId();
        }
        else {
          console.log(`  - updating row`, updatedCaseValues);
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
