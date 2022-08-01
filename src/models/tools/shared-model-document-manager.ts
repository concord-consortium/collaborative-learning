import { autorun, IReactionDisposer } from "mobx";
import { getParentOfType, hasParentOfType,
  IAnyStateTreeNode, IDisposer, onSnapshot, types } from "mobx-state-tree";
import { DocumentContentModelType } from "../document/document-content";
import { ISharedModelManager, SharedModelType, SharedModelUnion } from "./shared-model";
import { ToolTileModel } from "./tool-tile";

export interface ISharedModelDocumentManager extends ISharedModelManager {
  setDocument(document: DocumentContentModelType): void;
}

export const SharedModelDocumentManager =
types.model("SharedModelDocumentManager")
.volatile(self => ({
  document: undefined as DocumentContentModelType | undefined,
}))
.views(self => ({
  get isReady() {
    return !!self.document;
  },
}))
.actions(self => {
  const getToolTile = (tileContentModel: IAnyStateTreeNode) => {
    if (!hasParentOfType(tileContentModel, ToolTileModel)) {
      // we aren't attached in the right place yet
      return undefined;
    }
    return getParentOfType(tileContentModel, ToolTileModel);
  };

  // Partial is used here, so we are forced to check for undefined when looking
  // up a disposer by a key.
  const sharedModelMonitorDisposers: Partial<Record<string, IDisposer>> = {};
  let documentAutoRunDisposer: IReactionDisposer;

  return {
    setDocument(document: DocumentContentModelType) {
      self.document = document;

      if (documentAutoRunDisposer) {
        // This means setDocument was called before. In this case we assume the
        // document has been changed. So we dispose all of the reactions and
        // then re-create them.
        documentAutoRunDisposer();

        // We need to dispose any shared model `onSnapshot` monitors as well
        for(const [key, disposer] of Object.entries(sharedModelMonitorDisposers)) {
          disposer?.();
          delete sharedModelMonitorDisposers[key];
        }
      }

      documentAutoRunDisposer = autorun(() => {
        for(const sharedModelEntry of document.sharedModelMap.values()) {
          const { sharedModel } = sharedModelEntry;
          if (sharedModelMonitorDisposers[sharedModel.id]) {
            // We already have a snapshot listener for this sharedModel, we don't need to
            // replace it
            continue;
          }
          sharedModelMonitorDisposers[sharedModel.id] = onSnapshot(sharedModel, () => {
            for(const tile of sharedModelEntry.tiles) {
              tile.content.updateAfterSharedModelChanges(sharedModelEntry.sharedModel);
            }
          });
        }
      });
    },

    findFirstSharedModelByType<IT extends typeof SharedModelUnion>(
      sharedModelType: IT, providerId?: string): IT["Type"] | undefined {
      if (!self.document) {
        console.warn("findFirstSharedModelByType has no document");
      }
      return self.document?.getFirstSharedModelByType(sharedModelType, providerId);
    },

    getSharedModelsByType<IT extends typeof SharedModelUnion>(type: string): IT["Type"][] {
      return self.document?.getSharedModelsByType<IT>(type) || [];
    },

    addTileSharedModel(tileContentModel: IAnyStateTreeNode, sharedModel: SharedModelType, isProvider = false): void {
      if (!self.document) {
        console.warn("addTileSharedModel has no document. this will have no effect");
        return;
      }

      // add this toolTile to the sharedModel entry
      const toolTile = getToolTile(tileContentModel);
      if (!toolTile) {
        console.warn("addTileSharedModel can't find the toolTile");
        return;
      }

      // assign an indexOfType if necessary
      if (sharedModel.indexOfType < 0) {
        const usedIndices = new Set<number>();
        const sharedModels = self.document.getSharedModelsByType(sharedModel.type);
        sharedModels.forEach(model => {
          if (model.indexOfType >= 0) {
            usedIndices.add(model.indexOfType);
          }
        });
        for (let i = 1; sharedModel.indexOfType < 0; ++i) {
          if (!usedIndices.has(i)) {
            sharedModel.setIndexOfType(i);
            break;
          }
        }
      }

      // register it with the document if necessary.
      // This won't re-add it if it is already there
      const sharedModelEntry = self.document.addSharedModel(sharedModel);

      // If the sharedModel was added before we don't need to do anything
      if (sharedModelEntry.tiles.includes(toolTile)) {
        return;
      }

      sharedModelEntry.addTile(toolTile, isProvider);

      // The update function in the 'autorun' will run when a new shared model
      // is added to the document, but if the sharedModel already exists on the
      // document, nothing that is being monitored will change So we need to
      // explicity run the update function just to give the tile a chance to
      // update itself.
      tileContentModel.updateAfterSharedModelChanges(sharedModel);
    },

    getTileSharedModels(tileContentModel: IAnyStateTreeNode): SharedModelType[] {
      if (!self.document) {
        console.warn("getTileSharedModels has no document");
        return [];
      }

      // add this toolTile to the sharedModel entry
      const toolTile = getToolTile(tileContentModel);
      if (!toolTile) {
        console.warn("getTileSharedModels can't find the toolTile");
        return [];
      }

      const sharedModels: SharedModelType[] = [];
      for(const sharedModelEntry of self.document.sharedModelMap.values()) {
        if (sharedModelEntry.tiles.includes(toolTile)) {
          sharedModels.push(sharedModelEntry.sharedModel);
        }
      }
      return sharedModels;
    },

    removeTileSharedModel(tileContentModel: IAnyStateTreeNode, sharedModel: SharedModelType): void {
      if (!self.document) {
        console.warn("removeTileSharedModel has no document");
        return;
      }

      const toolTile = getToolTile(tileContentModel);
      if (!toolTile) {
        console.warn("removeTileSharedModel can't find the toolTile");
        return;
      }

      const sharedModelEntry = self.document.sharedModelMap.get(sharedModel.id);
      if (!sharedModelEntry) {
        console.warn(`removeTileSharedModel can't find sharedModelEntry for sharedModel: ${sharedModel.id}`);
        return;
      }

      sharedModelEntry.removeTile(toolTile);
    },
  };
});

export function createSharedModelDocumentManager(): ISharedModelDocumentManager {
  return SharedModelDocumentManager.create();
}
