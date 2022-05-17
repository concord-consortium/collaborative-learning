import { VariableType } from "@concord-consortium/diagram-view";
import { getType } from "mobx-state-tree";
import { DrawingContentModelType } from "../../../models/tools/drawing/drawing-content";
import { SharedVariables, SharedVariablesType } from "../shared-variables";

function getSharedVariablesModel(textContent: DrawingContentModelType) {
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

export function getVariables(textContent: DrawingContentModelType): VariableType[] {
  const sharedModel = getOrFindSharedModel(textContent);
  return sharedModel ? sharedModel.variables : [];
}

export function getOrFindSharedModel(textContent: DrawingContentModelType) {
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
      // If we need to create a new shared variables model when there is just a
      // text tile in the container, this code needs to be changed.
      //
      // With the current code, if we created the shared variables model here,
      // it can cause an infinite loop. This getOrFindSharedModel is called from
      // the updateAfterSharedModelChanges so it would get called immediately
      // after this new shared model is added to the container. And if we aren't
      // careful we'd then try to add the shared variables model again, and
      // again...
      //
      // Rather than creating the shared variables model here, it would be
      // better to do it like the diagram-content.ts does.  It basically waits
      // for the sharedModelManager to be ready in a MobX reaction and then adds
      // the shared variables model when it is ready. 
      //
      // With that approach getVariables could just be a view that doesn't
      // modify any state.
      return;
    }

    sharedModelManager.addTileSharedModel(textContent, containerSharedModel);
    sharedModel = containerSharedModel;
  }

  return sharedModel;
}
