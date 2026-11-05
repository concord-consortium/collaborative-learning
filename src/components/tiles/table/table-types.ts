import { Column, RenderCellProps, RenderHeaderCellProps } from "react-data-grid";
import { defaultBoldFont } from "../../constants";

export const kIndexColumnWidth = 34;
export const kIndexColumnWidthWithLabel = kIndexColumnWidth + 7;
export const kDefaultColumnWidth = 80;
export const kMinColumnWidth = kDefaultColumnWidth;
// A column sized to its heading stops here. Without a cap, one long heading sizes its column wider
// than the tile it sits in, and the table opens scrolled sideways with the other columns off-screen
// -- a worse first view than a heading that wraps. Past this the heading wraps instead.
export const kMaxAutoColumnWidth = 200;
export const kControlsColumnWidth = 36;
export const kCellHorizontalPadding = 8; // includes both sides
export const kCellVerticalPadding = 2; // only includes a single side
export const kCellLineHeight = 18;
export const kRowHeight = kCellLineHeight + 2 * kCellVerticalPadding;
export const kDefaultImageCellHeight = 32;
export const kHeaderRowHeight = 34;
export const kHeaderCellHorizontalPadding = 32; // half on either side of text
// What the sort and remove buttons cover inside the header cell. Each is 36px wide and positioned
// 4px outside its edge (`column-header-cell.scss`), so 32px of each falls inside; their margins do
// not move them, since each sets only one of left/right. Measured in the browser rather than read
// off the stylesheet, which is easy to misread.
export const kHeaderControlsWidth = 64;
// The header is bold; measuring it as regular under-measures.
export const kHeaderFont = defaultBoldFont;
export const kExpressionCellPadding = 20;
export const kTitlePadding = 8;
export interface IGridContext {
  showRowLabels: boolean;
  isColumnSelected: (columnId: string) => boolean;
  onSelectColumn: (columnId: string) => void;
  isSelectedCaseInRow: (rowIdx: number) => boolean;
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
  hasData?: boolean;

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
export type TFormatterProps = RenderCellProps<TRow>;
export type THeaderRendererProps = RenderHeaderCellProps<TRow>;
export type OnRowSelectionChangeFn = (checked: boolean, isShiftClick: boolean) => void;

export const isDataColumn = (column: TColumn) => {
  return (column.key !== kIndexColumnKey) && (column.key !== kControlsColumnKey);
};
