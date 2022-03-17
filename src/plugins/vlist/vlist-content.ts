import { has } from "lodash";
import { autorun, reaction } from "mobx";
import { types, Instance, getParentOfType, isModelType, getType, getSnapshot, getPath, hasParentOfType, addDisposer } from "mobx-state-tree";
import { DocumentContentModel } from "../../models/document/document-content";
import { ToolTileModel } from "../../models/tools/tool-tile";
import { ToolContentModel } from "../../models/tools/tool-types";
import { SharedVariables, SharedVariablesType } from "../shared-variables/shared-variables";
import { kVListToolID } from "./vlist-types";

export function defaultVListContent(): VListContentModelType {
  return VListContentModel.create();
}

export const VListContentModel = ToolContentModel
.named("VListTool")
.props({
  type: types.optional(types.literal(kVListToolID), kVListToolID)
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
    }, 
    {fireImmediately: true}));
  }
}));

export interface VListContentModelType extends Instance<typeof VListContentModel> {}

// Need to figure out how to hack in a shared model
// Perhaps we can add a MST lifecycle action so after the content model is added
// then we add the shared model to the document and add it to this tile's parent