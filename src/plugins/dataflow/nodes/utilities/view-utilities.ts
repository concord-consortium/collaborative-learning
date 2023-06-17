import { NodeEditor, Node } from "rete";

import { Rect, scaleRect, unionRect } from "../../utilities/rect";

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
