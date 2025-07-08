import { useLayoutEffect, useRef } from "react";
import { useCurrent } from "../../../hooks/use-current";
import { getEditableExpression } from "../../../models/data/expression-utils";
import { TableMetadataModelType } from "../../../models/tiles/table/table-content";

export const useEditableExpressions = (metadata: TableMetadataModelType, xName: string) => {
  const metadataRef = useCurrent(metadata);
  const editExpressions = useRef<Map<string, string>>(new Map());
  useLayoutEffect(() => {
    const rawExpressions = metadataRef.current.rawExpressions;
    const canonicalExpressions = metadataRef.current.expressions;
    canonicalExpressions.forEach((canonical, _attrId) => {
      const attrId = String(_attrId);
      const editExpr = getEditableExpression(rawExpressions.get(attrId), canonical, xName);
      editExpr && editExpressions.current?.set(attrId, editExpr);
    });
  }, [metadataRef, xName]);
  return editExpressions;
};
