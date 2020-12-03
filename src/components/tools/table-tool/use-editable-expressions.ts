import { useRef, useState } from "react";
import { prettifyExpression } from "./expression-utils";

export const useEditableExpressions = (
  rawExpressions: Map<string, string>, canonicalExpressions: Map<string, string>, xName: string
) => {
  const editExpressions = useRef<Map<string, string>>();
  if (!editExpressions.current) {
    editExpressions.current = new Map();
    rawExpressions.forEach((expr, attrId) => {
      // It's not entirely clear what the scenario is for having a canonical expression but not a
      // raw expression, but it's a use case supported by the prior code so we do as well.
      // Perhaps early versions of CLUE only wrote out the canonical expression.
      const editExpr = expr || prettifyExpression(canonicalExpressions.get(attrId), xName);
      editExpr && editExpressions.current?.set(attrId, editExpr);
    });
  }
  return useState(editExpressions.current);
};
