import { types } from "mobx-state-tree";
import { DiagramContentModel } from "./diagram-content";
import { kDiagramToolStateVersion } from "./diagram-types";

// When this model is instantiated it will actually modify DiagramContentModel
// This is unexpected and is demonstrated here: 
// `src/models/mst.test.ts` 
export const DiagramMigrator = types.snapshotProcessor(DiagramContentModel, {
  preProcessor(snapshot: any) {
    // In the future this can do migration of older states
    // Right now we just return an empty state for any state we can't handle
    if(snapshot.version !== kDiagramToolStateVersion) {
      console.warn("Diagram Tile could not be loaded", snapshot);
      return {};
    }
    return snapshot;
  }
});
