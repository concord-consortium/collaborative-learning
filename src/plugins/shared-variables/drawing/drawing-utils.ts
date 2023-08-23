import { VariableType } from "@concord-consortium/diagram-view";
import { getType } from "mobx-state-tree";
import { VariableChipObjectSnapshotForAdd } from "./variable-object";
import { DrawingContentModelType } from "../../drawing/model/drawing-content";
import { SharedVariables, SharedVariablesType } from "../shared-variables";
import { Point } from "src/plugins/drawing/model/drawing-basic-types";

function getSharedVariablesModel(drawingContent: DrawingContentModelType) {
  const sharedModelManager = drawingContent.tileEnv?.sharedModelManager;
  // Perhaps we should pass the type to getTileSharedModel, so it can return the right value
  // just like findFirstSharedModelByType does
  //
  // For now we are checking the type ourselves, and we are assuming the shared model we want
  // is the first one.
  const firstSharedModel = sharedModelManager?.getTileSharedModels(drawingContent)?.[0];
  if (!firstSharedModel || getType(firstSharedModel) !== SharedVariables) {
    return undefined;
  }
  return firstSharedModel as SharedVariablesType;
}

export function getVariables(drawingContent: DrawingContentModelType): VariableType[] {
  const sharedModel = getOrFindSharedModel(drawingContent);
  return sharedModel ? sharedModel.variables : [];
}

export function getOrFindSharedModel(drawingContent: DrawingContentModelType) {
  let sharedModel = getSharedVariablesModel(drawingContent);

  if (!sharedModel) {
    // The document doesn't have a shared model yet, or the manager might
    // not be ready yet
    const sharedModelManager = drawingContent.tileEnv?.sharedModelManager;
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

    sharedModelManager.addTileSharedModel(drawingContent, containerSharedModel);
    sharedModel = containerSharedModel;
  }

  return sharedModel;
}

export function findVariable(drawingContent: DrawingContentModelType, variableId: string) {
  const variables = getVariables(drawingContent);
  const variable = variables.find(v => v.id === variableId);
  return variable;
}

// Constants determining where we create objects that are inserted in default locations
// rather than being placed by the user. The locations are staggered so that objects
// don't get created right on top of each other.
const INITIAL_INSERT_POSITION = { x: 10, y: 10 };
const INSERT_POSITION_DELTA = { x: 25, y: 25 };
const INSERT_POSITION_BACKUP_DELTA = { x: 100, y: 0 };
const INSERT_POSITION_MARGIN = 25;

// Return a valid location to create a new object that is not right on top of an existing object.
export function getValidInsertPosition(drawingContent: DrawingContentModelType, 
    getVisibleCanvasSize: () => Point | undefined) {
  const base_pos = {...INITIAL_INSERT_POSITION};
  let pos = {...base_pos};
  // Start at the initial position and try locations on a diagonal path.
  while (drawingContent.objectAtLocation(pos)) {
    pos.x += INSERT_POSITION_DELTA.x;
    pos.y += INSERT_POSITION_DELTA.y;
    const size = getVisibleCanvasSize();
    if (size) {
      if (pos.x + INSERT_POSITION_MARGIN > size.x) {
        // we've traversed the whole visible canvas and not found any available spot.  Give up.
        return INITIAL_INSERT_POSITION;
      }
      if (pos.y + INSERT_POSITION_MARGIN > size.y) {
        // Try a new diagonal starting from a new base position a little to the right.
        base_pos.x += INSERT_POSITION_BACKUP_DELTA.x;
        base_pos.y += INSERT_POSITION_BACKUP_DELTA.y;
        pos = {...base_pos};  
      }
    }
  }
  return pos;
  }

  export function addChipToContent(drawingContent: DrawingContentModelType, variableId: string, position: Point) {
  const variableChipSnapshot: VariableChipObjectSnapshotForAdd = {
    type: "variable",
    x: position.x,
    y: position.y,
    variableId
  };
  drawingContent.addObject(variableChipSnapshot);
}
