import React, { useCallback, useRef } from "react";
import { TColumn } from "./table-types";

interface IUseColumnResize {
  columns: TColumn[];
  requestRowHeight: () => void;
  resizeColumn: React.MutableRefObject<string | undefined>;
  resizeColumnWidth: React.MutableRefObject<number | undefined>;
  triggerRowChange: () => void;
  userColumnWidths: React.MutableRefObject<Record<string, number>>;
}
export const useColumnResize = ({
  columns, requestRowHeight, resizeColumn, resizeColumnWidth, triggerRowChange, userColumnWidths
}: IUseColumnResize) => {
  const startWidth = useRef<number | undefined>();
  const resizeInterval = useRef<any>();

  // This is called constantly as the user resizes the column. When we start saving the width to the model,
  // we'll only want to do so when the user ends adjusting the width.
  const onColumnResize = useCallback((idx: number, width: number) => {
    const clearRefs = () => {
      resizeColumn.current = undefined;
      resizeColumnWidth.current = undefined;
      startWidth.current = undefined;
      resizeInterval.current = undefined;
    };
  
    const saveResize = () => {
      if (resizeColumn.current && resizeColumnWidth.current !== undefined) {
        console.log(`saving resize for ${resizeColumn.current}`);
        if (resizeColumnWidth.current !== startWidth.current) {
          // TODO: Save to model
          userColumnWidths.current[resizeColumn.current] = resizeColumnWidth.current;
        }
        clearRefs();
      }
    };

    const attrId = columns[idx].key;
    if (resizeColumn.current === attrId) {
      // This column is already being resized
      clearInterval(resizeInterval.current);
      resizeColumnWidth.current = width;
      resizeInterval.current = setTimeout(() => { saveResize(); }, 500);
    } else {
      if (resizeColumn.current !== undefined) {
        // Another column was being changed, so finish that before starting to change the new column
        saveResize();
      }
      resizeColumn.current = attrId;
      resizeColumnWidth.current = width;
      // TODO: Get this from the model
      startWidth.current = userColumnWidths.current[attrId];
      resizeInterval.current = setTimeout(() => { saveResize(); }, 500);
    }
    // userColumnWidths.current[columns[idx].key] = width;
    requestRowHeight();
    triggerRowChange(); // triggerRowChange is used because triggerColumnChange doesn't force a rerender
  }, [columns, requestRowHeight, resizeColumn, resizeColumnWidth, triggerRowChange, userColumnWidths]);

  return { onColumnResize };
};
