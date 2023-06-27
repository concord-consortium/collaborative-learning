// Simulated Channels are defined by shared variables created by simulations.
// Shared variables with names starting with "input_" become simulated channels.
// A sensor using a simulated channel uses the shared variable's value as its own on every tick.

import { VariableType } from "@concord-consortium/diagram-view";

import { NodeChannelInfo } from "./channel";
import { NodeSensorTypes } from "./node";
import { inputVariableNamePart } from "../../../shared-variables/simulations/simulation-utilities";

export const kSimulatedChannelType = "simulated-channel";

function simulatedChannelId(variable: VariableType) {
  return `SIM${inputVariableNamePart(variable)}`;
}

function simulatedChannelName(variable: VariableType) {
  return inputVariableNamePart(variable);
}

export function simulatedChannel(variable: VariableType): NodeChannelInfo {
  const name = inputVariableNamePart(variable) ?? "";
  const lowerName = name.toLowerCase();
  const sensorType = NodeSensorTypes.find(nst => nst.name.toLowerCase() === lowerName);
  const type = sensorType?.type ?? kSimulatedChannelType;
  return {
    hubId: "",
    hubName: "",
    channelId: simulatedChannelId(variable),
    missing: false,
    type,
    units: variable.computedUnit ?? "",
    value: variable.computedValue ?? 0,
    name: simulatedChannelName(variable) || "",
    simulated: true,
    simulatedVariable: variable
  };
}
