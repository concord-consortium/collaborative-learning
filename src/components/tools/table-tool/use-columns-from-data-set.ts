import classNames from "classnames";
import React, { useCallback, useMemo, useState } from "react";
import { IAttribute } from "../../../models/data/attribute";
import { IDataSet } from "../../../models/data/data-set";
import { TableMetadataModelType } from "../../../models/tools/table/table-content";
import { getCellFormatter } from "./cell-formatter";
import CellTextEditor from "./cell-text-editor";
import { ColumnHeaderCell } from "./column-header-cell";
import {
  IGridContext, kControlsColumnKey, kControlsColumnWidth, kIndexColumnKey, kIndexColumnWidth, TColumn
} from "./table-types";
import { useColumnExtensions } from "./use-column-extensions";
import { IContentChangeHandlers } from "./use-content-change-handlers";
import { useControlsColumn } from "./use-controls-column";

interface IUseColumnsFromDataSet {
  gridContext: IGridContext;
  dataSet: IDataSet;
  metadata: TableMetadataModelType;
  readOnly?: boolean;
  columnChanges: number;
  rowHeight: (args: any) => number;
  RowLabelHeader: React.FC<any>;
  RowLabelFormatter: React.FC<any>;
  measureColumnWidth: (attr: IAttribute) => number;
  onShowExpressionsDialog?: (attrId?: string) => void;
  changeHandlers: IContentChangeHandlers;
  userColumnWidths: React.MutableRefObject<Record<string, number>>;
  requestRowHeight: () => void;
  triggerRowChange: () => void;
}
export const useColumnsFromDataSet = ({
  gridContext, dataSet, metadata, readOnly, columnChanges, rowHeight, RowLabelHeader, RowLabelFormatter,
  measureColumnWidth, onShowExpressionsDialog, changeHandlers, userColumnWidths, requestRowHeight, triggerRowChange
}: IUseColumnsFromDataSet) => {
  const { attributes } = dataSet;
  const { onAddColumn, onRemoveRows } = changeHandlers;
  const onRemoveRow = useCallback((rowId: string) => onRemoveRows([rowId]), [onRemoveRows]);
  const { ControlsHeaderRenderer, ControlsRowFormatter } = useControlsColumn({ readOnly, onAddColumn, onRemoveRow });

  const [columnEditingName, setColumnEditingName] = useState<string>();
  const handleSetColumnEditingName = (column?: TColumn) => {
    setColumnEditingName(column?.key);
  };

  const cellClasses = useCallback((attrId: string) => {
    const selectedColumnClass = { "selected-column": gridContext.isColumnSelected(attrId) };
    return {
      cellClass: classNames({ "has-expression": metadata.hasExpression(attrId), ...selectedColumnClass }),
      headerCellClass: classNames({ "rdg-cell-editing": columnEditingName === attrId, ...selectedColumnClass })
    };
  }, [columnEditingName, gridContext, metadata]);

  const columns = useMemo(() => {
    const cols: TColumn[] = attributes.map(attr => {
      const width = measureColumnWidth(attr);
      return {
        ...cellClasses(attr.id),
        name: attr.name,
        key: attr.id,
        width,
        resizable: true,
        headerRenderer: ColumnHeaderCell,
        // formatter: CellFormatter,
        formatter: getCellFormatter(width, rowHeight),
        editor: !readOnly && !metadata.hasExpression(attr.id) ? CellTextEditor : undefined,
        editorOptions: {
          editOnClick: !readOnly
        }
      };
    });
    cols.unshift({
      cellClass: "index-column",
      headerCellClass: "index-column-header",
      name: "Index",
      key: kIndexColumnKey,
      width: kIndexColumnWidth,
      maxWidth: kIndexColumnWidth,
      resizable: false,
      editable: false,
      frozen: true,
      headerRenderer: RowLabelHeader,
      formatter: RowLabelFormatter
    });
    if (!readOnly) {
      cols.push({
        cellClass: "controls-column",
        headerCellClass: "controls-column-header",
        name: "Controls",
        key: kControlsColumnKey,
        width: kControlsColumnWidth,
        maxWidth: kControlsColumnWidth,
        resizable: false,
        editable: false,
        frozen: false,
        headerRenderer: ControlsHeaderRenderer,
        formatter: ControlsRowFormatter
      });
    }
    columnChanges;  // eslint-disable-line no-unused-expressions
    return cols;
  }, [attributes, rowHeight, RowLabelHeader, RowLabelFormatter, readOnly, columnChanges,
      cellClasses, measureColumnWidth, metadata, ControlsHeaderRenderer, ControlsRowFormatter]);

  useColumnExtensions({
    gridContext, metadata, readOnly, columns, columnEditingName, changeHandlers,
    setColumnEditingName: handleSetColumnEditingName, onShowExpressionsDialog
  });

  // This is called constantly as the user resizes the column. When we start saving the width to the model,
  // we'll only want to do so when the user ends adjusting the width.
  const onColumnResize = useCallback((idx: number, width: number) => {
    userColumnWidths.current[columns[idx].key] = width;
    requestRowHeight();
    triggerRowChange(); // triggerRowChange is used because triggerColumnChange doesn't force a rerender
  }, [columns, userColumnWidths, requestRowHeight, triggerRowChange]);

  return { columns, onColumnResize };
};
