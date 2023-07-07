import { Node } from "rete";
import { DropdownListControl } from "../controls/dropdown-list-control";
import { kMicroBitHubRelaysIndexed, kGripperOutputTypes } from "../../model/utilities/node";

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

export function nodeUsesMicroBitHub(node: Node) {
  return kMicroBitHubRelaysIndexed.includes(getOutputType(node));
}

export function nodeUsesGripper(node: Node) {
  return kGripperOutputTypes.includes(getOutputType(node));
}
