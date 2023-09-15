import { useCallback } from "react";
import {ITileLinkMetadata } from "../models/tiles/tile-link-types";
import { ITileModel } from "../models/tiles/tile-model";
import { useMergeTileDialog } from "./use-merge-data-dialog";


interface IProps {
  documentId?: string;
  model: ITileModel;
  onMergeTile?: (tileInfo: ITileLinkMetadata) => void;
}
export const useTileDataMerging = ({documentId, model, onMergeTile}: IProps) => {
  const mergableTiles = model.content.tileEnv?.sharedModelManager?.getSharedModelsByType("SharedDataSet") || [];

  const mergeTile = useCallback((tileInfo: ITileLinkMetadata) => {
    console.log("| 2 mergeTile!", tileInfo);
  }, []);

  const [showMergeTileDialog] = useMergeTileDialog({
    mergableTiles, model, onMergeTile: mergeTile
  });

  return { showMergeTileDialog };
};
