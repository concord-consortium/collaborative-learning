import { Node } from "rete";
import { VariableType } from "@concord-consortium/diagram-view";

import { getOutputType } from "../../nodes/utilities/live-output-utilities";

import LightIcon from "../../assets/icons/sensor/light.svg";
import { get } from "lodash";
import { kRoundedOutputTypes } from "./node";

export function findOutputVariable(node: Node, variables?: VariableType[]) {
  if (!variables) return undefined;
  const type = getOutputType(node);
  return variables?.find((variable: VariableType) => variable.getAllOfType("live-output").includes(type));
}

function simulatedHubId(variable: VariableType) {
  return `HUB${variable.name}`;
}

export function simulatedHubName(node: Node) {
  // All varieties of Gripper should display as "Sumulated Gripper"
  const outputType = getOutputType(node);
  const menuName = kRoundedOutputTypes.includes(outputType) ? "Gripper": outputType;
  return `Simulated ${menuName}`;
}

export function simulatedHub(variable: VariableType, node: Node) {
  console.log("| generating simulatedHub", variable, node);
  return {
    id: simulatedHubId(variable),
    name: simulatedHubName(node) || "",
    icon: LightIcon,
    active: true
  };
}
