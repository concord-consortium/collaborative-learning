import { useCallback } from "react";
import {ITileLinkMetadata } from "../models/tiles/tile-link-types";
import { ITileModel } from "../models/tiles/tile-model";
import { useMergeTileDialog } from "./use-merge-data-dialog";
import { mergeTwoDataSets } from "../models/data/data-set-utils";
import { safeJsonParse } from "../utilities/js-utils";

interface IProps {
  documentId?: string;
  model: ITileModel;
}

export const useTileDataMerging = ({documentId, model}: IProps) => {
  const localSharedModels = model.content.tileEnv?.sharedModelManager?.getSharedModelsByType("SharedDataSet") || [];
  const mergableTiles = localSharedModels.filter((m) => (m as any).providerId !== model.id);

  const mergeTileFunc = useCallback((selectedTile: ITileLinkMetadata) => {
    const sourceDataSnapshot = safeJsonParse(JSON.stringify((selectedTile))).dataSet;
    const localSharedModel = model.content.tileEnv?.sharedModelManager?.getTileSharedModels(model.content)[0] as any;
    const targetDataSet = localSharedModel?.dataSet;

    if (sourceDataSnapshot && targetDataSet) {
      mergeTwoDataSets(sourceDataSnapshot, targetDataSet);
    }
    //console.log("| localSharedModel |", localSharedModel.dataSet);
    //targetDataSet && mergeTwoDataSets(mergableData, targetDataSet);
  }, [model]);

  const [showMergeTileDialog] = useMergeTileDialog({
    mergableTiles, model, onMergeTile: mergeTileFunc
  });

  return { showMergeTileDialog };
};
