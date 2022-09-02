import React, { useCallback } from "react";
import { TColumn } from "./table-types";

interface IUseColumnResize {
  columns: TColumn[];
  userColumnWidths: React.MutableRefObject<Record<string, number>>;
  requestRowHeight: () => void;
  triggerRowChange: () => void;
}
export const useColumnResize = ({
  columns, userColumnWidths, requestRowHeight, triggerRowChange
}: IUseColumnResize) => {

  // This is called constantly as the user resizes the column. When we start saving the width to the model,
  // we'll only want to do so when the user ends adjusting the width.
  const onColumnResize = useCallback((idx: number, width: number) => {
    userColumnWidths.current[columns[idx].key] = width;
    requestRowHeight();
    triggerRowChange(); // triggerRowChange is used because triggerColumnChange doesn't force a rerender
  }, [columns, userColumnWidths, requestRowHeight, triggerRowChange]);

  return { onColumnResize };
};
