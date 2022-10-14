import { useCallback, useEffect, useRef } from "react";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { useCurrent } from "../../../hooks/use-current";
import { IGridContext } from "./table-types";
import { TableContentModelType } from "../../../models/tools/table/table-content";

interface IProps {
  gridContext: IGridContext;
  model: ToolTileModelType;
  readOnly?: boolean;
  onRequestUniqueTitle?: () => string | undefined;
  onSetTableTitle?: (title: string) => void;
  requestRowHeight: () => void;
}
export const useTableTitle = ({
  gridContext, model, readOnly, onRequestUniqueTitle, onSetTableTitle, requestRowHeight
}: IProps) => {
  
  const tableContent = model.content as TableContentModelType;
  const getTitle = useCallback(() => tableContent.dataSet.name, [tableContent]);
  const editingTitle = useCurrent(getTitle());

  const onBeginTitleEdit = () => {
    editingTitle.current = getTitle();
    gridContext.onClearSelection();
    return !readOnly;
  };
  const onEndTitleEdit = (title?: string) => {
    if (!readOnly && (title != null) && (title !== editingTitle.current)) {
      onSetTableTitle?.(title);
      requestRowHeight();
    }
  };

  // request a default title if we don't already have one
  const onRequestUniqueTitleRef = useRef(onRequestUniqueTitle);
  useEffect(() => {
    if (!tableContent.dataSet.name) {
      // wait for all tiles to have registered their callbacks
      setTimeout(() => {
        const _title = onRequestUniqueTitleRef.current?.();
        if (_title) {
          tableContent.dataSet.setName(_title);
        }
      }, 100);
    }
    // don't request a title after we've been unmounted
    return () => onRequestUniqueTitleRef.current = undefined;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { getTitle, onBeginTitleEdit, onEndTitleEdit };
};
