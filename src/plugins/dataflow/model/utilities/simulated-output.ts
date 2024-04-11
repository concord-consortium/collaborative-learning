import { VariableType } from "@concord-consortium/diagram-view";
import LightIcon from "../../assets/icons/sensor/light.svg";

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
