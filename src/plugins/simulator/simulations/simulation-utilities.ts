import { VariableType } from "@concord-consortium/diagram-view";

export function findVariable(variableName: string, variables: VariableType[]) {
  return variables.find(variable => variable.name === variableName);
}
