import { action, computed, makeObservable, observable } from "mobx";
import { getParentOfType, hasParentOfType, IAnyStateTreeNode } from "mobx-state-tree";
import { DocumentContentModelType } from "../document/document-content";
import { ISharedModelManager, SharedModelType, SharedModelUnion } from "./shared-model";
import { ToolTileModel } from "./tool-tile";


function getToolTile(tileContentModel: IAnyStateTreeNode){
  if (!hasParentOfType(tileContentModel, ToolTileModel)) {
    // we aren't attached in the right place yet
    return undefined;
  }
  return getParentOfType(tileContentModel, ToolTileModel);
}

export interface ISharedModelDocumentManager extends ISharedModelManager {
  setDocument(document: DocumentContentModelType): void;
}

export class SharedModelDocumentManager implements ISharedModelDocumentManager {
  document: DocumentContentModelType | undefined = undefined;

  constructor() {
    makeObservable(this, {
      document: observable,
      isReady: computed,
      setDocument: action,
      findFirstSharedModelByType: action,
      addTileSharedModel: action,
      getTileSharedModels: action,
      removeTileSharedModel: action
    });
  }

  get isReady() {
    return !!this.document;
  }

  setDocument(document: DocumentContentModelType) {
    this.document = document;
  }

  findFirstSharedModelByType<IT extends typeof SharedModelUnion>(sharedModelType: IT): IT["Type"] | undefined {
    if (!this.document) {
      console.warn("findFirstSharedModelByType has no document");
    }
    return this.document?.getFirstSharedModelByType(sharedModelType);
  }

  addTileSharedModel(tileContentModel: IAnyStateTreeNode, sharedModel: SharedModelType): void {
    if (!this.document) {
      console.warn("addTileSharedModel has no document. this will have no effect");
      return;
    }

    // add this toolTile to the sharedModel entry
    const toolTile = getToolTile(tileContentModel);
    if (!toolTile) {
      console.warn("addTileSharedModel can't find the toolTile");
      return;
    }

    // register it with the document if necessary.
    // This won't re-add it if it is already there
    const sharedModelEntry = this.document.addSharedModel(sharedModel);

    // If the sharedModel was added before we don't need to do anything
    if (sharedModelEntry.tiles.includes(toolTile)) {
      return;
    }

    sharedModelEntry.addTile(toolTile);

    // When a shared model changes updateAfterSharedModelChanges is called on
    // the tile content model automatically by the tree monitor. However when
    // the list of shared models is changed like here addTileSharedModel, the
    // tree monitor doesn't pick that up, so we must call it directly.
    tileContentModel.updateAfterSharedModelChanges(sharedModel);
  }

  getTileSharedModels(tileContentModel: IAnyStateTreeNode): SharedModelType[] {
    if (!this.document) {
      console.warn("getTileSharedModels has no document");
      return [];
    }

    // add this toolTile to the sharedModel entry
    const toolTile = getToolTile(tileContentModel);
    if (!toolTile) {
      console.warn("getTileSharedModels can't find the toolTile");
      return [];
    }

    const sharedModels: SharedModelType[] = [];
    for(const sharedModelEntry of this.document.sharedModelMap.values()) {
      if (sharedModelEntry.tiles.includes(toolTile)) {
        sharedModels.push(sharedModelEntry.sharedModel);
      }
    }
    return sharedModels;
  }

  removeTileSharedModel(tileContentModel: IAnyStateTreeNode, sharedModel: SharedModelType): void {
    if (!this.document) {
      console.warn("removeTileSharedModel has no document");
      return;
    }

    const toolTile = getToolTile(tileContentModel);
    if (!toolTile) {
      console.warn("removeTileSharedModel can't find the toolTile");
      return;
    }

    const sharedModelEntry = this.document.sharedModelMap.get(sharedModel.id);
    if (!sharedModelEntry) {
      console.warn(`removeTileSharedModel can't find sharedModelEntry for sharedModel: ${sharedModel.id}`);
      return;
    }

    sharedModelEntry.removeTile(toolTile);
  }
}
