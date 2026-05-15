import React, { useCallback } from "react";
import { kMinColumnWidth, TColumn } from "./table-types";
import { TableContentModelType } from "../../../models/tiles/table/table-content";

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
  // We had to modify react-data-grid to add the third `complete` boolean argument,
  // which is true when the user has finished modifying the column width (mouseup).
  // Authoritative widths are written to the model on `complete`; in-progress widths
  // are kept in refs and surfaced to <ReactDataGrid> via its `columnWidths` prop.
  const onColumnResize = useCallback((idx: number, width: number, complete: boolean) => {
    const attrId = columns[idx].key;
    const legalWidth = Math.max(kMinColumnWidth, width);
    if (complete) {
      // We're finished updating the width, so save it to the model
      content.setColumnWidth(attrId, legalWidth);
      resizeColumn.current = undefined;
      resizeColumnWidth.current = undefined;
    } else {
      // We're not finished updating the width, so just save it in react for now
      resizeColumn.current = attrId;
      resizeColumnWidth.current = legalWidth;
    }
    requestRowHeight();
    triggerRowChange(); // triggerRowChange is used because triggerColumnChange doesn't force a rerender
  }, [columns, content, requestRowHeight, resizeColumn, resizeColumnWidth, triggerRowChange]);

  return { onColumnResize };
};
