import { types } from "mobx-state-tree";
import { clone } from "lodash";
import { DrawingContentModel } from "./drawing-content";
import { playbackChanges } from "./drawing-change-playback";
import { kDrawingStateVersion } from "./drawing-types";

export const isDrawingChangesFormat = (snapshot: any) =>
              snapshot.changes && Array.isArray(snapshot.changes);

// When this model is instantiated it will actually modify DrawingContentModel
// This is unexpected and is demonstrated here:
// `src/models/mst.test.ts`
export const DrawingMigrator = types.snapshotProcessor(DrawingContentModel, {
  preProcessor(snapshot: any) {
    // Right now we have 4 kinds of potential input:
    // - Version 1.1.0: current format of state
    // - Version 1.0.0: needs groups migration
    // - No version and with `objects`, not `changes`: this is the old import format
    // - No version and with a `changes` array: this is the old format of state


    // Current format
    if(snapshot.version === kDrawingStateVersion) {
      return snapshot;
    }

    if(isDrawingChangesFormat(snapshot)) {
      return playbackChanges(snapshot.changes);
    }

    if (!("version" in snapshot) || snapshot.version === "1.0.0") {
      // Unversioned content with objects, not changes, should be compatible with version 1.0.0.

      // The format change in version 1.1.0 is that groups now have height and width properties,
      // and the contained objects positions and dimensions are relative to the group.

      const migrated = clone(snapshot);
      if (!("objects" in migrated)) {
        migrated.objects = [];
      }
      migrated.objects.forEach((obj: any) => {
        // Only migrate groups that actually look v1.0.0. The v1.0.0 marker is
        // `objectExtents` (which the migration drops); a group lacking width/height
        // is also a v1.0.0 indicator (those properties were introduced in v1.1.0).
        // Without this guard, an unversioned snapshot from a v1.1.0 export — whose
        // groups already have valid width/height — would have those zeroed out,
        // and `GroupObject.afterCreate` would re-derive them from the children's
        // (now relative) positions, collapsing the group to width=1, height=1.
        const looksV1 = obj.type === "group" && ("objectExtents" in obj || obj.width == null);
        if (looksV1) {
          if ("objectExtents" in obj) {
            delete obj.objectExtents;
          }
          // We can't determine proper values for height and width until the models are instantiated,
          // so we set them to 0. The next step happens in `DrawingContentModel.afterCreate`.
          obj.width = 0;
          obj.height = 0;
        }
      });
      migrated.version = kDrawingStateVersion;
      return migrated;
    }

    console.warn("Drawing Tile could not be loaded", snapshot);
    return {};
  }

});
