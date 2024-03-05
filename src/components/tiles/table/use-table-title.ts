import { useCurrent } from "../../../hooks/use-current";
import { IGridContext } from "./table-types";
import { TableContentModelType } from "../../../models/tiles/table/table-content";
import { ITileModel } from "../../../models/tiles/tile-model";

interface IProps {
  gridContext: IGridContext;
  model: ITileModel;
  content: TableContentModelType;
  readOnly?: boolean;
  onSetTableTitle?: (title: string) => void;
  requestRowHeight: () => void;
}
export const useTableTitle = ({
  gridContext, model, content, readOnly, onSetTableTitle, requestRowHeight
}: IProps) => {
  const editingTitle = useCurrent(model.computedTitle);

  const onBeginTitleEdit = () => {
    editingTitle.current = model?.computedTitle;
    gridContext.onClearSelection();
    return !readOnly;
  };
  const onEndTitleEdit = (title?: string) => {
    if (!readOnly && (title != null) && (title !== editingTitle.current)) {
      // This sets the title and triggers a column change
      onSetTableTitle?.(title);
      requestRowHeight();
    }
  };

  return { onBeginTitleEdit, onEndTitleEdit };
};
