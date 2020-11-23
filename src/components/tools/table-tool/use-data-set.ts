import { useCallback, useRef, useState } from "react";
import { ICase, IDataSet } from "../../../models/data/data-set";
import { uniqueId, uniqueName } from "../../../utilities/js-utils";
import { IGridContext, kRowHeight, TColumn, TPosition, TRow } from "./grid-types";
import { useColumnsFromDataSet } from "./use-columns-from-data-set";
import { useRowsFromDataSet } from "./use-rows-from-data-set";

const optimalTileRowHeight = (rowCount: number) => {
  const kPadding = 2 * 10;
  const kBorders = 4;
  return (rowCount + 2) * kRowHeight + kPadding + kBorders;
};

interface IUseDataSet {
  gridContext: IGridContext;
  selectedCell: React.MutableRefObject<TPosition | undefined>;
  dataSet: IDataSet;
  readOnly: boolean;
  getTitleWidthFromColumns: (columns: TColumn[]) => number;
  showRowLabels: boolean;
  setShowRowLabels: (show: boolean) => void;
  onRequestRowHeight: (options: { height?: number, deltaHeight?: number }) => void;
}
export const useDataSet = ({
  gridContext, selectedCell, dataSet, readOnly, showRowLabels,
  setShowRowLabels, getTitleWidthFromColumns, onRequestRowHeight
}: IUseDataSet) => {
  const inputRowId = useRef(uniqueId());
  const [columnChanges, setColumnChanges] = useState(0);
  const incColumnChanges = () => setColumnChanges(state => ++state);
  const [rowChanges, setRowChanges] = useState(0);
  const incRowChanges = () => setRowChanges(state => ++state);
  const setColumnName = (column: TColumn, columnName: string) => {
    !readOnly && dataSet.setAttributeName(column.key, columnName);
    incColumnChanges();
  };
  const onAddColumn = () => {
    !readOnly && dataSet.addAttributeWithID({
                          id: uniqueId(),
                          name: uniqueName("y", (name: string) => !dataSet.attrFromName(name))
                        });
    incColumnChanges();
  };
  const onRemoveRow = (rowId: string) => {
    !readOnly && dataSet.removeCases([rowId]);
    incColumnChanges();
  };
  const { columns, onColumnResize } = useColumnsFromDataSet({
                                        gridContext, dataSet, readOnly, inputRowId: inputRowId.current, columnChanges,
                                        showRowLabels, setShowRowLabels, setColumnName, onAddColumn, onRemoveRow });
  const { rows, rowKeyGetter, rowClass } = useRowsFromDataSet({
                                            dataSet, readOnly, inputRowId: inputRowId.current,
                                            rowChanges, context: gridContext});
  const rowHeight = kRowHeight;
  const headerRowHeight = kRowHeight;
  const onRowsChange = (_rows: TRow[]) => {
    // for now, assume that all changes are single cell edits
    const selectedCellRowIndex = selectedCell.current?.rowIdx;
    const selectedCellColIndex = selectedCell.current?.idx;
    const updatedRow = (selectedCellRowIndex != null) && (selectedCellRowIndex >= 0)
                        ? _rows[selectedCellRowIndex] : undefined;
    const updatedColumn = (selectedCellColIndex != null) && (selectedCellColIndex >= 0)
                            ? columns[selectedCellColIndex] : undefined;
    if (updatedRow && updatedColumn) {
      const updatedCaseValues: ICase[] = [{
        __id__: updatedRow.__id__,
        [updatedColumn.key]: updatedRow[updatedColumn.key]
      }];
      const inputRowIndex = _rows.findIndex(row => row.__id__ === inputRowId.current);
      if ((inputRowIndex >= 0) && (selectedCellRowIndex === inputRowIndex)) {
        dataSet.addCanonicalCasesWithIDs(updatedCaseValues);
        onRequestRowHeight({ height: optimalTileRowHeight(rows.length + 1) });
        inputRowId.current = uniqueId();
      }
      else {
        dataSet.setCanonicalCaseValues(updatedCaseValues);
      }
      incRowChanges();
    }
  };
  const handleColumnResize = useCallback((idx: number, width: number) => {
    onColumnResize(idx, width);
    incColumnChanges();
  }, [onColumnResize]);
  const getTitleWidth = () => getTitleWidthFromColumns(columns);
  return { getTitleWidth, columns, rows, rowKeyGetter, rowClass, rowHeight, headerRowHeight,
            onColumnResize: handleColumnResize, onRowsChange };
};
