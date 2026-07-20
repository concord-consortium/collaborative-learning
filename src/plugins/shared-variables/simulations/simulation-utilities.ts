import { VariableType } from "@concord-consortium/diagram-view";

export function isInputVariable(variable: VariableType) {
  return variable.hasLabel("input");
}

export function isOutputVariable(variable: VariableType) {
  return variable.hasLabel("output");
}

// A variable whose value a running simulation produces at runtime: sensor inputs (driven by the
// sensor emulator) and live outputs (driven by the dataflow program). Their value is overwritten
// every step, so it is runtime state rather than authored content. Note this excludes user-driven
// inputs like a potentiometer position, which carry an "input" label but no "sensor:" label.
export function isSimulationDrivenVariable(variable: VariableType) {
  return variable.hasLabelType("sensor") || variable.hasLabelType("live-output");
}

export function getVariableDecimalPlaces(variable: VariableType) {
  const decimalPlaces = Number(variable.getType("decimalPlaces"));
  return isFinite(decimalPlaces) ? decimalPlaces : 2;
}
