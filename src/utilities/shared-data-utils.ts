import { SharedDataSet } from "../models/shared/shared-data-set";
import { getSharedModelManager } from "../models/tiles/tile-environment";
import { ITileModel } from "../models/tiles/tile-model";

export const isLinkedToTile = (model: ITileModel, tileId: string) => {
  const sharedModelManager = getSharedModelManager(model);
  if (sharedModelManager?.isReady) {
    const modelDataSet = sharedModelManager?.findFirstSharedModelByType(SharedDataSet, model.id);
    const sourceTileDataSet = sharedModelManager?.findFirstSharedModelByType(SharedDataSet, tileId);
    if (sourceTileDataSet?.id === modelDataSet?.id) {
      return true;
    }
  }
  return false;
};
