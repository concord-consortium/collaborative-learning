import { useCallback, memo } from "react";
import { ITileLinkMetadata } from "../models/tiles/tile-link-types";
import { ITileModel } from "../models/tiles/tile-model";
import { useMergeTileDialog } from "./use-merge-data-dialog";
import { mergeTwoDataSets } from "../models/data/data-set-utils";
import { IDataSet } from "../models/data/data-set";
import { getMergableDataSets, getTileDataSet } from "../models/shared/shared-data-utils";
import { getSnapshot } from "@concord-consortium/mobx-state-tree";

interface IProps {
  model: ITileModel;
}

export const useTileDataMerging = ({model}: IProps) => {
  const mergableTiles = getMergableDataSets(model);

  const mergeTileFunc = useCallback((selectedTile: ITileLinkMetadata) => {
    const sourceSnap = getSnapshot(selectedTile.dataSet as IDataSet);
    const targetDataSet = getTileDataSet(model.content);
    if (sourceSnap && targetDataSet) {
      mergeTwoDataSets(sourceSnap, targetDataSet);
    }
  }, [model]);

  const [showMergeTileDialog] = useMergeTileDialog({
    mergableTiles, model, onMergeTile: mergeTileFunc
  });
  const isMergeEnabled = mergableTiles.length > 0;

  return { isMergeEnabled, showMergeTileDialog };
};
