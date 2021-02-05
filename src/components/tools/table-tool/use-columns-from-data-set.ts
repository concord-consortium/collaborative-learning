import classNames from "classnames";
import { useCallback, useMemo, useRef, useState } from "react";
import { IAttribute } from "../../../models/data/attribute";
import { IDataSet } from "../../../models/data/data-set";
import { TableMetadataModelType } from "../../../models/tools/table/table-content";
import { CellFormatter } from "./cell-formatter";
import CellTextEditor from "./cell-text-editor";
import { ColumnHeaderCell } from "./column-header-cell";
import { prettifyExpression } from "./expression-utils";
import {
  IGridContext, kControlsColumnKey, kControlsColumnWidth, kExpressionCellPadding, kHeaderCellPadding,
  kIndexColumnKey, kIndexColumnWidth, TColumn
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
  RowLabelHeader: React.FC<any>;
  RowLabelFormatter: React.FC<any>;
  measureText: (text: string) => number;
  onShowExpressionsDialog?: (attrId?: string) => void;
  changeHandlers: IContentChangeHandlers;
}
export const useColumnsFromDataSet = ({
  gridContext, dataSet, metadata, readOnly, columnChanges, RowLabelHeader, RowLabelFormatter,
  measureText, onShowExpressionsDialog, changeHandlers
}: IUseColumnsFromDataSet) => {
  const { attributes } = dataSet;
  const { onAddColumn, onRemoveRows } = changeHandlers;
  const onRemoveRow = useCallback((rowId: string) => onRemoveRows([rowId]), [onRemoveRows]);
  const { ControlsHeaderRenderer, ControlsRowFormatter } = useControlsColumn({ readOnly, onAddColumn, onRemoveRow });
  // user-modified column widths aren't currently saved
  const userColumnWidths = useRef<Record<string, number>>({});
  const nameColumnWidths = useRef<Record<string, number>>({});
  const exprColumnWidths = useRef<Record<string, number>>({});

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

  const measureColumnWidth = useCallback((attr: IAttribute) => {
    const nameCellWidth = measureText(attr.name) + kHeaderCellPadding;
    const xName = dataSet.attributes[0]?.name || "x";
    const expr = metadata.rawExpressions.get(attr.id) ||
                  prettifyExpression(metadata.expressions.get(attr.id) || "", xName);
    const exprCellWidth = (expr ? measureText(`= ${expr}`) : 0) + kExpressionCellPadding;
    if ((nameCellWidth !== nameColumnWidths.current[attr.id]) ||
        (exprCellWidth !== exprColumnWidths.current[attr.id])) {
      // autoWidth changes (e.g. name or formula changes), supercede user-set width
      delete userColumnWidths.current[attr.id];
      nameColumnWidths.current[attr.id] = nameCellWidth;
      exprColumnWidths.current[attr.id] = exprCellWidth;
    }
    return userColumnWidths.current[attr.id] || Math.max(nameCellWidth, exprCellWidth);
  }, [dataSet.attributes, measureText, metadata.expressions, metadata.rawExpressions]);

  const columns = useMemo(() => {
    const cols: TColumn[] = attributes.map(attr => ({
      ...cellClasses(attr.id),
      name: attr.name,
      key: attr.id,
      width: measureColumnWidth(attr),
      resizable: !readOnly,
      headerRenderer: ColumnHeaderCell,
      formatter: CellFormatter,
      editor: !readOnly && !metadata.hasExpression(attr.id) ? CellTextEditor : undefined,
      editorOptions: {
        editOnClick: !readOnly
      }
    }));
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
  }, [attributes, RowLabelHeader, RowLabelFormatter, readOnly, columnChanges,
      cellClasses, measureColumnWidth, metadata, ControlsHeaderRenderer, ControlsRowFormatter]);

  useColumnExtensions({
    gridContext, metadata, readOnly, columns, columnEditingName, changeHandlers,
    setColumnEditingName: handleSetColumnEditingName, onShowExpressionsDialog
 });

  const onColumnResize = useCallback((idx: number, width: number) => {
    userColumnWidths.current[columns[idx].key] = width;
  }, [columns]);

  return { columns, onColumnResize };
};
