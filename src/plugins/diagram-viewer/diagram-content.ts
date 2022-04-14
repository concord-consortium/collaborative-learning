import { getSnapshot, types, Instance, destroy, SnapshotIn,
  isValidReference, addDisposer, getPath, getEnv } from "mobx-state-tree";
import { reaction } from "mobx";
import { DQRoot, DQNode } from "@concord-consortium/diagram-view";
import { ITileExportOptions, IDefaultContentOptions } from "../../models/tools/tool-content-info";
import { ToolContentModel } from "../../models/tools/tool-types";
import { kDiagramToolID, kDiagramToolStateVersion } from "./diagram-types";
import { SharedVariables, SharedVariablesType } from "../shared-variables/shared-variables";
import { ISharedModelManager } from "../../models/tools/shared-model";

export const DiagramContentModel = ToolContentModel
  .named("DiagramTool")
  .props({
    type: types.optional(types.literal(kDiagramToolID), kDiagramToolID),
    version: types.optional(types.literal(kDiagramToolStateVersion), kDiagramToolStateVersion),
    root: types.optional(DQRoot, getSnapshot(DQRoot.create())),
  })
  .views(self => ({
    exportJson(options?: ITileExportOptions) {
      // crude, but enough to get us started
      return JSON.stringify(getSnapshot(self.root));
    }
  }))
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    get sharedModel() {
      const sharedModelManager = getEnv(self)?.sharedModelManager as ISharedModelManager | undefined;
      // Perhaps we should pass the type to getTileSharedModel, so it can return the right value
      // just like findFirstSharedModelByType does
      return sharedModelManager?.getTileSharedModel(self, "variables") as SharedVariablesType | undefined;
    },
  }))
  .actions(self => ({
    afterAttach() {
      console.log("afterAttach", getPath(self));

      // Monitor our parents and update our shared model when we have a document parent
      addDisposer(self, reaction(() => {
        console.log("running diagram-content reaction", getPath(self));
        const sharedModelManager = getEnv(self)?.sharedModelManager as ISharedModelManager | undefined;

        const tileSharedModel = sharedModelManager?.isReady ? 
          sharedModelManager?.getTileSharedModel(self, "variables") : undefined;
        const containerSharedModel = sharedModelManager?.isReady ?
          sharedModelManager?.findFirstSharedModelByType(SharedVariables) : undefined;

        const values = {sharedModelManager, tileSharedModel, containerSharedModel};
        console.log("1st part of reaction returns", values);
        return values;
      },
      ({sharedModelManager, tileSharedModel, containerSharedModel}) => {
        console.log("running diagram-content effect", getPath(self));
        if (!sharedModelManager?.isReady) {
          // We aren't added to a document yet so we can't do anything yet
          return;
        }

        if (tileSharedModel && tileSharedModel === containerSharedModel) {
          // We already have a saved model so we skip some steps
          // below. If we don't skip these steps we can get in an infinite 
          // loop.
        } else {
          if (!containerSharedModel) {
            // The document doesn't have a shared model yet
            containerSharedModel = SharedVariables.create();
            console.log("newly created shared model", getSnapshot(containerSharedModel));
          } 
  
          // CHECKME: this might trigger an pre-mature update because the document's
          // shared models will be updated first before the tiles. And the update to the
          // document's shared models will trigger the document level autorun.
          sharedModelManager.setTileSharedModel(self, "variables", containerSharedModel);  

        }
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
        return;
      }
  
      Array.from(self.sharedModel.variables.values()).forEach(variable => {
        // sync up shared data model items with the tile data of items
        // look for this item in the itemList, if it is not there add it
        const sharedItemId = variable.id;
        
        // the dereferencing of sharedItem should be safe here because we first cleaned up any
        // items that referenced invalid shared items.
        const nodes = Array.from(self.root.nodes.values());
        const matchingItem = nodes.find(node => node.variable.id === sharedItemId);
        if (!matchingItem) {
          const newItem = DQNode.create({ variable: sharedItemId, x: 100, y: 100 });
          self.root.addNode(newItem);
        }
      });
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


