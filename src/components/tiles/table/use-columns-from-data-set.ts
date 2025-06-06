import classNames from "classnames";
import React, { useCallback, useMemo, useState } from "react";
import { IAttribute } from "../../../models/data/attribute";
import { IDataSet } from "../../../models/data/data-set";
import { TableMetadataModelType } from "../../../models/tiles/table/table-content";
import { getCellFormatter } from "./cell-formatter";
import CellTextEditor from "./cell-text-editor";
import { useColumnHeaderCell } from "./column-header-cell";
import {
  IGridContext, kControlsColumnKey, kControlsColumnWidth, kIndexColumnKey, kIndexColumnWidth,
  kIndexColumnWidthWithLabel, TColumn
} from "./table-types";

interface IUseColumnsFromDataSet {
  gridContext: IGridContext;
  dataSet: IDataSet;
  isLinked?: boolean;
  metadata: TableMetadataModelType;
  readOnly?: boolean;
  showRowLabels?: boolean;
  columnChanges: number;
  headerHeight: () => number;
  rowHeight: (args: any) => number;
  RowLabelHeader: React.FC<any>;
  RowLabelFormatter: React.FC<any>;
  measureColumnWidth: (attr: IAttribute) => number;
  lookupImage: (value: string) => string|undefined;
  sortColumns?: { columnKey: string, direction: "ASC" | "DESC" }[];
  onSort?: (columnKey: string, direction: "ASC" | "DESC" | "NONE") => void;
}
export const useColumnsFromDataSet = ({
  gridContext, dataSet, isLinked, metadata, readOnly, showRowLabels, columnChanges, headerHeight, rowHeight,
  RowLabelHeader, RowLabelFormatter, measureColumnWidth, lookupImage, sortColumns, onSort
}: IUseColumnsFromDataSet) => {
  const { attributes } = dataSet;

  const [columnEditingName, setColumnEditingName] = useState<string>();
  const handleSetColumnEditingName = (column?: TColumn) => {
    setColumnEditingName(column?.key);
  };

  const cellClasses = useCallback((attrId: string) => {
    const selectedColumnClass = {
      linked: isLinked,
      "selected-column": gridContext.isColumnSelected(attrId)
    };
    dataSet.selectedAttributeIds; // eslint-disable-line no-unused-expressions
    return {
      cellClass: classNames(`column-${attrId}`,
                            { "has-expression": metadata?.hasExpression(attrId), ...selectedColumnClass }),
      headerCellClass: classNames({ "rdg-cell-editing": columnEditingName === attrId, ...selectedColumnClass })
    };
  }, [columnEditingName, dataSet.selectedAttributeIds, gridContext, isLinked, metadata]);

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

  const getSortDirection = useCallback((columnKey: string) => {
    return sortColumns?.find(col => col.columnKey === columnKey)?.direction ?? "NONE";
  }, [sortColumns]);

  const ColumnHeaderCell = useColumnHeaderCell({
    height: headerHeight(),
    getSortDirection,
    onSort: onSort ?? (() => {}),
  });

  const columns = useMemo(() => {
    const cols: TColumn[] = attributes.map(attr => {
      const width = measureColumnWidth(attr);
      return {
        ...cellClasses(attr.id),
        name: attr.name,
        key: attr.id,
        width,
        resizable: !readOnly,
        sortable: true,
        headerRenderer: ColumnHeaderCell,
        formatter: getCellFormatter({ dataSet, isLinked, lookupImage, rowHeight, width }),
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
      width: showRowLabels ? kIndexColumnWidthWithLabel : kIndexColumnWidth,
      maxWidth: showRowLabels ? kIndexColumnWidthWithLabel : kIndexColumnWidth,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attributes, attributes.length, rowHeight, RowLabelHeader, RowLabelFormatter, readOnly, columnChanges,
      ColumnHeaderCell, controlsColumn, cellClasses, measureColumnWidth, metadata, lookupImage, showRowLabels]);
  // attributes.length has been included above so the columns are recreated when columns are added or removed
  // from external means (such as undo/redo). It would be better to make this hook observe changes to the model,
  // but I'm not sure how to do that.

  return { columns, controlsColumn, columnEditingName, handleSetColumnEditingName };
};
