import { autorun, IReactionDisposer } from "mobx";
import { getParentOfType, getSnapshot, hasParentOfType, 
  IAnyStateTreeNode, IDisposer, Instance, onSnapshot, tryReference, types } from "mobx-state-tree";
import { DocumentContentModelType } from "../document/document-content";
import { ISharedModelManager, SharedModelType, SharedModelUnion } from "./shared-model";
import { ToolTileModel } from "./tool-tile";
import { ToolContentUnion } from "./tool-types";

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

  const sharedModelMonitorDisposers: Record<string, IDisposer> = {};
  let documentAutoRunDisposer: IReactionDisposer;

  return {
    setDocument(document: DocumentContentModelType) {
      console.log("sharedModelDocumentManager.setDocument", getSnapshot(document));
      self.document = document;

      // If we had a autorun already setup, dispose it
      if (documentAutoRunDisposer) {
        documentAutoRunDisposer();

        // If there were was any sharedModel monitoring going on dispose it too
        for(const [key, disposer]  of Object.entries(sharedModelMonitorDisposers)) {
          if (disposer) {
            disposer();
          }
          delete sharedModelMonitorDisposers[key];
        }
      }

      console.log("setting up autorun");
      documentAutoRunDisposer = autorun(() => {
        // FIXME: this is typing the sharedModel to any I think because it is a
        // union
        for(const sharedModel of document.sharedModelMap.values()) {
          if (sharedModelMonitorDisposers[sharedModel.id]) {
            sharedModelMonitorDisposers[sharedModel.id]();
          }
          sharedModelMonitorDisposers[sharedModel.id] = onSnapshot(sharedModel, () => {
            // search each tile in the document.tileMap to find ones that are
            // referencing this sharedModel
            // run their update function with this shared model
            for(const tile of document.tileMap.values()) {
              for(const tileSharedModel of tile.sharedModels.values()) {
                // FIXME: might want to use tryReference here
                if (tileSharedModel.sharedModel === sharedModel) {
                  tile.content.updateAfterSharedModelChanges(sharedModel);
                }
              }
            }
          });
        }
      });
    },

    findFirstSharedModelByType<IT extends typeof SharedModelUnion>(sharedModelType: IT): IT["Type"] | undefined {
      if (!self.document) {
        console.warn("findFirstSharedModelByType has no document");
      }
      return self.document?.getFirstSharedModelByType(sharedModelType);
    },
    getTileSharedModel(tileContentModel: IAnyStateTreeNode, label: string) {
      const toolTile = getToolTile(tileContentModel);

      // Maybe we should add a more convenient view on toolTile
      return tryReference(() => toolTile?.sharedModels?.get(label)?.sharedModel);
    },
    setTileSharedModel(tileContentModel: Instance<typeof ToolContentUnion>, 
      label: string, sharedModel: SharedModelType): void {
      if (!self.document) {
        console.warn("setTileSharedModel has no document. this will have no effect");
        return;
      }
      const existingSharedModel = self.document.sharedModelMap.get(sharedModel.id);
      if (!existingSharedModel) {
        self.document.sharedModelMap.put(sharedModel);
      }

      const toolTile = getToolTile(tileContentModel);
      toolTile?.setSharedModel(label, sharedModel);

      // The update function in the 'autorun' will probably run above:
      //   self.document.sharedModelMap.put(sharedModel);
      // So then it won't pick up the fact that this shared model has been 
      // added to this toolTile. 
      // So we explicitly run it again here to be safe
      tileContentModel.updateAfterSharedModelChanges(sharedModel);
    }  
  };
});

export function createSharedModelDocumentManager(): ISharedModelDocumentManager {
  return SharedModelDocumentManager.create();
}
