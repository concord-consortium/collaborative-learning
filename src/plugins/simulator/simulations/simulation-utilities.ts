import { VariableType } from "@concord-consortium/diagram-view";

export function findVariable(variableId: string, variables: VariableType[]) {
  return variables.find(variable => variable.id === variableId);
}
