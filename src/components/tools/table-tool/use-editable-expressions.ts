import { useLayoutEffect, useRef } from "react";
import { useCurrent } from "../../../hooks/use-current";
import { TableMetadataModelType } from "../../../models/tools/table/table-content";
import { getEditableExpression } from "./expression-utils";

export const useEditableExpressions = (metadata: TableMetadataModelType, xName: string) => {
  const metadataRef = useCurrent(metadata);
  const editExpressions = useRef<Map<string, string>>(new Map());
  useLayoutEffect(() => {
    const rawExpressions = metadataRef.current.rawExpressions;
    const canonicalExpressions = metadataRef.current.expressions;
    canonicalExpressions.forEach((canonical, attrId) => {
      const editExpr = getEditableExpression(rawExpressions.get(attrId), canonical, xName);
      editExpr && editExpressions.current?.set(attrId, editExpr);
    });
  }, [metadataRef, xName]);
  return editExpressions;
};
