import { VariableType } from "@concord-consortium/diagram-view";
import { getType } from "mobx-state-tree";
import { Inline } from "slate";
import { SharedModelType } from "../../../models/tools/shared-model";
import { TextContentModelType } from "../../../models/tools/text/text-content";
import { SharedVariables, SharedVariablesType } from "../shared-variables";

export const kVariableSlateType = "m2s-variable";

function getSharedVariablesModel(textContent: TextContentModelType) {
  const sharedModelManager = textContent.tileEnv?.sharedModelManager;
  // Perhaps we should pass the type to getTileSharedModel, so it can return the right value
  // just like findFirstSharedModelByType does
  //
  // For now we are checking the type ourselves, and we are assuming the shared model we want
  // is the first one.
  const firstSharedModel = sharedModelManager?.getTileSharedModels(textContent)?.[0];
  if (!firstSharedModel || getType(firstSharedModel) !== SharedVariables) {
    return undefined;
  }
  return firstSharedModel as SharedVariablesType;
}

export function getVariables(textContent: TextContentModelType): VariableType[] {
  const sharedModel = getOrFindSharedModel(textContent);
  return sharedModel ? sharedModel.variables : [];
}

export function getOrFindSharedModel(textContent: TextContentModelType) {
  let sharedModel = getSharedVariablesModel(textContent);

  if (!sharedModel) {
    // The document doesn't have a shared model yet, or the manager might
    // not be ready yet
    const sharedModelManager = textContent.tileEnv?.sharedModelManager;
    if (!sharedModelManager || !sharedModelManager.isReady) {
      // In this case we can't do anything. 
      // Print a warning because it should be unusual
      console.warn("shared model manager isn't available");
      return;
    }

    const containerSharedModel = sharedModelManager.findFirstSharedModelByType(SharedVariables);
    if (!containerSharedModel) {
      console.warn("no shared variables model in the document");
      // In the future we might want to create a new shared variables shared
      // model in this case.  If we do that, we have to be careful that we don't
      // cause an infinite loop. This getOrFindSharedModel is called from the 
      // updateAfterSharedModelChanges so it might be called immediately after 
      // this new shared model is added to the document.
      //
      // FIXME: It would be best if the searching for the shared variables model was 
      // separated from this getOrFindSharedModel. That way getVariables could
      // just be a view that doesn't modify any state. That could be handled by
      // a reaction or autorun like with diagram-content.ts does. However it
      // seems better try to fix that when move all of this code out of text-content
      // and into the shared-variables text plugin.
      return;
    }

    sharedModelManager.addTileSharedModel(textContent, containerSharedModel);
    sharedModel = containerSharedModel;
  }

  return sharedModel;
}

export function updateAfterSharedModelChanges(
    textContent: TextContentModelType, sharedModel?: SharedModelType) {
  
  // Need to look for any references to items in shared models in the text
  // content, if they don't exist in the shared model any more then clean
  // them up in some way. 
  // 
  // Perhaps for just delete them. 
  //
  // Because it is up to the plugins to manage this, we'll have to find a
  // way to channel this action through all of the plugins.
  //
  // After cleaning up an invalid references, then it should decide if it
  // wants to change the text content if there is a new shared model item
  // that didn't exist before.
  if (!textContent.editor) {
    return;
  }

  const variables = getVariables(textContent);

  // FIXME: we shouldn't be aware of nodes managed by slate plugins. So when
  // the plugin is registered with the text tile, it should include a method
  // that can be called here to do this
  const document = textContent.editor.value.document;
  const variableNodes = document.filterDescendants((_node: Node) => {
    return Inline.isInline(_node) && _node.type === kVariableSlateType;
  });
  variableNodes.forEach((element: Inline) => {
    // Does this variable exist in our list?
    if(!variables.find(v => v.id === element.data.get("reference"))){
      textContent.editor.removeNodeByKey(element.key);
    }
  });
}
