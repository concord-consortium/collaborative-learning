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
  return `HUB${variable.name}`;
}

export function simulatedHubName(variable: VariableType) {
  return `Simulated ${variable.displayName}`;
}

export function simulatedHub(variable: VariableType) {
  return {
    id: simulatedHubId(variable),
    name: simulatedHubName(variable) || "",
    icon: LightIcon,
    active: true
  };
}
