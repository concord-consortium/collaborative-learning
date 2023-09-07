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
  return (position.idx !== 0) &&
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
  selectedCell: React.MutableRefObject<TPosition>;
  rows: TRow[];
  changeHandlers: IContentChangeHandlers;
  columns: TColumn[];
  onColumnResize: (idx: number, width: number, complete: boolean) => void;
  lookupImage: (value: string) => string|undefined;
}
export const useDataSet = ({
  gridRef, model, dataSet, triggerColumnChange, triggerRowChange, readOnly, inputRowId, selectedCell, rows,
  changeHandlers, columns, onColumnResize, lookupImage
}: IUseDataSet) => {
  const { onAddRows, onUpdateRow } = changeHandlers;
  const onSelectedCellChange = (position: TPosition) => {
    const forward = (selectedCell.current.rowIdx < position.rowIdx) ||
                    ((selectedCell.current.rowIdx === position.rowIdx) &&
                      (selectedCell.current.idx < position.idx));
    if ((position.rowIdx !== selectedCell.current.rowIdx) || (position.idx !== selectedCell.current.idx)) {
      selectedCell.current = position;
      triggerRowChange();
    }

    if (!isCellSelectable(position, columns, readOnly) && (columns.length > 2)) {
      let newPosition = { ...position };
      if (forward) {
        while (!isCellSelectable(newPosition, columns, readOnly)) {
          // move from last cell to { -1, -1 }
          if ((newPosition.rowIdx >= rows.length) ||
              ((newPosition.rowIdx === rows.length - 1) && (newPosition.idx >= columns.length - 1))) {
            newPosition = { rowIdx: -1, idx: -1 };
          }
          // otherwise advance to next selectable cell
          else if (++newPosition.idx >= columns.length) {
            newPosition.idx = 1;
            ++newPosition.rowIdx;
          }
        }
      }
      else {  // backward
        while (!isCellSelectable(newPosition, columns, readOnly)) {
          // move from first cell to { -1, -1 }
          if ((newPosition.rowIdx <= -1) || ((newPosition.rowIdx === 0) && (newPosition.idx < 1))) {
            newPosition = { rowIdx: -1, idx: -1 };
          }
          // otherwise move to previous selectable cell
          else if (--newPosition.idx < 1) {
            newPosition.idx = columns.length - (readOnly ? 1 : 2);
            --newPosition.rowIdx;
          }
        }
      }
      if ((newPosition.rowIdx !== position.rowIdx) || (newPosition.idx !== position.idx)) {
        gridRef.current?.selectCell(newPosition);
      }
    }
  };

  const hasLinkableRows = dataSet.attributes.length > 1;

  const getUpdatedRowAndColumn = (_rows?: TRow[], _columns?: TColumn[]) => {
    const rs = _rows ?? rows;
    const cs = _columns ?? columns;
    const selectedCellRowIndex = selectedCell.current?.rowIdx;
    const selectedCellColIndex = selectedCell.current?.idx;
    const updatedRow = (selectedCellRowIndex != null) && (selectedCellRowIndex >= 0)
                        ? rs[selectedCellRowIndex] : undefined;
    const updatedColumn = (selectedCellColIndex != null) && (selectedCellColIndex >= 0)
                            ? cs[selectedCellColIndex] : undefined;
    return { selectedCellRowIndex, selectedCellColIndex, updatedRow, updatedColumn };

  };

  const formatter = useNumberFormat();
  const onRowsChange = (_rows: TRow[]) => {
    // for now, assume that all changes are single cell edits
    const { selectedCellRowIndex, updatedRow, updatedColumn } = getUpdatedRowAndColumn(_rows);
    if (!readOnly && updatedRow && updatedColumn) {
      const originalValue = dataSet.getValue(updatedRow.__id__, updatedColumn.key);
      const originalStrValue = formatValue(formatter, originalValue, lookupImage);
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
  
  return { hasLinkableRows, onColumnResize: handleColumnResize, onRowsChange, deleteSelected, onSelectedCellChange};
};
