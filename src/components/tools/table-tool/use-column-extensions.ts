import { TableMetadataModelType } from "../../../models/tools/table/table-content";
import { getEditableExpression } from "./expression-utils";
import { IGridContext, kControlsColumnKey, kIndexColumnKey, TColumn } from "./table-types";

interface IProps {
  gridContext: IGridContext;
  metadata: TableMetadataModelType;
  readOnly?: boolean;
  columns: TColumn[];
  columnEditingName?: string;
  setColumnEditingName: (column?: TColumn) => void;
  setColumnName: (column: TColumn, name: string) => void;
}
export const useColumnExtensions = ({
  gridContext, metadata, readOnly, columns, columnEditingName, setColumnEditingName, setColumnName
}: IProps) => {
  const firstDataColumn = columns.find(col => isDataColumn(col));
  const xName = (firstDataColumn?.name || "") as string;

  columns.forEach((column, i) => {
    column.appData = {
      editableName: isDataColumn(column),
      isEditing: column.key === columnEditingName,
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
        !readOnly && !!value && (value !== column.name) && setColumnName(column, value);
        setColumnEditingName();
      },
      onBeginBodyCellEdit: (() => {
        gridContext.onClearRowSelection();
      }) as any
    };
  });
};

const isDataColumn = (column: TColumn) => {
  return (column.key !== kIndexColumnKey) && (column.key !== kControlsColumnKey);
};
