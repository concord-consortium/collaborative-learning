import { action, computed, makeObservable, observable } from "mobx";
import { getParentOfType, getSnapshot, getType, hasParentOfType, IAnyStateTreeNode } from "mobx-state-tree";
import { DocumentContentModelType } from "./document-content";
import { SharedModelType } from "../shared/shared-model";
import { IDragSharedModelItem, ISharedModelManager, SharedModelUnion } from "../shared/shared-model-manager";
import { ITileModel, TileModel } from "../tiles/tile-model";

function getTileModel(tileContentModel: IAnyStateTreeNode) {
  if (!hasParentOfType(tileContentModel, TileModel)) {
    // we aren't attached in the right place yet
    return undefined;
  }
  return getParentOfType(tileContentModel, TileModel);
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
      assignIndexOfType: action,
      addTileSharedModel: action,
      removeTileSharedModel: action
    });
  }

  get isReady() {
    return !!this.document;
  }

  setDocument(document: DocumentContentModelType) {
    this.document = document;

    // assign shared model indices by type when document is specified
    for(const sharedModelEntry of this.document.sharedModelMap.values()) {
      this.assignIndexOfType(sharedModelEntry.sharedModel);
    }
  }

  // NOTE: MobX doesn't allow views that take properties, but it will watch all of the stuff
  // read in a plain function like this so if this.document changes any observer calling
  // this will be recomputed.
  // Also this cannot be marked as an `action`. Doing that will cause it to not watch the
  // stuff it reads.
  findFirstSharedModelByType<IT extends typeof SharedModelUnion>(
    sharedModelType: IT, tileId?: string): IT["Type"] | undefined {
    if (!this.document) {
      console.warn("findFirstSharedModelByType has no document");
    }
    return this.document?.getFirstSharedModelByType(sharedModelType, tileId);
  }

  getSharedModelsByType<IT extends typeof SharedModelUnion>(type: string): IT["Type"][] {
    return this.document?.getSharedModelsByType<IT>(type) || [];
  }

  addSharedModel(sharedModel: SharedModelType) {
    if (!this.document) {
      console.warn("addSharedModel has no document. this will have no effect");
      return;
    }

    // assign an indexOfType if necessary
    if (sharedModel.indexOfType < 0) {
      const usedIndices = new Set<number>();
      const sharedModels = this.document.getSharedModelsByType(sharedModel.type);
      sharedModels.forEach((model: SharedModelType) => {
        if (model.indexOfType >= 0) {
          usedIndices.add(model.indexOfType);
        }
      });
      for (let i = 1; sharedModel.indexOfType < 0; ++i) {
        if (!usedIndices.has(i)) {
          sharedModel.setIndexOfType(i);
          break;
        }
      }
    }

    // register it with the document if necessary.
    // This won't re-add it if it is already there
    return this.document.addSharedModel(sharedModel);
  }

  assignIndexOfType(sharedModel: SharedModelType) {
    if (sharedModel.indexOfType < 0) {
      const usedIndices = new Set<number>();
      const sharedModels = this.document?.getSharedModelsByType(sharedModel.type);
      sharedModels?.forEach(model => {
        if (model.indexOfType >= 0) {
          usedIndices.add(model.indexOfType);
        }
      });
      for (let i = 0; sharedModel.indexOfType < 0; ++i) {
        if (!usedIndices.has(i)) {
          sharedModel.setIndexOfType(i);
          break;
        }
      }
    }
  }

  addTileSharedModel(tileContentModel: IAnyStateTreeNode, sharedModel: SharedModelType, isProvider = false): void {
    if (!this.document) {
      console.warn("addTileSharedModel has no document. this will have no effect");
      return;
    }

    // add this tile to the sharedModel entry
    const tile = getTileModel(tileContentModel);
    if (!tile) {
      console.warn("addTileSharedModel can't find the tile");
      return;
    }

    // assign an indexOfType if necessary
    this.assignIndexOfType(sharedModel);

    // register it with the document if necessary.
    // This won't re-add it if it is already there
    const sharedModelEntry = this.document.addSharedModel(sharedModel);

    // If the sharedModel was added before we don't need to do anything
    if (sharedModelEntry.tiles.includes(tile)) {
      return;
    }

    sharedModelEntry.addTile(tile, isProvider);

    // When a shared model entry changes updateAfterSharedModelChanges is called on
    // the tile content model automatically by the tree monitor. This will also
    // pick up this case of adding a tile.
  }

  // This is not an action because it is deriving state.
  getTileSharedModels(tileContentModel: IAnyStateTreeNode): SharedModelType[] {
    if (!this.document) {
      console.warn("getTileSharedModels has no document");
      return [];
    }

    // add this tile to the sharedModel entry
    const tile = getTileModel(tileContentModel);
    if (!tile) {
      console.warn("getTileSharedModels can't find the tile");
      return [];
    }

    const sharedModels: SharedModelType[] = [];
    for(const sharedModelEntry of this.document.sharedModelMap.values()) {
      if (sharedModelEntry.tiles.includes(tile)) {
        sharedModels.push(sharedModelEntry.sharedModel);
      }
    }
    return sharedModels;
  }

  getTileSharedModelsByType(
    tileContentModel: IAnyStateTreeNode, modelType: typeof SharedModelUnion
  ): SharedModelType[] {
    const tileSharedModels = this.getTileSharedModels(tileContentModel);
    return tileSharedModels.filter(sharedModel => getType(sharedModel) === modelType);
  }

  getSharedModelDragDataForTiles(requestedTileIds: string[]): IDragSharedModelItem[] {
    const models: IDragSharedModelItem[] = [];

    this.document?.sharedModelMap.forEach(({ sharedModel, provider, tiles }) => {
      // intersect the tiles associated with this shared model with the tiles being requested
      const tileIds = tiles.map(tile => tile.id).filter(tileId => requestedTileIds.includes(tileId));
      if (tileIds.length) {
        models.push({
          modelId: sharedModel.id,
          providerId: provider?.id,
          tileIds,
          content: JSON.stringify(getSnapshot(sharedModel))
        });
      }
    });
    return models;
  }

  getSharedModelTiles(sharedModel?: SharedModelType): ITileModel[] {
    const entry = sharedModel?.id && this.document?.sharedModelMap.get(sharedModel.id);
    return entry ? Array.from(entry.tiles) : [];
  }

  getSharedModelTileIds(sharedModel?: SharedModelType): string[] {
    const tiles = this.getSharedModelTiles(sharedModel);
    return tiles.map(tile => tile.id);
  }

  removeTileSharedModel(tileContentModel: IAnyStateTreeNode, sharedModel: SharedModelType): void {
    if (!this.document) {
      console.warn("removeTileSharedModel has no document");
      return;
    }

    const tile = getTileModel(tileContentModel);
    if (!tile) {
      console.warn("removeTileSharedModel can't find the tile");
      return;
    }

    const sharedModelEntry = this.document.sharedModelMap.get(sharedModel.id);
    if (!sharedModelEntry) {
      console.warn(`removeTileSharedModel can't find sharedModelEntry for sharedModel: ${sharedModel.id}`);
      return;
    }

    // When a tile is removed from the shared model entry this is picked
    // up by the tree-monitor middleware and updateAfterSharedModelChanges will
    // be called on all of the tiles that were or are referring to the sharedModel.
    sharedModelEntry.removeTile(tile);
  }
}
