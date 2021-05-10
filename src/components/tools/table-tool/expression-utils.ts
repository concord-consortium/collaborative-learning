import escapeStringRegexp from 'escape-string-regexp';
import { Parser } from "expr-eval";
import { kSerializedXKey, kSerializedXKeyRegEx } from "../../../models/tools/table/table-model-types";

export const getEditableExpression = (
  rawExpression: string | undefined, canonicalExpression: string, xName: string
) => {
  // Raw expressions are cleared when x attribute is renamed, in which case
  // we regenerate the "raw" expression from the canonical expression.
  return rawExpression || prettifyExpression(canonicalExpression, xName);
};

export const canonicalizeExpression = (displayExpression: string, xName: string) => {
  if (!displayExpression || !xName) return displayExpression;
  let result: string;
  try {
    const parser = new Parser();
    const expression = displayExpression.replace(new RegExp(escapeStringRegexp(xName), "g"), kSerializedXKey);
    result = parser.parse(expression).toString();
  }
  catch(e) {
    result = displayExpression;
  }
  return result;
};

export const prettifyExpression = (canonicalExpression: string | undefined, xName: string) => {
  return canonicalExpression && xName
          ? canonicalExpression.replace(kSerializedXKeyRegEx, xName)
          : canonicalExpression;
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
