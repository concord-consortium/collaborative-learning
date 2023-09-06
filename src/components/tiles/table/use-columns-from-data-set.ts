import classNames from "classnames";
import React, { useCallback, useMemo, useState } from "react";
import { IAttribute } from "../../../models/data/attribute";
import { IDataSet } from "../../../models/data/data-set";
import { TableMetadataModelType } from "../../../models/tiles/table/table-content";
import { getCellFormatter } from "./cell-formatter";
import CellTextEditor from "./cell-text-editor";
import { useColumnHeaderCell } from "./column-header-cell";
import {
  IGridContext, kControlsColumnKey, kControlsColumnWidth, kIndexColumnKey, kIndexColumnWidth, TColumn
} from "./table-types";

interface IUseColumnsFromDataSet {
  gridContext: IGridContext;
  dataSet: IDataSet;
  metadata: TableMetadataModelType;
  readOnly?: boolean;
  columnChanges: number;
  headerHeight: () => number;
  rowHeight: (args: any) => number;
  RowLabelHeader: React.FC<any>;
  RowLabelFormatter: React.FC<any>;
  measureColumnWidth: (attr: IAttribute) => number;
  lookupImage: (value: string) => string|undefined;
}
export const useColumnsFromDataSet = ({
  gridContext, dataSet, metadata, readOnly, columnChanges, headerHeight, rowHeight, RowLabelHeader, RowLabelFormatter,
  measureColumnWidth, lookupImage
}: IUseColumnsFromDataSet) => {
  const { attributes } = dataSet;

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

  // controlsColumn is specified separate from the other columns because its headerRenderer and formatter
  // cannot be defined yet, so they must be attached in a later hook.
  const controlsColumn = useMemo(() => {
    if (readOnly) return undefined;
    return {
      cellClass: "controls-column",
      headerCellClass: "controls-column-header",
      name: "Controls",
      key: kControlsColumnKey,
      width: kControlsColumnWidth,
      maxWidth: kControlsColumnWidth,
      resizable: false,
      editable: false,
      frozen: false
    };
  }, [readOnly]);

  const ColumnHeaderCell = useColumnHeaderCell(headerHeight());

  const columns = useMemo(() => {
    const cols: TColumn[] = attributes.map(attr => {
      const width = measureColumnWidth(attr);
      return {
        ...cellClasses(attr.id),
        name: attr.name,
        key: attr.id,
        width,
        resizable: !readOnly,
        headerRenderer: ColumnHeaderCell,
        formatter: getCellFormatter(width, rowHeight, lookupImage),
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
    if (controlsColumn) {
      cols.push(controlsColumn);
    }
    columnChanges;  // eslint-disable-line no-unused-expressions
    return cols;
  }, [attributes, rowHeight, RowLabelHeader, RowLabelFormatter, readOnly, columnChanges,
      ColumnHeaderCell, controlsColumn, cellClasses, measureColumnWidth, metadata, lookupImage]);

  return { columns, controlsColumn, columnEditingName, handleSetColumnEditingName };
};
