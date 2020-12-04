import { useLayoutEffect, useRef } from "react";
import { getEditableExpression } from "./expression-utils";

export const useEditableExpressions = (
  rawExpressions: Map<string, string>, canonicalExpressions: Map<string, string>, xName: string
) => {
  const editExpressions = useRef<Map<string, string>>(new Map());
  useLayoutEffect(() => {
    canonicalExpressions.forEach((canonical, attrId) => {
      const editExpr = getEditableExpression(rawExpressions.get(attrId), canonical, xName);
      editExpr && editExpressions.current?.set(attrId, editExpr);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return editExpressions;
};
