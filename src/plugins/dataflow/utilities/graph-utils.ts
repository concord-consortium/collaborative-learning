
import { Node } from "rete";

export function resetGraph (node: Node) {
  const data = node.data;
  if (data.dsMax) data.dsMax = undefined;
  if (data.dsMin) data.dsMin = undefined;
  if (data.tickMax) data.tickMax = undefined;
  if (data.tickMin) data.tickMin = undefined;
  const recentValues = data.recentValues;
  if (typeof recentValues === 'object' && !Array.isArray(recentValues) && recentValues !== null) {
    Object.keys(recentValues).forEach(key => (recentValues as any)[key] = []);
  }
}
