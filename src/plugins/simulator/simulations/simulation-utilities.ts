import { VariableType } from "@concord-consortium/diagram-view";

export function findVariable(variableName: string, variables: VariableType[]) {
  return variables.find(variable => variable.name === variableName);
}

export function getFrame(percent: number, numFrames: number) {
  let frame = Math.floor(numFrames * percent);
  frame = Math.max(frame, 0);
  frame = Math.min(frame, numFrames - 1);
  return frame;
}

export function getVariableSuffix(variable: VariableType) {
  if (variable.hasLabel("input")){
    if (variable.hasLabel("position")) return "Position";
    if (variable.hasLabel("position")) return "Reading";
    else return "Sensor";
  }
  if (variable.hasLabel("output")){
    if (variable.hasLabel("physical")) return "Position";
    else return "Output";
  }
}
