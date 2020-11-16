import { useCallback, useMemo, useRef } from "react";
import { TextEditor } from "react-data-grid";
import { IDataSet } from "../../../models/data/data-set";
import { TColumn } from "./grid-types";
import { useRowLabelsButton } from "./use-row-labels-button";

function estimateColumnWidthFromName(name: string) {
  // values taken from design spec
  return 62 + 9 * name.length;
}

export const useColumnsFromDataSet = (
  dataSet: IDataSet, columnChanges: number, showRowLabels: boolean, setShowRowLabels: (show: boolean) => void
) => {
  const { attributes } = dataSet;
  const { RowLabelsButton, RowLabelsFormatter } = useRowLabelsButton(showRowLabels, setShowRowLabels);
  const columnWidths = useRef<Record<string, number>>({});
  const columns = useMemo(() => {
    const cols: TColumn[] = attributes.map(attr => ({
      name: attr.name,
      key: attr.id,
      width: columnWidths.current[attr.id] ||
              (columnWidths.current[attr.id] = estimateColumnWidthFromName(attr.name)),
      resizable: true,
      editor: TextEditor,
      editorOptions: {
        editOnClick: true
      }
    }));
    cols.unshift({
      cellClass: "index-column",
      headerCellClass: "index-column-header",
      name: "Index",
      key: "__index__",
      width: 34,
      maxWidth: 34,
      resizable: false,
      editable: false,
      frozen: true,
      headerRenderer: RowLabelsButton,
      formatter: RowLabelsFormatter
    });
    columnChanges;  // eslint-disable-line no-unused-expressions
    return cols;
  }, [RowLabelsButton, RowLabelsFormatter, attributes, columnChanges]);

  const onColumnResize = useCallback((idx: number, width: number) => {
    columnWidths.current[columns[idx].key] = width;
  }, [columns]);

  return { columns, onColumnResize };
};
