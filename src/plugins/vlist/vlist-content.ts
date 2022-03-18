import { has } from "lodash";
import { autorun, reaction } from "mobx";
import { types, Instance, getParentOfType, isModelType, getType, getSnapshot, getPath, hasParentOfType, addDisposer, isValidReference, detach, tryReference } from "mobx-state-tree";
import { DocumentContentModel } from "../../models/document/document-content";
import { SharedModelType } from "../../models/tools/shared-model";
import { ToolTileModel } from "../../models/tools/tool-tile";
import { ToolContentModel } from "../../models/tools/tool-types";
import { uniqueId } from "../../utilities/js-utils";
import { SharedVariables, SharedVariablesType, Variable } from "../shared-variables/shared-variables";
import { kVListToolID } from "./vlist-types";

export function defaultVListContent(): VListContentModelType {
  return VListContentModel.create();
}

const VListItem = types.model("VListItem")
.props({
  // if not provided, will be generated
  id: types.optional(types.identifier, () => uniqueId()),
  variable: types.reference(Variable)
})
.views(self => ({
  get name() {
    const variable = tryReference(() => self.variable);
    return variable?.name || `invalid variable ref: ${getSnapshot(self).variable}`;
  }
}));
export interface VListItemType extends Instance<typeof VListItem> {}

export const VListContentModel = ToolContentModel
.named("VListTool")
.props({
  type: types.optional(types.literal(kVListToolID), kVListToolID),
  items: types.array(VListItem)
})
.views(self => ({
  get toolTile() {
    if (!hasParentOfType(self, ToolTileModel)) {
      // we aren't attached in the right place yet
      return undefined;
    }
    return getParentOfType(self, ToolTileModel);
  } 
}))
.views(self => ({
  get isUserResizable() {
    return true;
  },
  get sharedModel() {
    const sharedModel = self.toolTile?.sharedModels.find(model => getType(model) === SharedVariables);
    return sharedModel as SharedVariablesType | undefined;
  },
  get toolTile() {
    if (!hasParentOfType(self, ToolTileModel)) {
      // we aren't attached in the right place yet
      return undefined;
    }
    return getParentOfType(self, ToolTileModel);
  }
}))
.views(self => ({
  get variables() {
    if (!self.sharedModel) {
      return [];
    }
    return self.sharedModel.variables.map(variable => variable.name);
  } 
}))
.actions(self => ({
  addVariable(text: string) {
    const sharedModel = self.sharedModel;
    if (!sharedModel) {
      return;
    }
    sharedModel.addVariable(text);
  },

  moveUp(item: VListItemType) {
    const index = self.items.findIndex(_item => _item === item);
    if (index <=0 ) {
      // do nothing
      return;
    }
    // const itemSnapshot = getSnapshot(item);
    console.log("items before move", getSnapshot(self));
    detach(item);
    // self.items.remove(item);
    console.log("items after detach", getSnapshot(self));
    self.items.splice(index-1, 0, item);
    console.log("items after insert", getSnapshot(self));
  },

  remove(item: VListItemType) {
    // remove shared item, and we should be able to let the sync'ing take care
    // of removing the actual VListItem
    self.sharedModel?.removeVariable(item.variable);
  }
}))
.actions(self => ({
  updateAfterSharedModelChanges(sharedModel?: SharedModelType) {
    // First cleanup any invalid references this can happen when a item is deleted
    self.items.forEach(item => {
      // If the sharedItem is not valid destroy the list item
      // CHECKME: This approach might be too aggressive. If this autorun gets applied while an applySnapshot
      // is in the process of running, then the reference might be invalid briefly while the rest of 
      // the items are loading.
      if (!isValidReference(() => item.variable)) {
          self.items.remove(item);
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
      const matchingItem = self.items.find(item => item.variable.id === sharedItemId);
      if (!matchingItem) {
        const newItem = VListItem.create({ variable: sharedItemId });
        self.items.push(newItem);
      }
    });
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

      // FIXME: this should probably be taken care of automatically 
      self.updateAfterSharedModelChanges();
    }, 
    {fireImmediately: true}));
  }
}));

export interface VListContentModelType extends Instance<typeof VListContentModel> {}

// Need to figure out how to hack in a shared model
// Perhaps we can add a MST lifecycle action so after the content model is added
// then we add the shared model to the document and add it to this tile's parent