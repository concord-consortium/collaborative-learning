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

  return {
    setDocument(document: DocumentContentModelType) {
      self.document = document;
    },

    findFirstSharedModelByType<IT extends typeof SharedModelUnion>(sharedModelType: IT): IT["Type"] | undefined {
      if (!self.document) {
        console.warn("findFirstSharedModelByType has no document");
      }
      return self.document?.getFirstSharedModelByType(sharedModelType);
    },
    addTileSharedModel(tileContentModel: IAnyStateTreeNode, sharedModel: SharedModelType): void {
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

      // register it with the document if necessary.
      // This won't re-add it if it is already there
      const sharedModelEntry = self.document.addSharedModel(sharedModel);

      // If the sharedModel was added before we don't need to do anything
      if (sharedModelEntry.tiles.includes(toolTile)) {
        return;
      }

      sharedModelEntry.addTile(toolTile);

      // The update function in the 'autorun' will run when a new shared model
      // is added to the document, but if the sharedModel already exists on the
      // document, nothing that is being monitored will change So we need to
      // explicity run the update function just to give the tile a chance to
      // update itself.
      // FIXME: check if this is necessary when we are using the tree monitor
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
