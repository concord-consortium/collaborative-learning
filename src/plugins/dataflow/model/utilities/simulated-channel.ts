// Simulated Channels are defined by shared variables created by simulations.
// Shared variables with names starting with "input_" become simulated channels.
// A sensor using a simulated channel uses the shared variable's value as its own on every tick.

import { VariableType } from "@concord-consortium/diagram-view";

import { NodeChannelInfo } from "./channel";

export const kSimulatedChannelType = "simulated-channel";

function simulatedChannelId(variable: VariableType) {
  return `SIM${variable.id}`;
}

function simulatedChannelName(variable: VariableType) {
  return variable?.displayName ?? "";
}

function simulatedChannelType(variable: VariableType) {
  return variable.getType("sensor") ?? kSimulatedChannelType;
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
