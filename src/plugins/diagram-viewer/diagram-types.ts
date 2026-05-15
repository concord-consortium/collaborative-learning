export const kDiagramTileType = "Diagram";

// This is a version stored in the state of the tile
// Currently any state with a different version will be ignored.
// In the future we can hopefully support migrating older state
export const kDiagramToolStateVersion = "0.0.3";

export const kDiagramDefaultWidth = 480;
export const kDiagramDefaultHeight = 320;

// The actual id will be of the form `${k-Id}-${tileId}`
export const kNewVariableButtonDraggableId = `new-variable-button-draggable`;
export const kNewVariableButtonDroppableId = `new-variable-button-droppable`;
export const kDiagramDroppableId = `diagram-droppable`;
