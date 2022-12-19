import { VariableType } from "@concord-consortium/diagram-view";
import { BaseElement, Node, Editor, CustomElement, EditorValue, ReactEditor, Transforms } from "@concord-consortium/slate-editor";
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

export const getTileTextVariables = (textContent: TextContentModelType) => {
  const variableIds: string[] = [];
  if (textContent.editor) {
    for (const [node, path] of Editor.nodes(textContent.editor, {at: [], mode: 'all'})) {
      if (Editor.isInline(textContent.editor, node) && isVariableElement(node)) {
        variableIds.push(node.reference);
      }
    }
  }   
  const variables = variableIds.map(id => findVariable(textContent, id));
  const filteredVariables = variables.filter(variable => variable !== undefined);
  return filteredVariables as VariableType[];
};

export function findVariable(textContent: TextContentModelType, variableId: string) {
  const variables = getVariables(textContent);
  const variable = variables.find(v => v.id === variableId);
  return variable;
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
  //const {editor} = textContent;
  // FIXME: DO WE STILL NEED THIS??? Returning early so this doesn't run because
  // when a variable is deleted from the diagram or drawing tile, 
  // we don't seem to be deleting it.
  // If we do still want, this, I believe the code would look something like this:
  // if (textContent.editor) {
  //   const variables = getVariables(textContent);
  //   for (const [node, path] of Editor.nodes(textContent.editor, {at: [], mode: 'all'})) {
  //     if (Editor.isInline(textContent.editor, node) && isVariableElement(node)) {
  //       if (!variables.find(v => v.id === node.reference)) {
  //         Transforms.removeNodes(editor, { at: path });
  //       }
  //     }
  //   }
  // }   
}
