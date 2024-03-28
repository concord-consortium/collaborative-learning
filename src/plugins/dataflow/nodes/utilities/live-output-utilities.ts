import { Node } from "rete";
import { DropdownListControl, ListOption } from "../controls/dropdown-list-control";
import { kMicroBitHubRelaysIndexed, kGripperOutputTypes,
  NodeMicroBitHubs, baseLiveOutputOptions
} from "../../model/utilities/node";
import { VariableType } from "@concord-consortium/diagram-view";
import { simulatedHub } from "../../model/utilities/simulated-output";

interface NodeOutputValue {
  val: number;
  outType: string;
}

export function getHubSelect(node: Node) {
  return node.controls.get("hubSelect") as DropdownListControl;
}

export function getOutputType(node: Node) {
  const outputTypeControl = node.controls.get("liveOutputType") as DropdownListControl;
  return outputTypeControl?.getValue();
}

export function getNodeValueWithType(node: Node): NodeOutputValue {
  const val = node.data.nodeValue as number;
  const outType = getOutputType(node);
  return { val, outType };
}

// TODO: only keep this if we find it matches live servo behavior
export function getLastValidServoValue(node: Node) {
  const recentValues = node.data.recentValues as Record<string, any>;
  const reversedCopy = recentValues.nodeValue.slice().reverse();
  const foundValid = reversedCopy.find((v: number) => v >= 0 && v <= 180);
  return foundValid || 0;
}

export function outputsToAnyRelay(node: Node) {
  return kMicroBitHubRelaysIndexed.includes(getOutputType(node));
}

export function outputsToAnyGripper(node: Node) {
  return kGripperOutputTypes.includes(getOutputType(node));
}

export function outputsToAnyServo(node: Node) {
  return getOutputType(node) === "Servo";
}

export function getLiveOptions(node: Node, deviceFamily: string, sharedVar?: VariableType ) {
  const options: ListOption[] = [];
  const simOption = sharedVar && simulatedHub(sharedVar);
  const anyOuputFound = simOption || deviceFamily === "arduino" || deviceFamily === "microbit";
  const { liveGripperOption, liveServoOption, warningOption } = baseLiveOutputOptions;

  if (sharedVar && simOption) {
    options.push(simOption);
  }

  if (outputsToAnyRelay(node) && deviceFamily === "microbit") {
    options.push(...NodeMicroBitHubs);
  }

  if (outputsToAnyGripper(node) && deviceFamily === "arduino") {
    options.push(liveGripperOption);
  }

  if (outputsToAnyGripper(node) && deviceFamily !== "arduino") {
    if (!options.includes(warningOption)) {
      options.push(warningOption);
    }
  }

  if (outputsToAnyServo(node) && deviceFamily === "arduino") {
    options.push(liveServoOption);
  }

  if (outputsToAnyServo(node) && deviceFamily !== "arduino") {
    if (!options.includes(warningOption)) {
      options.push(warningOption);
    }
  }

  if (!anyOuputFound && !options.includes(warningOption)) options.push(warningOption);

  return options;
}

export function setLiveOutputOpts(node: Node, deviceFamily: string, sharedVar?: VariableType) {
  const options = getLiveOptions(node, deviceFamily, sharedVar);
  const hubSelect = getHubSelect(node);
  hubSelect.setOptions(options);

  const selectionId = hubSelect.getSelectionId();
  if (!selectionId) hubSelect.setValue(options[0].name);
  // if user successfully connects arduino with warning selected, switch to physical gripper
  if (selectionId === "no-outputs-found" && deviceFamily === "arduino") {
    hubSelect.setValue(baseLiveOutputOptions.liveGripperOption.name);
  }
}
