import { useCallback } from "react";
import {ITileLinkMetadata } from "../models/tiles/tile-link-types";
import { ITileModel } from "../models/tiles/tile-model";
import { useMergeTileDialog } from "./use-merge-data-dialog";
import { mergeTwoDataSets } from "../models/data/data-set-utils";
import { safeJsonParse } from "../utilities/js-utils";
import { IDataSet, IDataSetSnapshot } from "../models/data/data-set";
import { getSharedDataSets } from "../models/shared/shared-data-utils";
import { SharedDataSetType } from "../models/shared/shared-data-set";

interface IProps {
  model: ITileModel;
}

function getMergables(model: ITileModel) {
  const docDataSets = getSharedDataSets(model.content);
  return docDataSets.filter((m) => (m as SharedDataSetType).providerId !== model.id);
}

function getSourceSnap(selectedTile: ITileLinkMetadata) {
  const sourceDataSnapshot = safeJsonParse(JSON.stringify((selectedTile))).dataSet as IDataSetSnapshot;
  return sourceDataSnapshot;
}

function getTargetDataSet(model: ITileModel) {
  const manager = model.content.tileEnv?.sharedModelManager;
  const targetModel = manager?.getTileSharedModels(model.content)[0] as SharedDataSetType;
  return targetModel?.dataSet as IDataSet;
}

export const useTileDataMerging = ({model}: IProps) => {
  const mergableTiles = getMergables(model);

  const mergeTileFunc = useCallback((selectedTile: ITileLinkMetadata) => {
    const sourceSnap = getSourceSnap(selectedTile);
    const targetDataSet = getTargetDataSet(model);
    if (sourceSnap && targetDataSet) {
      mergeTwoDataSets(sourceSnap, targetDataSet);
    }
  }, [model]);

  const [showMergeTileDialog] = useMergeTileDialog({
    mergableTiles, model, onMergeTile: mergeTileFunc
  });

  return { showMergeTileDialog };
};
