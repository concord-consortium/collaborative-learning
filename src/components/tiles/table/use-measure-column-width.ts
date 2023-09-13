import { useCallback, useRef } from "react";
import { kMinColumnWidth } from "./table-types";
import { IAttribute } from "../../../models/data/attribute";
import { TableContentModelType } from "../../../models/tiles/table/table-content";

interface IUseMeasureColumnWidth {
  content: TableContentModelType;
}
export const useMeasureColumnWidth = ({ content }: IUseMeasureColumnWidth) => {
  // The id of the column that is currently being modified
  const resizeColumn = useRef<string>();
  // The current width of the column being modified
  const resizeColumnWidth = useRef<number>();

  const measureColumnWidth = useCallback((attr?: IAttribute) => {
    if (!attr) return 0;
    if (resizeColumn.current === attr.id && resizeColumnWidth.current !== undefined) {
      return resizeColumnWidth.current;
    } else {
      return content.columnWidth(attr.id) || kMinColumnWidth;
    }
  }, [content]);

  return { measureColumnWidth, resizeColumn, resizeColumnWidth };
};
