import { NodeEditor, Node } from "rete";
import { Rect, scaleRect, unionRect } from "../../utilities/rect";
import { kEmptyValueString } from "../factories/dataflow-rete-node-factory";

function getBoundingRectOfNode(n: Node, editor: NodeEditor): Rect | undefined {
  const { k } = editor.view.area.transform;
  const nodeView = editor.view.nodes.get(n);
  if (!nodeView) return;
  return scaleRect(new Rect(nodeView.node.position[0], nodeView.node.position[1],
                            nodeView.el.clientWidth, nodeView.el.clientHeight), k);
}

export function getBoundingRectOfNodes(editor: NodeEditor): Rect | undefined {
  let bounds: Rect | undefined;
  editor.nodes.forEach((n: Node) => {
    const nodeBounds = getBoundingRectOfNode(n, editor);
    if (nodeBounds?.isValid) {
      bounds = bounds ? unionRect(bounds, nodeBounds) : nodeBounds;
    }
  });
  return bounds;
}

export function getNewNodePosition(editor: NodeEditor) {
  const kNodesPerColumn = 5;
  const kNodesPerRow = 4;
  const kColumnWidth = 200;
  const kRowHeight = 90;
  const kLeftMargin = 40;
  const kTopMargin = 5;
  const kColumnOffset = 15;

  const numNodes = editor.nodes.length;
  const { k } = editor.view.area.transform;
  const nodePos: [number, number] =
    [kLeftMargin * (1 / k) + Math.floor((numNodes % (kNodesPerColumn * kNodesPerRow)) / kNodesPerColumn)
      * kColumnWidth + Math.floor(numNodes / (kNodesPerColumn * kNodesPerRow)) * kColumnOffset,
    kTopMargin + numNodes % kNodesPerColumn * kRowHeight];
  return nodePos;
}

export function moveNodeToFront(editor: NodeEditor, node: Node, newNode: boolean) {
  const totalNodes = editor.nodes.length;
  const selectedNodeView = editor.view.nodes.get(node);
  const startingZIndex = selectedNodeView?.el.style.zIndex;
  const selectedNodeZ = startingZIndex ? parseInt(startingZIndex, 10) : 0;
  editor.nodes.forEach((n: Node) => {
    const nodeView = editor.view.nodes.get(n);
    if (nodeView) {
      if (node.id === n.id) {
        nodeView.el.style.zIndex = totalNodes.toString();
      } else if (nodeView.el.style.zIndex) {
        const nodeZ = parseInt(nodeView.el.style.zIndex, 10);
        if (nodeZ > selectedNodeZ && !newNode) {
          nodeView.el.style.zIndex = (nodeZ - 1).toString();
        }
      }
    }
  });
}

export function hasFlowIn(node: Node){
  const inputs = Array.from(node.inputs.values());
  if (inputs.length === 0) return false;
  if (node.name === "Control") return inputs[0].connections.length > 0;
  return inputs.some((input) => input.connections.length > 0);
}

export function getNumDisplayStr(n: number){
  return isNaN(n) ? kEmptyValueString : n.toFixed(3).replace(/\.?0+$/, "");
}

export function getInsertionOrder(editor: NodeEditor, id: number) {
  console.log("---------getInsertionOrder---------with id:", id);
  const index = editor.nodes.findIndex((n: Node) => n.id === id);
  return index + 1;
}
//pass in ID
//make an array of all node ids, return the index , add 1 because it needs to be offset.

//edge cases - refresh the page, do ID's start over again

