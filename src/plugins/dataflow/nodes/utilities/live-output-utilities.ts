import { Node } from "rete";
import { DropdownListControl } from "../controls/dropdown-list-control";

export function getHubSelect(node: Node) {
  return node.controls.get("hubSelect") as DropdownListControl;
}

export function getOutputType(node: Node) {
  const outputTypeControl = node.controls.get("liveOutputType") as DropdownListControl;
  return outputTypeControl.getValue();
}
