import { useCallback, useEffect } from "react";
import { ITileModel } from "../models/tiles/tile-model";
import { getTileContentById } from "../utilities/mst-utils";
import { SharedDataSet } from "../models/shared/shared-data-set";
import { getTileContentInfo } from "../models/tiles/tile-content-info";
import { ITileLinkMetadata } from "../models/tiles/tile-link-types";
import { useMergeDataDialog } from "./use-merge-data-dialog";

interface IProps {
  documentId?: string;
  model: ITileModel;
  onMergeTile?: (tileInfo: ITileLinkMetadata) => void;
}
export const useTileDataMerging = ({ documentId, model, onMergeTile }: IProps) => {
  const modelId = model.id;
  const mergableTiles =  model.content.tileEnv?.sharedModelManager?.getSharedModelsByType("SharedDataSet");
  const mergeTile = () => console.log("mergeTiles!");
  const onMergeTileHandler = onMergeTile || mergeTile;

  const [showMergeDataDialog] = useMergeDataDialog({
    mergableTiles,
    model,
    onMergeTile: onMergeTileHandler
  });

  return { showMergeDataDialog };
};

