import { FlowTransform } from "react-flow-renderer";
import { getSnapshot, types, Instance, getPath, addDisposer, 
  hasParentOfType, getParentOfType, getType, destroy, 
  isValidReference } from "mobx-state-tree";
import { ITileExportOptions, IDefaultContentOptions } from "../../models/tools/tool-content-info";
import { ToolContentModel } from "../../models/tools/tool-types";
import { ToolTileModel } from "../../models/tools/tool-tile";
import { DocumentContentModel } from "../../models/document/document-content";
import { kDiagramToolID } from "./diagram-types";
import { DQRoot, DQNode } from "@concord-consortium/diagram-view";
import { reaction } from "mobx";
import { SharedVariables, SharedVariablesType } from "../shared-variables/shared-variables";
import { SharedModelType } from "../../models/tools/shared-model";

// This is only used directly by tests
export function defaultDiagramContent(options?: IDefaultContentOptions) {
  return DiagramContentModel.create({ root: getSnapshot(DQRoot.create()) });
}

export const DiagramContentModel = ToolContentModel
  .named("DiagramTool")
  .props({
    type: types.optional(types.literal(kDiagramToolID), kDiagramToolID),
    root: types.optional(DQRoot, getSnapshot(DQRoot.create())),
    transform: types.maybe(types.frozen<FlowTransform>())
  })
  .views(self => ({
    exportJson(options?: ITileExportOptions) {
      // crude, but enough to get us started
      return JSON.stringify(getSnapshot(self.root));
    }
  }))
  .views(self => ({
    get toolTile() {
      if (!hasParentOfType(self, ToolTileModel)) {
        // we aren't attached in the right place yet
        return undefined;
      }
      return getParentOfType(self, ToolTileModel);
    },
  }))
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    get sharedModel() {
      const sharedModel = self.toolTile?.sharedModels.find(model => getType(model) === SharedVariables);
      return sharedModel as SharedVariablesType | undefined;
    },   
  }))
  .actions(self => ({
    setTransform(transform: FlowTransform) {
      self.transform = transform;
    }
  }))
  .actions(self => ({
    afterAttach() {
      console.log("afterAttach", getPath(self));
  
      // Monitor our parents and update our shared model when we have a document parent
      addDisposer(self, reaction(() => {
        console.log("running vlist-content reaction", getPath(self));
        const sharedModel = self.sharedModel; 
        
        if (!hasParentOfType(self, DocumentContentModel)) {
          // we aren't attached in the right place yet
          return {sharedModel, document: undefined};
        }
    
        // see if there is already a sharedModel in the document
        // FIXME: to support tiles in iframes, we won't have direct access to the
        // document like this, so some kind of API will need to be used instead.
        const document = getParentOfType(self, DocumentContentModel);
  
        return {sharedModel, document};
      },
      ({sharedModel, document}) => {
        console.log("running vlist-content effect", getPath(self));
        if (sharedModel) {
          // we already have a sharedModel
          // FIXME: for now we are going to ignore this because we have some issue
          // with an existing sharedModel
  
          // TODO: we might want to still continue to see if our document has
          // changed so then we could reset our shared model. However I suspect
          // that if the document changes the reference to the sharedModel will
          // break so we'll be able to deal with it at that point.
          // return;
        }
  
        if (!document) {
          // We don't have a document yet
          return;
        }
  
        sharedModel = document.getFirstSharedModelByType(SharedVariables);
  
        if (!sharedModel) {
          // The document doesn't have a shared model yet
          sharedModel = SharedVariables.create();
          console.log(getSnapshot(sharedModel));
          document.addSharedModel(sharedModel);
        } 
    
        const toolTile = getParentOfType(self, ToolTileModel);    
        toolTile.setSharedModel(sharedModel);
  
        self.root.setVariablesAPI(sharedModel);

        // FIXME: this should probably be taken care of automatically 
        self.updateAfterSharedModelChanges();
      }, 
      {fireImmediately: true}));
    }
  }))
  .actions(self => ({
    updateAfterSharedModelChanges(sharedModel?: SharedModelType) {
      // First cleanup any invalid references this can happen when a item is deleted
      self.root.nodes.forEach(node => {
        // If the sharedItem is not valid destroy the list item
        if (!isValidReference(() => node.variable)) {
          destroy(node);
        }
      });        
    
      if (!self.sharedModel) {
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
