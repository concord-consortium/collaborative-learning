export const kNewNodeButtonDraggableId = `new-node-button-draggable`;
export const kDataflowDroppableId = `dataflow-droppable`;

export const nodeDraggableId = (nodeType: string, tileId: string) =>
  `${kNewNodeButtonDraggableId}_${tileId}_${nodeType}`;
export const isNodeDraggableId = (id: string) => id.startsWith(kNewNodeButtonDraggableId);
export const getNodeType = (id: string) => {
  if (isNodeDraggableId(id)) {
    const parts = id.split("_");
    return parts[parts.length - 1];
  }
};
export const dataflowDroppableId = (tileId: string) =>
  `${kDataflowDroppableId}_${tileId}`;
