import { useCallback, useRef } from "react";
import { DataGridHandle } from "react-data-grid";
import { ICase, IDataSet } from "../../../models/data/data-set";
import { ITileModel } from "../../../models/tiles/tile-model";
import { uniqueId } from "../../../utilities/js-utils";
import { formatValue } from "./cell-formatter";
import { TColumn, TPosition, TRow } from "./table-types";
import { IContentChangeHandlers } from "./use-content-change-handlers";
import { useNumberFormat } from "./use-number-format";

const isCellSelectable = (position: TPosition, columns: TColumn[], readOnly: boolean) => {
  return position.idx > 0 &&
    (position.idx < columns.length - (readOnly ? 0 : 1));
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
  // Used to prevent moving the selected position while actively adding a new row
  const addingNewRow = useRef(false);
  // RDG's concept of which cell is selected.
  const selectedCell = useRef<TPosition|null>();

  const { onAddRows, onUpdateRow } = changeHandlers;

  function getSelectedCellIndices() {
    const selectedCellIndices = { selectedCellColumnIndex: -1, selectedCellRowIndex: -1 };
    if (dataSet.selectedCells.length === 1) {
      const _selectedCell = dataSet.selectedCells[0];
      selectedCellIndices.selectedCellColumnIndex = dataSet.attrIndexFromID(_selectedCell.attributeId) ?? -1;
      selectedCellIndices.selectedCellRowIndex = _selectedCell.caseId === inputRowId.current
        ? rows.length - 1
        : dataSet.caseIndexFromID(_selectedCell.caseId);
    }
    return selectedCellIndices;
  }
  const onSelectedCellChange = (position: TPosition) => {
    selectedCell.current = position;
    // We don't update the position while adding a new row so we can move to the new row if necessary.
    if (addingNewRow.current) return;

    // Only modify the selection if a single cell is selected
    if (dataSet.selectedCells.length !== 1) return;

    const { selectedCellColumnIndex, selectedCellRowIndex } = getSelectedCellIndices();

    if (isCellSelectable(position, columns, readOnly)) {
      // Set the dataSet's selected cell
      const newRowId = position.rowIdx === rows.length - 1
        ? inputRowId.current
        : dataSet.caseIDFromIndex(position.rowIdx);
      const newColumnId = dataSet.attrIDFromIndex(position.idx - 1);
      const differentIndices =
        !(selectedCellColumnIndex === position.idx - 1 && selectedCellRowIndex === position.rowIdx);
      if (newColumnId && newRowId && differentIndices) {
        dataSet.setSelectedCells([{ attributeId: newColumnId, caseId: newRowId }]);
        triggerRowChange();
      }
    } else if (!(position.idx === -1 && position.rowIdx === -1)) {
      // Update the position if it's not a legal option (if we're in the control or delete column).
      // Note that rdg will not allow us to move to a row outside of the grid
      let newPosition = { ...position };
      const rightColumnIndex = columns.length - (readOnly ? 1 : 2);
      // Determine if we're moving forwards or backwards
      const forward = (selectedCellRowIndex < position.rowIdx) ||
        (selectedCellRowIndex === position.rowIdx && selectedCellColumnIndex < position.idx);
      if (forward) {
        if (newPosition.idx > rightColumnIndex) {
          if (newPosition.rowIdx >= rows.length - 1) {
            // deselect all cells
            newPosition = { rowIdx: -1, idx: -1 };
          } else {
            // otherwise advance to left cell of next row
            newPosition.idx = 1;
            ++newPosition.rowIdx;
          }
        }
      } else {
        if (newPosition.idx < 1) {
          if (newPosition.rowIdx <= 0) {
            // deselect all cells
            newPosition = { rowIdx: -1, idx: -1 };
          } else if (newPosition.idx < 1) {
            // otherwise move to right cell of previous row
            newPosition.idx = rightColumnIndex;
            --newPosition.rowIdx;
          }
        }
      }

      // Update rdg if we fixed the position, which will cause this function to be called again
      if ((newPosition.rowIdx !== position.rowIdx) || (newPosition.idx !== position.idx)) {
        gridRef.current?.selectCell(newPosition);
        if (newPosition.rowIdx === -1 && newPosition.idx === -1) {
          dataSet.setSelectedCells([]);
          triggerRowChange();
        }
      }
    }
  };

  const getUpdatedRowAndColumn = (_rows?: TRow[], _columns?: TColumn[]) => {
    const rs = _rows ?? rows;
    const cs = _columns ?? columns;
    const { selectedCellColumnIndex, selectedCellRowIndex } = getSelectedCellIndices();
    const updatedRow = (selectedCellRowIndex != null) && (selectedCellRowIndex >= 0)
      ? rs[selectedCellRowIndex] : undefined;
    const updatedColumn = (selectedCellColumnIndex != null) && (selectedCellColumnIndex >= 0)
      ? cs[selectedCellColumnIndex + 1] : undefined;
    return { selectedCellRowIndex, selectedCellColumnIndex, updatedRow, updatedColumn };
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
          // Prevent the selected cell position from updating while adding rows
          addingNewRow.current = true;
          onAddRows([{ ...updatedCaseValues, __id__: inputRowId.current }]);
          inputRowId.current = uniqueId();
          // After adding the new rows to the dataSet, actually update the selected cell position
          setTimeout(() => {
            addingNewRow.current = false;
            if (selectedCell.current) {
              gridRef.current?.selectCell(selectedCell.current);
            }
          });
        } else {
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
