export const kDiagramToolID = "Diagram";

// The version shown to the user for the Diagram tile.
// Currently it is just the version of the diagram-view library.
// TODO: include a version in the diagram-view library so we can reference that
// instead
export const kQPVersion = "0.0.10";

// This is a version stored in the state of the tile
// Currently any state with a different version will be ignored.
// In the future we can hopefully we can support migrating older
// state
export const kDiagramToolStateVersion = "0.0.1";

export const kDiagramDefaultWidth = 480;
export const kDiagramDefaultHeight = 320;
