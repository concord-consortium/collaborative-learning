import React, { useCallback, useRef } from "react";
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
  const startWidth = useRef<number | undefined>();
  const resizeInterval = useRef<any>();

  // This is called constantly as the user resizes the column.
  // We don't want to constantly update the model, but we do want to constantly update the component.
  // So keep track of the column being resized, and only update the model when the user hasn't adjusted its
  // width for half a second.
  const onColumnResize = useCallback((idx: number, width: number) => {
    const legalColumnWidth = (w: number) => Math.max(kMinColumnWidth, w);
    const clearRefs = () => {
      resizeColumn.current = undefined;
      resizeColumnWidth.current = undefined;
      startWidth.current = undefined;
      resizeInterval.current = undefined;
    };
    const saveResize = () => {
      if (resizeColumn.current && resizeColumnWidth.current !== undefined) {
        if (resizeColumnWidth.current !== startWidth.current) {
          content.setColumnWidth(resizeColumn.current, resizeColumnWidth.current);
        }
        clearRefs();
      }
    };
    const saveTimeout = () => setTimeout(() => { saveResize(); }, 250);

    const attrId = columns[idx].key;
    if (resizeColumn.current === attrId) {
      // This column is already being resized
      clearInterval(resizeInterval.current);
      resizeColumnWidth.current = legalColumnWidth(width);
      resizeInterval.current = saveTimeout();
    } else {
      if (resizeColumn.current !== undefined) {
        // Another column was being changed, so finish that before starting to change the new column
        saveResize();
      }
      resizeColumn.current = attrId;
      resizeColumnWidth.current = legalColumnWidth(width);
      startWidth.current = content.columnWidth(attrId);
      resizeInterval.current = saveTimeout();
    }
    requestRowHeight();
    triggerRowChange(); // triggerRowChange is used because triggerColumnChange doesn't force a rerender
  }, [columns, content, requestRowHeight, resizeColumn, resizeColumnWidth, triggerRowChange]);

  return { onColumnResize };
};
