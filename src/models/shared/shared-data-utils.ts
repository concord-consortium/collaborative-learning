import { IAnyStateTreeNode } from "@concord-consortium/mobx-state-tree";
import { IDataSet } from "../data/data-set";
import {
  ISharedCaseMetadata, isSharedCaseMetadata, kSharedCaseMetadataType, SharedCaseMetadata
} from "./shared-case-metadata";
import {
  isSharedDataSet, kSharedDataSetType, SharedDataSet, SharedDataSetType
} from "./shared-data-set";
import { ILinkOptions } from "./shared-types";
import { ITileContentModel } from "../tiles/tile-content";
import { getSharedModelManager } from "../tiles/tile-environment";
import { ITileModel } from "../tiles/tile-model";
import { SharedModelType } from "./shared-model";

export function getSharedDataSets(node: IAnyStateTreeNode): SharedDataSetType[] {
  const sharedModelManager = getSharedModelManager(node);
  return sharedModelManager?.getSharedModelsByType<typeof SharedDataSet>(kSharedDataSetType) ?? [];
}

export function getDataSetFromId(node: IAnyStateTreeNode, id: string): IDataSet | undefined {
  const sharedDataSets = getSharedDataSets(node);
  const sharedDataSet = sharedDataSets.find(model => model.dataSet.id === id);
  return sharedDataSet?.dataSet;
}

export function getTileSharedModels(tile: ITileContentModel) {
  const sharedModelManager = getSharedModelManager(tile);
  return sharedModelManager?.getTileSharedModels(tile) ?? [];
}

export function getTileDataSet(tile: ITileContentModel): IDataSet | undefined {
  const sharedDataSet = getTileSharedModels(tile).find(m => isSharedDataSet(m));
  return isSharedDataSet(sharedDataSet) ? sharedDataSet.dataSet : undefined;
}

export function getTileCaseMetadata(tile: ITileContentModel) {
  const sharedCaseMetadata = getTileSharedModels(tile).find(m => isSharedCaseMetadata(m));
  return isSharedCaseMetadata(sharedCaseMetadata) ? sharedCaseMetadata : undefined;
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

export function isTileLinkedToDataSet(tile: ITileContentModel, dataSet: IDataSet) {
  const sharedModels = getTileSharedModels(tile);
  return !!sharedModels.find(sharedModel => isSharedDataSet(sharedModel) && sharedModel.dataSet.id === dataSet.id);
}

export function isTileLinkedToOtherDataSet(tile: ITileContentModel, dataSet: IDataSet) {
  const sharedModels = getTileSharedModels(tile);
  return !!sharedModels.find(sharedModel => isSharedDataSet(sharedModel) && sharedModel.dataSet.id !== dataSet.id);
}

export function unlinkTileFromDataSet(tile: ITileContentModel, sharedModel: SharedModelType) {
  const sharedModelManager = getSharedModelManager(tile);
  sharedModelManager?.removeTileSharedModel(tile, sharedModel);
  const sharedCaseMetadata = getTileCaseMetadata(tile);
  const sharedDataSet = isSharedDataSet(sharedModel) ? sharedModel.dataSet : undefined;
  if (sharedCaseMetadata?.data?.id === sharedDataSet?.id) {
    sharedCaseMetadata && sharedModelManager?.removeTileSharedModel(tile, sharedCaseMetadata);
  }
}

export function unlinkTileFromAllDataSets(tile: ITileContentModel) {
  const sharedModelManager = getSharedModelManager(tile);
  const sharedModels = sharedModelManager?.getTileSharedModels(tile);
  sharedModels?.forEach(sharedModel => {
    if (["SharedDataSet", "SharedCaseMetadata"].includes(sharedModel.type)) {
      unlinkTileFromDataSet(tile, sharedModel);
    }
  });
}

export function linkTileToDataSet(tile: ITileContentModel, dataSet: IDataSet, options?: ILinkOptions) {
  const { consumesMultipleDataSets = false, requiresCaseMetadata = false } = options || {};
  if (isTileLinkedToOtherDataSet(tile, dataSet) && !consumesMultipleDataSets) {
    unlinkTileFromAllDataSets(tile);
  }

  const sharedModelManager = getSharedModelManager(tile);
  const sharedDataSets = sharedModelManager?.getSharedModelsByType<typeof SharedDataSet>(kSharedDataSetType);
  const sharedDataSet = sharedDataSets?.find(model => model.dataSet.id === dataSet.id) as SharedDataSetType | undefined;
  if (sharedModelManager && sharedDataSet) {
    sharedModelManager.addTileSharedModel(tile, sharedDataSet);

    const sharedMetadata = sharedModelManager.getSharedModelsByType<typeof SharedCaseMetadata>(kSharedCaseMetadataType);
    let sharedCaseMetadata: ISharedCaseMetadata | undefined =
            sharedMetadata.find(model => model.data?.id === dataSet.id);
    if (!sharedCaseMetadata && requiresCaseMetadata) {
      sharedCaseMetadata = SharedCaseMetadata.create();
      sharedCaseMetadata.setData(dataSet);
    }
    sharedCaseMetadata && sharedModelManager.addTileSharedModel(tile, sharedCaseMetadata);
  }
}
