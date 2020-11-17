import { IGridContext, kIndexColumnKey, TColumn } from "./grid-types";

interface IUseEditableColumnNames {
  gridContext: IGridContext;
  readOnly?: boolean;
  columns: TColumn[];
  columnEditingName?: string;
  setColumnEditingName: (column?: TColumn) => void;
  setColumnName: (column: TColumn, name: string) => void;
}
export const useEditableColumnNames = ({
  gridContext, readOnly, columns, columnEditingName, setColumnEditingName, setColumnName
}: IUseEditableColumnNames) => {

  columns.forEach((column, i) => {
    column.appData = {
      editableName: column.key !== kIndexColumnKey,
      isEditing: column.key === columnEditingName,
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
