import { IDataSet } from "../models/data/data-set";
import { isSharedDataSet, SharedDataSet } from "../models/shared/shared-data-set";
import { getSharedModelManager } from "../models/tiles/tile-environment";
import { ITileModel } from "../models/tiles/tile-model";

export function getTileSharedModels(tile: ITileModel) {
  const sharedModelManager = getSharedModelManager(tile);
  return sharedModelManager?.getTileSharedModels(tile) ?? [];
}

export const isLinkedToTile = (model: ITileModel, tileId: string) => {
  const sharedModelManager = getSharedModelManager(model);
  if (sharedModelManager?.isReady) {
    // Determine if the tile initiating the link has a shared data set that the 
    // target tile is already linked to.
    const modelDataSet = sharedModelManager?.findFirstSharedModelByType(SharedDataSet, model.id);
    const modelDataSetTileIds = sharedModelManager?.getSharedModelTileIds(modelDataSet);
    if (modelDataSetTileIds?.includes(tileId)) {
      return true;
    }
    // Determine if the target tile has a shared data set that the initiating tile is 
    // already linked to.
    const tileDataSet = sharedModelManager?.findFirstSharedModelByType(SharedDataSet, tileId);
    const tileDataSetTileIds = sharedModelManager?.getSharedModelTileIds(tileDataSet);
    if (tileDataSetTileIds?.includes(model.id)) {
      return true;
    }
  }
  return false;
};

export function isTileLinkedToOtherDataSet(tile: ITileModel, dataSet: IDataSet) {
  const sharedModels = getTileSharedModels(tile);
  return !!sharedModels.find(sharedModel => isSharedDataSet(sharedModel) && sharedModel.dataSet.id !== dataSet.id);
}

export function unlinkTileFromDataSets(tile: ITileModel) {
  const sharedModelManager = getSharedModelManager(tile);
  const sharedModels = sharedModelManager?.getTileSharedModels(tile);
  sharedModels?.forEach(sharedModel => {
    if (sharedModel.type === "SharedDataSet") {
      sharedModelManager?.removeTileSharedModel(tile, sharedModel);
    }
  });
}
