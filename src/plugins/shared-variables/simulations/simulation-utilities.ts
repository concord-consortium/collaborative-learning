import { VariableType } from "@concord-consortium/diagram-view";
import { kHumidityKey, kTemperatureKey } from "../../shared-assets/icons/icon-utilities";

export function isInputVariable(variable: VariableType) {
  return variable.hasLabel("input");
}

export function isOutputVariable(variable: VariableType) {
  return variable.hasLabel("output");
}

export function getVariableDecimalPlaces(variable: VariableType) {
  const hasTwoDecimalPlaces = [kTemperatureKey, kHumidityKey];
  return variable.name && hasTwoDecimalPlaces.includes(variable.name) ? 2 : 0;
}
