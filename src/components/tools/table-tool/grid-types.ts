import { Column, FormatterProps, HeaderRendererProps } from "react-data-grid";

export const kIndexColumnKey = "__index__";
export const kRowHeight = 34;

export interface IGridContext {
  showRowLabels: boolean;
  onSelectOneRow: (row: string) => void;
  onClearRowSelection: () => void;
  onClearCellSelection: () => void;
  onClearSelection: () => void;
}

export interface TRow extends Record<string, any> {
  __id__: string;
  __index__: number;
  __context__: IGridContext;
}

export interface TColumnAppData {
  editableName?: boolean;
  isEditing?: boolean;
  onBeginHeaderCellEdit?: () => boolean | undefined;
  onHeaderCellEditKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onEndHeaderCellEdit?: (value?: string) => void;
}
export interface TColumn extends Column<TRow> {
  appData?: TColumnAppData;
}
export type TFormatterProps = FormatterProps<TRow>;
export type THeaderRendererProps = HeaderRendererProps<TRow>;
export type OnRowSelectionChangeFn = (checked: boolean, isShiftClick: boolean) => void;
