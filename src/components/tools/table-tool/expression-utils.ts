import { Parser } from "expr-eval";
import { kSerializedXKey } from "../../../models/tools/table/table-model-types";

export const getEditableExpression = (
  rawExpression: string | undefined, canonicalExpression: string, xName: string
) => {
  // Raw expressions are cleared when x attribute is renamed, in which case
  // we regenerate the "raw" expression from the canonical expression.
  return rawExpression || prettifyExpression(canonicalExpression, xName);
};

export const canonicalizeExpression = (displayExpression: string, xName: string) => {
  if (xName && displayExpression) {
    const parser = new Parser();
    const canonicalExpression = parser.parse(displayExpression).substitute(xName, kSerializedXKey);
    return canonicalExpression.toString();
  } else {
    return displayExpression;
  }
};

export const prettifyExpression = (canonicalExpression: string | undefined, xName: string) => {
  if (xName && canonicalExpression) {
    const parser = new Parser();
    let expression = parser.parse(canonicalExpression).substitute(kSerializedXKey, xName).toString();
    if (expression.charAt(0) === "(" && expression.charAt(expression.length - 1) === ")") {
      expression = expression.substring(1, expression.length - 1);
    }
    return expression;
  } else {
    return canonicalExpression;
  }
};

export const validateExpression = (expressionStr: string, xName: string) => {
  if (!expressionStr || !xName) return;
  const parser = new Parser();
  try {
    const expression = parser.parse(expressionStr);
    const unknownVar = expression.variables().find(variable => variable !== xName);
    if (unknownVar) {
      return `Unrecognized variable "${unknownVar}" in expression.`;
    }
    if (xName) {
      // Attempt an evaluation to check for errors e.g. invalid function names
      expression.evaluate({[xName]: 1});
    }
  } catch {
    return "Could not understand expression. Make sure you supply all operands " +
    "and use a multiplication sign where necessary, e.g. 3 * x + 4 instead of 3x + 4.";
  }
};
