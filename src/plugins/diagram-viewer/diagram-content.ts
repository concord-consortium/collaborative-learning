import { getSnapshot, types, Instance, destroy, SnapshotIn,
  isValidReference, addDisposer, getType } from "mobx-state-tree";
import { reaction } from "mobx";
import stringify from "json-stringify-pretty-compact";
import { DQRoot } from "@concord-consortium/diagram-view";
import { ITileExportOptions, IDefaultContentOptions } from "../../models/tiles/tile-content-info";
import { TileContentModel } from "../../models/tiles/tile-content";
import { kDiagramTileType, kDiagramToolStateVersion } from "./diagram-types";
import { SharedVariables, SharedVariablesType } from "../shared-variables/shared-variables";

export const DiagramContentModel = TileContentModel
  .named("DiagramTool")
  .props({
    hideNavigator: types.maybe(types.boolean),
    type: types.optional(types.literal(kDiagramTileType), kDiagramTileType),
    version: types.optional(types.literal(kDiagramToolStateVersion), kDiagramToolStateVersion),
    root: types.optional(DQRoot, getSnapshot(DQRoot.create())),
  })
  .views(self => ({
    exportJson(options?: ITileExportOptions) {
      // ignore options?.forHash option - return the entire snapshot when hashing
      const snapshot = getSnapshot(self);
      return stringify(snapshot, {maxLength: 120});
    }
  }))
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    get sharedModel() {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      // Perhaps we should pass the type to getTileSharedModel, so it can return the right value
      // just like findFirstSharedModelByType does
      //
      // For now we are checking the type ourselves, and we are assuming the shared model we want
      // is the first one.
      const firstSharedModel = sharedModelManager?.getTileSharedModels(self)?.[0];
      if (!firstSharedModel || getType(firstSharedModel) !== SharedVariables) {
        return undefined;
      }
      return firstSharedModel as SharedVariablesType;
    },
    get positionForNewNode() {
      // In the future this can look at all of the existing nodes and find an empty spot.
      // For now just return 100, 100
      // TODO: this should be moved into DQRoot
      return {x: 100, y: 100};
    },
    get variables() {
      return self.root?.variables || [];
    }
  }))
  .actions(self => ({
    afterAttach() {

      // Monitor our parents and update our shared model when we have a document parent
      addDisposer(self, reaction(() => {
        const sharedModelManager = self.tileEnv?.sharedModelManager;

        const containerSharedModel = sharedModelManager?.isReady ?
          sharedModelManager?.findFirstSharedModelByType(SharedVariables) : undefined;

        const tileSharedModels = sharedModelManager?.isReady ?
          sharedModelManager?.getTileSharedModels(self) : undefined;

        const values = {sharedModelManager, containerSharedModel, tileSharedModels};
        return values;
      },
      ({sharedModelManager, containerSharedModel, tileSharedModels}) => {
        if (!sharedModelManager?.isReady) {
          // We aren't added to a document yet so we can't do anything yet
          return;
        }

        if (containerSharedModel && tileSharedModels?.includes(containerSharedModel)) {
          // We already have a shared model so we skip some steps
          // below. If we don't skip these steps we can get in an infinite
          // loop.
        } else {
          if (!containerSharedModel) {
            // The document doesn't have a shared model yet
            containerSharedModel = SharedVariables.create();
          }

          // TODO: This will currently generate multiple history events because it
          // is running outside of a document tree action.
          // Add the shared model to both the document and the tile
          sharedModelManager.addTileSharedModel(self, containerSharedModel);

          // TODO: It would be a better example for future shared model
          // developers if this also stored a reference to the shared model in
          // the tile content, this would demonstrate how tiles can work with
          // multiple shared models at the same time.
          //
          // If we do that then this reference probably should be kept in sync
          // with the tileSharedModels. So if it is removed from there then the
          // reference is cleaned up.
        }

        // We add the shared model as the variables API even if the shared model
        // was already added to this tile. This is necessary when deserializing
        // a document from storage.
        self.root.setVariablesAPI(containerSharedModel);
      },
      {name: "sharedModelSetup", fireImmediately: true}));
    }
  }))
  .actions(self => ({
    updateAfterSharedModelChanges() {
      // First cleanup any invalid references this can happen when an item is deleted
      self.root.nodes.forEach(node => {
        // If the sharedItem is not valid destroy the list item
        if (!isValidReference(() => node.variable)) {
          destroy(node);
        }
      });

      if (!self.sharedModel) {
        // We should never get into this case, but this is here to just in case
        // somehow we do
        console.warn("updateAfterSharedModelChanges was called with no shared model present");
      }
    }
  }))
  .actions(self => ({
    setHideNavigator(val: boolean) {
      self.hideNavigator = val;
    }
  }));

export interface DiagramContentModelType extends Instance<typeof DiagramContentModel> {}

// The migrator sometimes modifies the diagram content model so that its create
// method actually goes through the migrator. When that happens if the snapshot doesn't
// have a version the snapshot will be ignored.
// This weird migrator behavior is demonstrated here: src/models/mst.test.ts
// So because of that this method should be used instead of directly calling create
export function createDiagramContent(snapshot?: SnapshotIn<typeof DiagramContentModel>) {
  return DiagramContentModel.create({
    version: kDiagramToolStateVersion,
    ...snapshot
  });
}

export function defaultDiagramContent(options?: IDefaultContentOptions) {
  return createDiagramContent({ root: getSnapshot(DQRoot.create()) });
}
