import { IGridContext, kIndexColumnKey, TColumn } from "./grid-types";

interface IUseEditableColumnNames {
  gridContext: IGridContext;
  columns: TColumn[];
  columnEditingName?: string;
  setColumnEditingName: (column?: TColumn) => void;
  setColumnName: (column: TColumn, name: string) => void;
}
export const useEditableColumnNames = ({
  gridContext, columns, columnEditingName, setColumnEditingName, setColumnName
}: IUseEditableColumnNames) => {

  columns.forEach((column, i) => {
    column.appData = {
      editableName: column.key !== kIndexColumnKey,
      isEditing: column.key === columnEditingName,
      onBeginHeaderCellEdit: (() => {
        gridContext.onClearSelection();
        setColumnEditingName(column);
      }) as any,
      onHeaderCellEditKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
        switch (e.key) {
          case "Tab": {
            const nextColumnToEdit = !e.shiftKey
                    ? (i < columns.length - 1 ? columns[i + 1] : undefined)
                    : (i > 1 ? columns[i - 1] : undefined);
            nextColumnToEdit &&
              setTimeout(() => setColumnEditingName(nextColumnToEdit));
            break;
          }
          case "Enter":
            break;
        }
      },
      onEndHeaderCellEdit: (value?: string) => {
        (value != null) && setColumnName(column, value);
        setColumnEditingName();
      }
    };
  });
};
