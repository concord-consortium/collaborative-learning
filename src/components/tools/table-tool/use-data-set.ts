import { useCallback } from "react";
import { DataGridHandle } from "react-data-grid";
import { useCurrent } from "../../../hooks/use-current";
import { ICase, IDataSet } from "../../../models/data/data-set";
import { TableContentModelType } from "../../../models/tools/table/table-content";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { uniqueId } from "../../../utilities/js-utils";
import { formatValue } from "./cell-formatter";
import { IGridContext, TColumn, TPosition, TRow } from "./table-types";
import { useColumnsFromDataSet } from "./use-columns-from-data-set";
import { IContentChangeHandlers } from "./use-content-change-handlers";
import { useNumberFormat } from "./use-number-format";

const isCellSelectable = (position: TPosition, columns: TColumn[], readOnly: boolean) => {
  return (position.idx !== 0) &&
    (position.idx !== columns.length - (readOnly ? 0 : 1));
};

interface IUseDataSet {
  gridRef: React.RefObject<DataGridHandle>;
  gridContext: IGridContext;
  model: ToolTileModelType;
  dataSet: IDataSet;
  columnChanges: number;
  triggerColumnChange: () => void;
  rowChanges: number;
  triggerRowChange: () => void;
  readOnly: boolean;
  inputRowId: React.MutableRefObject<string>;
  selectedCell: React.MutableRefObject<TPosition>;
  rows: TRow[];
  rowHeight: (args: any) => number;
  RowLabelHeader: React.FC<any>;
  RowLabelFormatter: React.FC<any>;
  changeHandlers: IContentChangeHandlers;
  measureText: (text: string) => number;
  onShowExpressionsDialog?: (attrId?: string) => void;
}
export const useDataSet = ({
  gridRef, gridContext, model, dataSet, columnChanges, triggerColumnChange, triggerRowChange, readOnly,
  inputRowId, selectedCell, rows, rowHeight, RowLabelHeader, RowLabelFormatter,
  changeHandlers, measureText, onShowExpressionsDialog
}: IUseDataSet) => {
  const { onAddRows, onUpdateRow } = changeHandlers;
  const modelRef = useCurrent(model);
  const getContent = useCallback(() => modelRef.current.content as TableContentModelType, [modelRef]);
  const metadata = getContent().metadata;
  const { columns, onColumnResize } = useColumnsFromDataSet({
    gridContext, dataSet, metadata, readOnly, columnChanges, rowHeight, RowLabelHeader, RowLabelFormatter,
    measureText, onShowExpressionsDialog, changeHandlers });
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

  const hasLinkableRows = getContent().hasLinkableCases(dataSet);

  const formatter = useNumberFormat();
  const onRowsChange = (_rows: TRow[]) => {
    // for now, assume that all changes are single cell edits
    const selectedCellRowIndex = selectedCell.current?.rowIdx;
    const selectedCellColIndex = selectedCell.current?.idx;
    const updatedRow = (selectedCellRowIndex != null) && (selectedCellRowIndex >= 0)
                        ? _rows[selectedCellRowIndex] : undefined;
    const updatedColumn = (selectedCellColIndex != null) && (selectedCellColIndex >= 0)
                            ? columns[selectedCellColIndex] : undefined;
    if (!readOnly && updatedRow && updatedColumn) {
      const originalValue = dataSet.getValue(updatedRow.__id__, updatedColumn.key);
      const originalStrValue = formatValue(formatter, originalValue);
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
  const handleColumnResize = useCallback((idx: number, width: number) => {
    onColumnResize(idx, width);
    triggerColumnChange();
  }, [onColumnResize, triggerColumnChange]);
  return { hasLinkableRows, columns,
            onColumnResize: handleColumnResize, onRowsChange, onSelectedCellChange};
};
