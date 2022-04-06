export const kDiagramToolID = "Diagram";

// Taken from most recent tag when code was last synced from quantity-playground repo
// TODO: include a version in the diagram-view export so we can just reference that
// instead
export const kQPVersion = "0.0.10";

// This is a version stored in the state of the tile
// Currently any state with a different version will be ignored.
// In the future we can hopefully we can support migrating older
// state
export const kDiagramToolStateVersion = "0.0.1";

export const kDiagramDefaultWidth = 480;
export const kDiagramDefaultHeight = 320;
