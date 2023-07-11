import { Node } from "rete";
import { DropdownListControl } from "../controls/dropdown-list-control";
import { kMicroBitHubRelaysIndexed, kGripperOutputTypes, NodeMicroBitHubs } from "../../model/utilities/node";
import { VariableType } from "@concord-consortium/diagram-view";
import { NodeChannelInfo } from "../../model/utilities/channel";
import { simulatedHub } from "../../model/utilities/simulated-output";
import Multiply from "../../assets/icons/math/multiply.svg";
import AdvancedGrabber from "../../assets/icons/output/advanced-grabber.svg"

interface NodeOutputValue {
  val: number;
  outType: string;
}

export function getHubSelect(node: Node) {
  return node.controls.get("hubSelect") as DropdownListControl;
}

export function getOutputType(node: Node) {
  const outputTypeControl = node.controls.get("liveOutputType") as DropdownListControl;
  if (outputTypeControl) return outputTypeControl.getValue();
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

export function getLiveOptions(node: Node, sharedVar?: VariableType, device?: string | null) {
  // console.log("| 1 getLiveOptions",
  //   "\n       node:", node,
  //   "\n  sharedVar:", sharedVar,
  //   "\n     device:", device
  // );
  let options: any[] = [];
  const simOption = sharedVar && simulatedHub(sharedVar);
  const anyOuputFound = simOption || device === "arduino" || device === "microbit";

  const liveGripperOption = {
    active: false,
    icon: AdvancedGrabber,
    id: "bb-gripper",
    name: "Backyard Brains Gripper",
  };

  const warningOption = {
    active: true,
    icon: Multiply,
    id: "no-outputs-found",
    name: "use device or sim",
  };

  if (sharedVar) {
    options.push(simOption);
  }

  if (outputsToAnyRelay(node) && device === "microbit") {
    options.push(...NodeMicroBitHubs);
  }

  if (outputsToAnyGripper(node) && device === "arduino") {
    options.push(liveGripperOption);
  }

  if (!anyOuputFound) options.push(warningOption);

  return options;
}
