import { useEffect, useRef } from "react";
import { useCurrent } from "../../../hooks/use-current";
import { IGridContext } from "./table-types";
import { TableContentModelType } from "../../../models/tiles/table/table-content";
import { ITileModel } from "../../../models/tiles/tile-model";

interface IProps {
  gridContext: IGridContext;
  model: ITileModel;
  content: TableContentModelType;
  readOnly?: boolean;
  onRequestUniqueTitle?: () => string | undefined;
  onSetTableTitle?: (title: string) => void;
  requestRowHeight: () => void;
}
export const useTableTitle = ({
  gridContext, model, content, readOnly, onRequestUniqueTitle, onSetTableTitle, requestRowHeight
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

  // request a default title if we don't already have one
  const onRequestUniqueTitleRef = useRef(onRequestUniqueTitle);
  useEffect(() => {
    if (!content.dataSet.name) {
      // wait for all tiles to have registered their callbacks
      setTimeout(() => {
        const _title = onRequestUniqueTitleRef.current?.();
        if (_title) {
          content.dataSet.setName(_title);
        }
      }, 100);
    }
    // don't request a title after we've been unmounted
    return () => onRequestUniqueTitleRef.current = undefined;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { onBeginTitleEdit, onEndTitleEdit };
};
