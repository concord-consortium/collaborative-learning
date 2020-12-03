import { TableMetadataModelType } from "../../../models/tools/table/table-content";
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
export const useEditableColumnHeaders = ({
  gridContext, metadata, readOnly, columns, columnEditingName, setColumnEditingName, setColumnName
}: IProps) => {

  columns.forEach((column, i) => {
    column.appData = {
      editableName: (column.key !== kIndexColumnKey) && (column.key !== kControlsColumnKey),
      isEditing: column.key === columnEditingName,
      showExpressions: metadata.hasExpressions,
      expression: metadata.rawExpressions.get(column.key),
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
        !readOnly && (value != null) && setColumnName(column, value);
        setColumnEditingName();
      }
    };
  });
};
