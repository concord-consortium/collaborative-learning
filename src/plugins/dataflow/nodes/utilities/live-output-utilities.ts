import { Node } from "rete";
import { DropdownListControl } from "../controls/dropdown-list-control";

export function getOutputType(node: Node) {
  const outputTypeControl = node.controls.get("liveOutputType") as DropdownListControl;
  return outputTypeControl.getValue();
}
