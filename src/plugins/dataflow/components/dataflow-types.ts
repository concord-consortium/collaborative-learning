export const kNewNodeButtonDraggableId = `new-node-button-draggable`;
export const kNewNodeButtonDroppableId = `new-node-button-droppable`;
export const kDataflowDroppableId = `dataflow-droppable`;

export const nodeDraggableId = (nodeType: string, tileId: string) =>
  `${kNewNodeButtonDraggableId}_${tileId}_${nodeType}`;
export const isNodeDraggableId = (id: string) => id.split("_")[0] === kNewNodeButtonDraggableId;
export const nodeDroppableId = (nodeType: string, tileId: string) =>
  `${kNewNodeButtonDroppableId}_${tileId}_${nodeType}`;
export const isNodeDroppableId = (id: string) => id.split("_")[0] === kNewNodeButtonDroppableId;
export const getNodeType = (id: string) => {
  if (isNodeDraggableId(id) || isNodeDroppableId(id)) {
    const parts = id.split("_");
    return parts[parts.length - 1];
  }
};
export const dataflowDroppableId = (tileId: string) =>
  `${kDataflowDroppableId}_${tileId}`;
