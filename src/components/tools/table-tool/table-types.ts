import { Column, FormatterProps, HeaderRendererProps } from "react-data-grid";

export const kRowHeight = 34;
export const kIndexColumnWidth = 34;
export const kDefaultColumnWidth = 80;
export const kControlsColumnWidth = 36;
export const kCellHorizontalPadding = 16;
export const kHeaderCellPadding = 72; // half on either side of text
export const kExpressionCellPadding = 20;
export interface IGridContext {
  showRowLabels: boolean;
  isColumnSelected: (columnId: string) => boolean;
  onSelectColumn: (columnId: string) => void;
  isSelectedCellInRow: (rowIdx: number) => boolean;
  onSelectRowById: (rowId: string, select: boolean) => void;
  onSelectOneRow: (row: string) => void;
  onClearSelection: (options?: { row?: boolean, column?: boolean, cell?: boolean }) => void;
}

export const kIndexColumnKey = "__index__";
export const kControlsColumnKey = "__controls__";
export interface TRow extends Record<string, any> {
  __id__: string;
  __index__?: number;
  __context__: IGridContext;
}

export interface TColumnAppData {
  readOnly?: boolean;
  gridContext: IGridContext;
  editableName: boolean;
  isEditing: boolean;
  isRemovable: boolean;
  showExpressions: boolean;
  expression?: string;
  onBeginHeaderCellEdit: () => boolean | undefined;
  onHeaderCellEditKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onEndHeaderCellEdit: (value?: string) => void;
  onShowExpressionsDialog?: (attrId?: string) => void;
  onRemoveColumn?: (attrId: string) => void;
  onBeginBodyCellEdit?: () => boolean | undefined;
  onEndBodyCellEdit?: (value?: string) => void;
}
export interface TColumn extends Column<TRow> {
  appData?: TColumnAppData;
}
export interface TPosition { idx: number, rowIdx: number }
export type TFormatterProps = FormatterProps<TRow>;
export type THeaderRendererProps = HeaderRendererProps<TRow>;
export type OnRowSelectionChangeFn = (checked: boolean, isShiftClick: boolean) => void;

export const isDataColumn = (column: TColumn) => {
  return (column.key !== kIndexColumnKey) && (column.key !== kControlsColumnKey);
};
