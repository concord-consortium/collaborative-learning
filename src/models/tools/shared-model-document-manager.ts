import { getParentOfType, getSnapshot, hasParentOfType, 
  IAnyStateTreeNode, tryReference, types } from "mobx-state-tree";
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
      console.log("sharedModelDocumentManager.setDocument", getSnapshot(document));
      self.document = document;
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
    setTileSharedModel(tileContentModel: IAnyStateTreeNode, label: string, sharedModel: SharedModelType): void {
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
    }  
  };
});

export function createSharedModelDocumentManager(): ISharedModelDocumentManager {
  return SharedModelDocumentManager.create();
}
