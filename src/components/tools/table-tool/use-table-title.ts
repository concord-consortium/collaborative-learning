import { useCallback, useEffect, useRef } from "react";
import { useCurrent } from "../../../hooks/use-current";
import { IDataSet } from "../../../models/data/data-set";
import { IGridContext } from "./table-types";

interface IProps {
  gridContext: IGridContext;
  dataSet: IDataSet;
  readOnly?: boolean;
  onRequestUniqueTitle?: () => string | undefined;
  onSetTableTitle?: (title: string) => void;
}
export const useTableTitle = ({
  gridContext, dataSet, readOnly, onRequestUniqueTitle, onSetTableTitle
}: IProps) => {

  const getTitle = useCallback(() => dataSet.name, [dataSet.name]);
  const editingTitle = useCurrent(getTitle());

  const onBeginTitleEdit = () => {
    editingTitle.current = getTitle();
    gridContext.onClearSelection();
    return !readOnly;
  };
  const onEndTitleEdit = (title?: string) => {
    if (!readOnly && (title != null) && (title !== editingTitle.current)) {
      onSetTableTitle?.(title);
    }
  };

  // request a default title if we don't already have one
  const onRequestUniqueTitleRef = useRef(onRequestUniqueTitle);
  useEffect(() => {
    if (!dataSet.name) {
      // wait for all tiles to have registered their callbacks
      setTimeout(() => {
        const _title = onRequestUniqueTitleRef.current?.();
        if (_title) {
          dataSet.setName(_title);
        }
      }, 100);
    }
    // don't request a title after we've been unmounted
    return () => onRequestUniqueTitleRef.current = undefined;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { getTitle, onBeginTitleEdit, onEndTitleEdit };
};
