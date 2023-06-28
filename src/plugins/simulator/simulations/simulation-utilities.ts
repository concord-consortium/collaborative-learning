import { VariableType } from "@concord-consortium/diagram-view";

export function findVariable(variableId: string, variables: VariableType[]) {
  return variables.find(variable => variable.id === variableId);
}

export function getFrame(percent: number, numFrames: number) {
  let frame = Math.floor(numFrames * percent);
  frame = Math.max(frame, 0);
  frame = Math.min(frame, numFrames - 1);
  return frame;
}
