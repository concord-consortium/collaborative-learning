import { VariableType } from "@concord-consortium/diagram-view";
import { BaseElement, ReactEditor, Transforms } from "@concord-consortium/slate-editor";
import { getType } from "mobx-state-tree";
import { SharedModelType } from "../../../models/shared/shared-model";
import { TextContentModelType } from "../../../models/tiles/text/text-content";
import { SharedVariables, SharedVariablesType } from "../shared-variables";
import { isVariableElement, VariableElement } from "./variables-plugin";

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

export function updateAfterSharedModelChanges(
    textContent: TextContentModelType, sharedModel?: SharedModelType) {
  const {editor} = textContent;

  // Look for chips in the document (editor.value)
  // If any of these chips reference variables that no long exist, delete
  // them from the document.
  if (!editor) {
    return;
  }
  const variables = getVariables(textContent);

  const document = editor.value.document;
  const variableNodes = document.filterDescendants((node: BaseElement) => {
    return isVariableElement(node);
  });
  variableNodes.forEach((node: VariableElement) => {
    if (!node) {
      // For some reason Immutable iterable.forEach can return undefined values
      return;
    }
    const inlineNode = node as VariableElement;

    // Does this variable exist in our list?
    const {reference} = inlineNode;
    if (!variables.find(v => v.id === reference)) {
      const nodePath = node && ReactEditor.findPath(editor, node);
      Transforms.removeNodes(editor, { at: nodePath });
    }
  });
}
