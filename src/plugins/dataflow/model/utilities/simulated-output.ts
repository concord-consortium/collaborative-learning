import { Node } from "rete";
import { VariableType } from "@concord-consortium/diagram-view";

import { getOutputType } from "../../nodes/utilities/live-output-utilities";

import LightIcon from "../../assets/icons/sensor/light.svg";

export function findOutputVariable(node: Node, variables?: VariableType[]) {
  if (!variables) return undefined;
  const type = getOutputType(node);
  return variables?.find((variable: VariableType) => variable.getAllOfType("live-output").includes(type));
}

function simulatedHubId(variable: VariableType) {
  return `HUB${variable.id}`;
}

export function simulatedHubName(node: Node) {
  return `Simulated ${getOutputType(node)}`;
}

export function simulatedHub(variable: VariableType, node: Node) {
  return {
    id: simulatedHubId(variable),
    name: simulatedHubName(node) || "",
    icon: LightIcon,
    active: true
  };
}
