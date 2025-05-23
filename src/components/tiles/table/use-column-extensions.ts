import { getEditableExpression } from "../../../models/data/expression-utils";
import { TableMetadataModelType } from "../../../models/tiles/table/table-content";
import { IGridContext, isDataColumn, TColumn, TRow } from "./table-types";
import { IContentChangeHandlers } from "./use-content-change-handlers";

interface IProps {
  gridContext: IGridContext;
  metadata: TableMetadataModelType;
  readOnly?: boolean;
  columns: TColumn[];
  columnEditingName?: string;
  rows: TRow[];
  setColumnEditingName: (column?: TColumn) => void;
  onShowExpressionsDialog?: (attrId?: string) => void;
  changeHandlers: IContentChangeHandlers;
}
export const useColumnExtensions = ({
  gridContext, metadata, readOnly, columns, columnEditingName, rows,
  setColumnEditingName, onShowExpressionsDialog, changeHandlers
}: IProps) => {
  const { onSetColumnName, onRemoveColumn } = changeHandlers;
  const firstDataColumn = columns.find(col => isDataColumn(col));
  const xName = (firstDataColumn?.name || "") as string;

  columns.forEach((column, i) => {
    column.appData = {
      readOnly,
      gridContext,
      editableName: !readOnly && isDataColumn(column),
      isEditing: column.key === columnEditingName,
      isRemovable: !readOnly && isDataColumn(column) && (column.key !== firstDataColumn?.key),
      showExpressions: metadata.hasExpressions,
      expression: getEditableExpression(
                    metadata.rawExpressions.get(column.key),
                    metadata.expressions.get(column.key) || "",
                    xName),
      onBeginHeaderCellEdit: () => {
        !readOnly && setColumnEditingName(column);
        return undefined;
      },
      onHeaderCellEditKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
        switch (e.key) {
          case "Tab": {
            const nextColumnToEdit = !e.shiftKey
                    ? (i < columns.length - 1 ? columns[i + 1] : undefined)
                    : (i > 1 ? columns[i - 1] : undefined);
            !readOnly && nextColumnToEdit &&
              setTimeout(() => setColumnEditingName(nextColumnToEdit));
            break;
          }
          case "Enter":
            break;
        }
      },
      onEndHeaderCellEdit: (value?: string) => {
        !readOnly && !!value && (value !== column.name) && onSetColumnName(column, value);
        setColumnEditingName();
      },
      onRemoveColumn,
      onShowExpressionsDialog,
      hasData: (() => {
        return rows.some((c: any) => {
          const value = c[column.key];
          return value !== undefined && value !== null && value !== "";
        });
      })()
    };
  });
};
