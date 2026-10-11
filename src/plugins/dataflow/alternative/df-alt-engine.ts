import { GNodeType } from "./df-alt-core";


export function engineFetch(startNode: GNodeType, nodeMap: Record<string, GNodeType> ) {
  console.log({"startNode.inputConnections": startNode.inputConnections});
  const predecessors: GNodeType[] = [startNode];
  getPredecessors(startNode, nodeMap, predecessors);
  const nodeOutputs: Record<string, any> = {};
  console.log({predecessors});

  // Go backward through the predecessors.
  // Since they are ordered depth first and we are assuming a non-cyclic graph,
  // this will guarantee the inputs to each predecessor will be available.
  for (let index = predecessors.length - 1; index >= 0; index--) {
    const node = predecessors[index];
    if (!node) continue;
    const inputValues = getInputValues(node, nodeOutputs);
    nodeOutputs[node.id] = node.data(inputValues);
  }
  return nodeOutputs[startNode.id];
}

// This will do a depth first traversal of the tree
function getPredecessors(node: GNodeType, nodeMap: Record<string, GNodeType>, predecessors: GNodeType[]) {
  Object.values(node.inputConnections || {}).forEach(conn => {
    const inputNode = conn && nodeMap[conn.nodeId];
    if (inputNode) {
      predecessors.push(inputNode);
      getPredecessors(inputNode, nodeMap, predecessors);
    }
  });
}

function getInputValues(node: GNodeType, nodeOutputs: Record<string, any>) {
  const inputValues: Record<string, any> = {};
  if (node.inputConnections) {
    Object.entries(node.inputConnections).forEach(([inputPort, connection]) => {
      if (!connection) return;
      const { nodeId: predecessorId, nodePort: predecessorPort } = connection;
      const nodeOutput = nodeOutputs[predecessorId];
      if (!nodeOutput) {
        console.warn("Output from predecessor is not available yet",
          {currentNodeId: node.id, predecessorId, predecessorPort});
        return;
      }
      if (!nodeOutput[predecessorPort]) {
        console.warn("Predecessor didn't provide value on port of connection",
          {currentNodeId: node.id, predecessorId, predecessorPort});
        return;
      }
      inputValues[inputPort] = nodeOutput[predecessorPort];
    });
  }
  return inputValues;
}
