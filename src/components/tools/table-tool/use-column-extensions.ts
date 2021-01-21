import { TableMetadataModelType } from "../../../models/tools/table/table-content";
import { getEditableExpression } from "./expression-utils";
import { IGridContext, isDataColumn, TColumn } from "./table-types";
import { IContentChangeHandlers } from "./use-content-change-handlers";

interface IProps {
  gridContext: IGridContext;
  metadata: TableMetadataModelType;
  readOnly?: boolean;
  columns: TColumn[];
  columnEditingName?: string;
  setColumnEditingName: (column?: TColumn) => void;
  onShowExpressionsDialog?: (attrId?: string) => void;
  changeHandlers: IContentChangeHandlers;
}
export const useColumnExtensions = ({
  gridContext, metadata, readOnly, columns, columnEditingName,
  setColumnEditingName, onShowExpressionsDialog, changeHandlers
}: IProps) => {
  const { onSetColumnName, onRemoveColumn } = changeHandlers;
  const firstDataColumn = columns.find(col => isDataColumn(col));
  const xName = (firstDataColumn?.name || "") as string;

  columns.forEach((column, i) => {
    column.appData = {
      gridContext,
      editableName: isDataColumn(column),
      isEditing: column.key === columnEditingName,
      isRemovable: isDataColumn(column) && (column.key !== firstDataColumn?.key),
      showExpressions: metadata.hasExpressions,
      expression: getEditableExpression(
                    metadata.rawExpressions.get(column.key),
                    metadata.expressions.get(column.key) || "",
                    xName),
      onBeginHeaderCellEdit: (() => {
        gridContext.onClearSelection();
        !readOnly && setColumnEditingName(column);
      }) as any,
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
      onBeginBodyCellEdit: (() => {
        gridContext.onClearSelection({ cell: false });
      }) as any
    };
  });
};
