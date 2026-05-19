import { useCallback, useRef } from "react";
import { CellSelectArgs } from "react-data-grid";
import { ICase, IDataSet } from "../../../models/data/data-set";
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
  dataSet, triggerColumnChange, triggerRowChange, readOnly, inputRowId, rows,
  changeHandlers, columns, onColumnResize, lookupImage
}: IUseDataSet) => {
  // RDG's concept of which cell is selected.
  const selectedCell = useRef<TPosition|null>(null);

  const { onAddRows, onUpdateRow } = changeHandlers;

  function getSelectedCellIndices() {
    const selectedCellIndices = { selectedCellColumnIndex: -1, selectedCellRowIndex: -1 };
    if (dataSet.selectedCells.length === 1) {
      const _selectedCell = dataSet.selectedCells[0];
      selectedCellIndices.selectedCellColumnIndex = dataSet.attrIndexFromID(_selectedCell.attributeId) ?? -1;
      selectedCellIndices.selectedCellRowIndex = _selectedCell.caseId === inputRowId.current
        ? dataSet.cases.length
        : dataSet.caseIndexFromID(_selectedCell.caseId);
    }
    return selectedCellIndices;
  }
  const onSelectedCellChange = (args: CellSelectArgs<TRow>) => {
    // beta.44 changed the signature from TPosition to CellSelectArgs; we still operate on
    // a `{ rowIdx, idx }` position internally. args.column can be undefined when rdg passes
    // `columns[position.idx]` for an out-of-bounds idx (e.g. when CLUE's clearCellSelection
    // calls selectCell({-1, -1}) and rdg fires the change notification anyway).
    const position: TPosition = { rowIdx: args.rowIdx, idx: args.column?.idx ?? -1 };
    selectedCell.current = position;

    // If the new position is (-1, -1), deselect all cells and bail
    if (position.rowIdx === -1 && position.idx === -1) {
      dataSet.setSelectedCells([]);
      triggerRowChange();
      return;
    }

    // Header row (rowIdx === -1, idx >= 0): RDG selected a header cell.
    // Mirror it to dataSet column selection. The RDG idx 0 is the index column
    // and idx N-1 is the controls column — neither is a data attribute, so
    // attrIDFromIndex returns undefined for those and we just clear the
    // dataSet column selection without touching anything else.
    if (position.rowIdx === -1) {
      const headerColumnId = dataSet.attrIDFromIndex(position.idx - 1);
      dataSet.setSelectedAttributes(headerColumnId ? [headerColumnId] : []);
      triggerRowChange();
      return;
    }

    // Preserve any pre-existing multi-cell selection; otherwise (0 or 1
    // selected cells) keep the dataSet selection in sync with RDG.
    if (dataSet.selectedCells.length > 1) return;

    const { selectedCellColumnIndex, selectedCellRowIndex } = getSelectedCellIndices();

    if (isCellSelectable(position, columns, readOnly)) {
      // Set the dataSet's selected cell
      const newRowId = position.rowIdx === dataSet.cases.length
        ? inputRowId.current
        : dataSet.caseIDFromIndex(position.rowIdx);
      const newColumnId = dataSet.attrIDFromIndex(position.idx - 1);
      const differentIndices =
        !(selectedCellColumnIndex === position.idx - 1 && selectedCellRowIndex === position.rowIdx);
      if (newColumnId && newRowId && differentIndices) {
        dataSet.setSelectedCells([{ attributeId: newColumnId, caseId: newRowId }]);
        triggerRowChange();
      }
    } else if (position.rowIdx < dataSet.cases.length) {
      // Row label or controls column on a real body row (not the input row).
      // Select the case so the row highlight + remove-row button appear —
      // gives keyboard users a way to select rows. setSelectedCases clears
      // any existing cell/attribute selection, so navigating from a data
      // cell to a non-data cell correctly drops the cell selection.
      // No triggerRowChange: dataSet is observable, and the manual trigger
      // forces columnWidths to recompute mid-keydown, which can remount the
      // remove-row button and swallow the Enter -> click on that button.
      const rowId = dataSet.caseIDFromIndex(position.rowIdx);
      if (rowId && !dataSet.isCaseSelected(rowId)) {
        dataSet.setSelectedCases([rowId]);
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
          onAddRows([{ ...updatedCaseValues, __id__: inputRowId.current }]);
          inputRowId.current = uniqueId();
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
    onColumnResize(idx, width, complete || false);
    triggerColumnChange();
  }, [onColumnResize, triggerColumnChange]);

  return { onColumnResize: handleColumnResize, onRowsChange, deleteSelected, onSelectedCellChange, selectedCell};
};
