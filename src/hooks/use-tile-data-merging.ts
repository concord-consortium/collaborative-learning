import { useCallback } from "react";
import {ITileLinkMetadata } from "../models/tiles/tile-link-types";
import { ITileModel } from "../models/tiles/tile-model";
import { useMergeTileDialog } from "./use-merge-data-dialog";
import { mergeTwoDataSets } from "../models/data/data-set-utils";
import { safeJsonParse } from "../utilities/js-utils";
import { getSnapshot } from "@concord-consortium/mobx-state-tree";
import { IDataSet, IDataSetSnapshot } from "../models/data/data-set";

interface IProps {
  documentId?: string;
  model: ITileModel;
}

export const useTileDataMerging = ({documentId, model}: IProps) => {
   // TODO - typing, stringifying, find the right pattern to follow
  const localDataSets = model.content.tileEnv?.sharedModelManager?.getSharedModelsByType("SharedDataSet") || [];
  const mergableTiles = localDataSets.filter((m) => (m as any).providerId !== model.id);

  const mergeTileFunc = useCallback((selectedTile: ITileLinkMetadata) => {
    const sourceDataSnapshot = safeJsonParse(JSON.stringify((selectedTile))).dataSet as IDataSetSnapshot;
    const localSharedModel = model.content.tileEnv?.sharedModelManager?.getTileSharedModels(model.content)[0] as any;
    const targetDataSet = localSharedModel?.dataSet as IDataSet;
    if (sourceDataSnapshot && targetDataSet) {
      mergeTwoDataSets(sourceDataSnapshot, targetDataSet);
    }
  }, [model]);

  const [showMergeTileDialog] = useMergeTileDialog({
    mergableTiles, model, onMergeTile: mergeTileFunc
  });

  return { showMergeTileDialog };
};
