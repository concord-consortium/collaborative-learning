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

export function outputsToAnyRelay(node: Node) {
  return kMicroBitHubRelaysIndexed.includes(getOutputType(node));
}

export function outputsToAnyGripper(node: Node) {
  return kGripperOutputTypes.includes(getOutputType(node));
}

export function getLiveOptions(node: Node, deviceFamily: string, sharedVar?: VariableType ) {
  const options: ListOption[] = [];
  const simOption = sharedVar && simulatedHub(sharedVar);
  const anyOuputFound = simOption || deviceFamily === "arduino" || deviceFamily === "microbit";
  const { liveGripperOption, warningOption } = baseLiveOutputOptions;

  if (sharedVar && simOption) {
    options.push(simOption);
  }

  if (outputsToAnyRelay(node) && deviceFamily === "microbit") {
    options.push(...NodeMicroBitHubs);
  }

  if (outputsToAnyGripper(node) && deviceFamily === "arduino") {
    options.push(liveGripperOption);
  }

  if (!anyOuputFound) options.push(warningOption);

  return options;
}

export function setLiveOutputOpts(node: Node, deviceFamily: string, sharedVar?: VariableType) {
  const hubSelect = getHubSelect(node);
  const options = getLiveOptions(node, deviceFamily, sharedVar);
  const selectedOption = options.find(option => option && option.name === hubSelect.getValue());
  const firstOption = !selectedOption ? options[0] : undefined;
  if (firstOption) hubSelect.setValue(firstOption.name);
  hubSelect.setOptions(options);
}
