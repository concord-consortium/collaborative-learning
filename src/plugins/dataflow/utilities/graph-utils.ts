
import { Node } from "rete";

export function resetGraph (node: Node) {
  node.data.dsMax = undefined;
  node.data.dsMin = undefined;
  node.data.tickMax = undefined;
  node.data.tickMin = undefined;
  Object.keys(node.data.recentValues as any).forEach((key)=>(node.data.recentValues as any)[key]=[]);
}
