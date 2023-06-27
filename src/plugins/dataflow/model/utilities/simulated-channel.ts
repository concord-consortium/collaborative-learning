// Simulated Channels are defined by shared variables created by simulations.
// Shared variables with names starting with "input_" become simulated channels.
// A sensor using a simulated channel uses the shared variable's value as its own on every tick.

import { VariableType } from "@concord-consortium/diagram-view";

import { NodeChannelInfo } from "./channel";
import { NodeSensorTypes } from "./node";
import { inputVariableNamePart } from "../../../shared-variables/simulations/simulation-utilities";

// TODO Remove this import
import { kPressureKey } from "../../../simulator/simulations/brainwaves-gripper";

export const kSimulatedChannelType = "simulated-channel";

function simulatedChannelId(variable: VariableType) {
  return `SIM${inputVariableNamePart(variable)}`;
}

function simulatedChannelName(variable: VariableType) {
  return inputVariableNamePart(variable)?.replace("_", " ");
}

function simulatedChannelType(variable: VariableType) {
  // TODO Remove this hard coded reference
  if (variable.name === kPressureKey) return "fsr-reading";
  
  const name = inputVariableNamePart(variable) ?? "";
  const lowerName = name.toLowerCase();
  const sensorType = NodeSensorTypes.find(nst => nst.name.toLowerCase() === lowerName);
  return sensorType?.type ?? kSimulatedChannelType;
}

export function simulatedChannel(variable: VariableType): NodeChannelInfo {
  const type = simulatedChannelType(variable);
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
