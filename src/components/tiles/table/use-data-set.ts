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
  changeHandlers: IContentChangeHandlers;
  columns: TColumn[];
  onColumnResize: (idx: number, width: number, complete: boolean) => void;
  lookupImage: (value: string) => string|undefined;
}
export const useDataSet = ({
  dataSet, triggerColumnChange, triggerRowChange, readOnly, inputRowId,
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

  /**
   * Given a row index from RDG, return the corresponding case ID, or undefined if the index is out of bounds.
   * Note that the input row (for adding new cases) is considered in bounds, and maps to inputRowId.current.
   * This function is used to interpret RDG's selected cell position in terms of the dataSet's cases.
   *
   * @param rowIdx
   * @returns
   */
  function getCaseIdFromRowIndex(rowIdx: number) {
    if (rowIdx < 0) return undefined;
    if (rowIdx === dataSet.cases.length) return inputRowId.current;
    return dataSet.caseIDFromIndex(rowIdx);
  }

  const onSelectedCellChange = (args: CellSelectArgs<TRow>) => {
    // We project CellSelectArgs onto a `{ rowIdx, idx }` position for internal use.
    // args.column is undefined when rdg passes `columns[position.idx]` for an out-of-bounds
    // idx (e.g. when CLUE's clearCellSelection calls selectCell({-1, -1}) and rdg fires
    // the change notification anyway).
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

    const { selectedCellColumnIndex, selectedCellRowIndex } = getSelectedCellIndices();

    if (isCellSelectable(position, columns, readOnly)) {
      // Set the dataSet's selected cell
      const newRowId = getCaseIdFromRowIndex(position.rowIdx);
      const newColumnId = dataSet.attrIDFromIndex(position.idx - 1);
      const differentIndices =
        !(selectedCellColumnIndex === position.idx - 1 && selectedCellRowIndex === position.rowIdx);
      if (newColumnId && newRowId && differentIndices) {
        dataSet.setSelectedCells([{ attributeId: newColumnId, caseId: newRowId }]);
        triggerRowChange();
      }
    }
    // The row-label (idx 0) and controls (idx N-1) columns are intentionally not
    // mapped to case selection here. Case selection is owned by the row-label
    // wrapper's own click/keydown handlers in use-row-label-column.tsx. We don't
    // have enough info here to know how we should be modifying the case selection.
  };

  // Identify the row/column the user just acted on using RDG's authoritative
  // position (selectedCell.current). RDG's idx includes the index column (0)
  // and we want the attribute index, hence `idx - 1`.
  const getUpdatedRowAndColumn = () => {
    const sc = selectedCell.current;
    const selectedCellRowIndex = sc?.rowIdx ?? -1;
    const selectedCellColumnIndex = sc ? sc.idx - 1 : -1;
    const selectedCellCaseId = getCaseIdFromRowIndex(selectedCellRowIndex);
    const selectedCellAttributeKey = selectedCellColumnIndex >= 0
      ? dataSet.attrIDFromIndex(selectedCellColumnIndex)
      : undefined;
    return {
      selectedCellRowIndex,
      selectedCellColumnIndex,
      selectedCellCaseId,
      selectedCellAttributeKey
    };
  };

  const formatter = useNumberFormat();
  const onRowsChange = (_rows: TRow[]) => {
    // for now, assume that all changes are single cell edits
    const { selectedCellRowIndex, selectedCellCaseId, selectedCellAttributeKey } = getUpdatedRowAndColumn();
    if (!readOnly && selectedCellCaseId && selectedCellAttributeKey) {
      const originalValue = dataSet.getValue(selectedCellCaseId, selectedCellAttributeKey);
      const originalStrValue = formatValue({ formatter, value: originalValue, lookupImage });
      // only make a change if the value has actually changed
      const updatedRow = _rows[selectedCellRowIndex];
      if (updatedRow[selectedCellAttributeKey] !== originalStrValue) {
        const updatedCaseValues: ICase = {
          __id__: selectedCellCaseId,
          [selectedCellAttributeKey]: updatedRow[selectedCellAttributeKey]
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
    const { selectedCellCaseId, selectedCellAttributeKey } = getUpdatedRowAndColumn();
    if (!readOnly && selectedCellCaseId && selectedCellAttributeKey) {
      const updatedCaseValues: ICase = {
        __id__: selectedCellCaseId,
        [selectedCellAttributeKey]: ""
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
