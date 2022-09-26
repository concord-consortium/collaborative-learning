import React, { useCallback } from "react";
import { kMinColumnWidth, TColumn } from "./table-types";
import { TableContentModelType } from "../../../models/tools/table/table-content";

interface IUseColumnResize {
  columns: TColumn[];
  content: TableContentModelType;
  requestRowHeight: () => void;
  resizeColumn: React.MutableRefObject<string | undefined>;
  resizeColumnWidth: React.MutableRefObject<number | undefined>;
  triggerRowChange: () => void;
}
export const useColumnResize = ({
  columns, content, requestRowHeight, resizeColumn, resizeColumnWidth, triggerRowChange
}: IUseColumnResize) => {

  // This is called constantly as the user resizes the column.
  // We don't want to constantly update the model, but we do want to constantly update the component.
  // So keep track of the column being resized, and only update the model when the user hasn't adjusted its
  // width for half a second.
  const onColumnResize = useCallback((idx: number, width: number, complete: boolean) => {
    const attrId = columns[idx].key;
    const legalWidth = Math.max(kMinColumnWidth, width);
    if (complete) {
      content.setColumnWidth(attrId, legalWidth);
      resizeColumn.current = undefined;
      resizeColumnWidth.current = undefined;
    } else {
      resizeColumn.current = attrId;
      resizeColumnWidth.current = legalWidth;
    }
    requestRowHeight();
    triggerRowChange(); // triggerRowChange is used because triggerColumnChange doesn't force a rerender
    return true;
  }, [columns, content, requestRowHeight, resizeColumn, resizeColumnWidth, triggerRowChange]);

  return { onColumnResize };
};
