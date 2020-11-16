import { useCallback, useMemo, useRef, useState } from "react";
import { TextEditor } from "react-data-grid";
import { IDataSet } from "../../../models/data/data-set";
import { EditableHeaderCell } from "./editable-header-cell";
import { IGridContext, kIndexColumnKey, kRowHeight, TColumn } from "./grid-types";
import { useEditableColumnNames } from "./use-editable-column-names";
import { useRowLabelsButton } from "./use-row-labels-button";

function estimateColumnWidthFromName(name: string) {
  // values taken from design spec
  return 62 + 9 * name.length;
}

interface IUseColumnsFromDataSet {
  gridContext: IGridContext;
  dataSet: IDataSet;
  columnChanges: number;
  showRowLabels: boolean;
  setShowRowLabels: (show: boolean) => void;
  setColumnName: (column: TColumn, columnName: string) => void;
}
export const useColumnsFromDataSet = ({
  gridContext, dataSet, columnChanges, showRowLabels, setShowRowLabels, setColumnName
}: IUseColumnsFromDataSet) => {
  const { attributes } = dataSet;
  const { RowLabelsButton, RowLabelsFormatter } = useRowLabelsButton(showRowLabels, setShowRowLabels);
  const columnWidths = useRef<Record<string, number>>({});

  const [columnEditingName, setColumnEditingName] = useState<string>();
  const handleSetColumnEditingName = (column?: TColumn) => {
    setColumnEditingName(column?.key);
  };

  const columns = useMemo(() => {
    const cols: TColumn[] = attributes.map(attr => ({
      headerCellClass: columnEditingName === attr.id ? "rdg-cell-editing" : undefined,
      name: attr.name,
      key: attr.id,
      width: columnWidths.current[attr.id] ||
              (columnWidths.current[attr.id] = estimateColumnWidthFromName(attr.name)),
      resizable: true,
      headerRenderer: EditableHeaderCell,
      editor: TextEditor,
      editorOptions: {
        editOnClick: true
      }
    }));
    cols.unshift({
      cellClass: "index-column",
      headerCellClass: "index-column-header",
      name: "Index",
      key: kIndexColumnKey,
      width: kRowHeight,
      maxWidth: kRowHeight,
      resizable: false,
      editable: false,
      frozen: true,
      headerRenderer: RowLabelsButton,
      formatter: RowLabelsFormatter
    });
    columnChanges;  // eslint-disable-line no-unused-expressions
    return cols;
  }, [RowLabelsButton, RowLabelsFormatter, attributes, columnChanges, columnEditingName]);

  useEditableColumnNames({
    gridContext, columns, columnEditingName, setColumnEditingName: handleSetColumnEditingName, setColumnName });

  const onColumnResize = useCallback((idx: number, width: number) => {
    columnWidths.current[columns[idx].key] = width;
  }, [columns]);

  return { columns, onColumnResize };
};
