import { Column, FormatterProps, HeaderRendererProps } from "react-data-grid";

export const kRowHeight = 34;
export const kIndexColumnWidth = 34;
export const kControlsColumnWidth = 36;

export interface IGridContext {
  showRowLabels: boolean;
  isColumnSelected: (columnId: string) => boolean;
  onSelectColumn: (columnId: string) => void;
  isSelectedCellInRow: (rowIdx: number) => boolean;
  onSelectOneRow: (row: string) => void;
  onClearSelection: (options?: { row?: boolean, column?: boolean, cell?: boolean }) => void;
}

export const kSerializedXKey = "__x__";

export const kIndexColumnKey = "__index__";
export const kControlsColumnKey = "__controls__";
export interface TRow extends Record<string, any> {
  __id__: string;
  __index__?: number;
  __context__: IGridContext;
}

export interface TColumnAppData {
  gridContext: IGridContext;
  editableName?: boolean;
  isEditing?: boolean;
  showExpressions?: boolean;
  expression?: string;
  onBeginHeaderCellEdit?: () => boolean | undefined;
  onHeaderCellEditKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onEndHeaderCellEdit?: (value?: string) => void;
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
