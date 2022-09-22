import { useCallback, useRef } from "react";
import { kMinColumnWidth } from "./table-types";
import { IAttribute } from "../../../models/data/attribute";
import { TableContentModelType } from "../../../models/tools/table/table-content";

interface IUseMeasureColumnWidth {
  content: TableContentModelType
}
export const useMeasureColumnWidth = ({ content }: IUseMeasureColumnWidth) => {
  // The column that is currently being modified
  const resizeColumn = useRef();
  // The current width of the column being modified
  const resizeColumnWidth = useRef();
  // In the future, these should come from the model rather than being saved in react land
  const userColumnWidths = useRef<Record<string, number>>({});

  const measureColumnWidth = useCallback((attr: IAttribute) => {
    // return Math.max(kMinColumnWidth, userColumnWidths.current[attr.id] || 0);
    if (resizeColumn.current === attr.id && resizeColumnWidth.current !== undefined) {
      return resizeColumnWidth.current;
    } else {
      return Math.max(kMinColumnWidth, userColumnWidths.current[attr.id] || 0);
      // TODO: Return the width from the model
      // return content.columnWidth(attr.id);
    }
  }, []);

  return { measureColumnWidth, resizeColumn, resizeColumnWidth, userColumnWidths };
};
