import { VariableType } from "@concord-consortium/diagram-view";

export function isInputVariable(variable: VariableType) {
  return variable.hasLabel("input");
}

export function isOutputVariable(variable: VariableType) {
  return variable.hasLabel("output");
}

export function getVariableDecimalPlaces(variable: VariableType) {
  const decimalPlaces = Number(variable.getType("decimalPlaces"));
  return isFinite(decimalPlaces) ? decimalPlaces : 0;
}
