import { Column, FormatterProps } from "react-data-grid";

export interface IGridContext {
  showRowLabels: boolean;
  onSelectOneRow: (row: string) => void;
  onClearRowSelection: () => void;
}

export interface TRow extends Record<string, any> {
  __id__: string;
  __index__: number;
  __context__: IGridContext;
}
export type TColumn = Column<TRow>;
export type TFormatterProps = FormatterProps<TRow>;
export type OnRowSelectionChangeFn = (checked: boolean, isShiftClick: boolean) => void;
