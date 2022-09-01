import { useCallback, useRef } from "react";
import { kMinColumnWidth } from "./table-types";
import { IAttribute } from "../../../models/data/attribute";

export const useMeasureColumnWidth = () => {
  // In the future, these should come from the model rather than being saved in react land
  const userColumnWidths = useRef<Record<string, number>>({});

  const measureColumnWidth = useCallback((attr: IAttribute) => {
    return Math.max(kMinColumnWidth, userColumnWidths.current[attr.id] || 0);
  }, []);

  return { userColumnWidths, measureColumnWidth };
};
