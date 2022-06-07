import { types } from "mobx-state-tree";
import { DrawingContentModel } from "./drawing-content";
import { playbackChanges } from "./drawing-export";
import { isDrawingTileImportSpec, importDrawingTileSpec } from "./drawing-import";
import { kDrawingStateVersion } from "./drawing-types";

// When this model is instantiated it will actually modify DiagramContentModel
// This is unexpected and is demonstrated here: 
// `src/models/mst.test.ts` 
export const DrawingMigrator = types.snapshotProcessor(DrawingContentModel, {
  preProcessor(snapshot: any) {
    // In the future this can do migration of older versions.
    // Right now we just have 3 kinds of state:
    // - state with a version: current format of state
    // - state without a version and without a changes array: this is the old import format
    // - state without a version and with a changes array: this is the old format of state
    if(snapshot.version === kDrawingStateVersion) {
      return snapshot;
    }

    // FIXME: This is checking for objects and generating changes. 
    // those changes will not be a valid state, so this will throw an error.
    // It should instead mostly just pass the objects through, 
    // it might need to add ids to objects.
    if(isDrawingTileImportSpec(snapshot)) {
      return importDrawingTileSpec(snapshot);
    }

    // Check to see if we can be converted
    if(!snapshot.changes) {
      console.warn("Drawing Tile could not be loaded", snapshot);
      return {};
    }

    return playbackChanges(snapshot.changes);
  }
});
