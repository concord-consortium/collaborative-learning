import { VariableType } from "@concord-consortium/diagram-view";

const kInputVariablePrefix = "input_";
const kOutputVariablePrefix = "output_";

export function inputVariableNamePart(variable: VariableType) {
  return variable.name?.slice(kInputVariablePrefix.length);
}

export function isInputVariable(variable: VariableType) {
  return variable.name?.startsWith(kInputVariablePrefix);
}

export function isOutputVariable(variable: VariableType) {
  return variable.name?.startsWith(kOutputVariablePrefix);
}

export function outputVariableNamePart(variable: VariableType) {
  return variable.name?.slice(kOutputVariablePrefix.length);
}
