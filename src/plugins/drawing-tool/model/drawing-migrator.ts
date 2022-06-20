import { types } from "mobx-state-tree";
import { DrawingContentModel } from "./drawing-content";
import { playbackChanges } from "./drawing-change-playback";
import { kDrawingStateVersion } from "./drawing-types";
import { clone } from "lodash";


export const isDrawingTileImport = (snapshot: any) =>
              (snapshot?.type === "Drawing") && (snapshot.objects != null) && !snapshot.changes;

// When this model is instantiated it will actually modify DiagramContentModel
// This is unexpected and is demonstrated here: 
// `src/models/mst.test.ts` 
export const DrawingMigrator = types.snapshotProcessor(DrawingContentModel, {
  preProcessor(snapshot: any) {
    // Right now we have 3 kinds of state:
    // - state with a version: current format of state
    // - state without a version and without a changes array: this is the old import format
    // - state without a version and with a changes array: this is the old format of state
    if(snapshot.version === kDrawingStateVersion) {
      return snapshot;
    }

    // This is looking for the state without a version and with an array of objects
    if(isDrawingTileImport(snapshot)) {
      // All we currently need to do in this case is add a version.
      // If the internal format of state changes, then we might need do some migration
      // here.  However in most cases the content that is being imported is under our 
      // control, so we can probably just update the content.
      // 
      // For now the version is hard coded, if the current state version 
      // changes this code will break. Hopefully that is a good reminder that 
      // the un versioned content should be checked when the state version changes. 
      // If all of the un versioned content is compatible then the hardcoded version
      // below can be bumped.
      const newSnapshot = clone(snapshot);
      newSnapshot.version = "1.0.0";
      return newSnapshot;
    }

    // Check to see if we can be converted
    if(!snapshot.changes) {
      console.warn("Drawing Tile could not be loaded", snapshot);
      return {};
    }

    return playbackChanges(snapshot.changes);
  }
});
