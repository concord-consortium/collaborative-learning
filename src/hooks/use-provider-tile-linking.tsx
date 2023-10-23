import { useCallback } from "react";

import { ITileLinkMetadata } from "../models/tiles/tile-link-types";
import { ITileModel } from "../models/tiles/tile-model";
import { useLinkProviderTileDialog } from "./use-link-provider-tile-dialog";
import { getTileContentById } from "../utilities/mst-utils";
import { SharedDataSet } from "../models/shared/shared-data-set";
import { useLinkableTiles } from "./use-linkable-tiles";

interface IProps {
  actionHandlers?: any;
  model: ITileModel;
  readOnly?: boolean;
}
export const useProviderTileLinking = ({
  actionHandlers, model, readOnly
}: IProps) => {
  const {handleRequestTileLink, handleRequestTileUnlink} = actionHandlers || {};
  const { providers: linkableTiles } = useLinkableTiles({ model });
  const isLinkEnabled = (linkableTiles.length > 0);

  const linkTile = useCallback((tileInfo: ITileLinkMetadata) => {
    const providerTile = getTileContentById(model.content, tileInfo.id);
    if (!readOnly && providerTile) {
      const sharedModelManager = providerTile.tileEnv?.sharedModelManager;
      if (sharedModelManager?.isReady) {
        const sharedDataSet = sharedModelManager?.findFirstSharedModelByType(SharedDataSet, tileInfo.id);
        console.log('adding shared model: ', sharedDataSet?.dataSet.name);
        sharedDataSet && sharedModelManager?.addTileSharedModel(model.content, sharedDataSet);
      }
    }
  }, [readOnly, model]);

  const unlinkTile = useCallback((tileInfo: ITileLinkMetadata) => {
    const linkedTile = getTileContentById(model.content, tileInfo.id);
    if (!readOnly && linkedTile) {
      const sharedModelManager = linkedTile.tileEnv?.sharedModelManager;
      if (sharedModelManager?.isReady) {
        const sharedDataSet = sharedModelManager?.findFirstSharedModelByType(SharedDataSet, tileInfo.id);
        if (sharedDataSet) {
          sharedModelManager?.removeTileSharedModel(model.content, sharedDataSet);
        }
      }
    }
  }, [readOnly, model]);

  const onLinkTile = handleRequestTileLink || linkTile;
  const onUnlinkTile = handleRequestTileUnlink || unlinkTile;

  const [showLinkTileDialog] =
          useLinkProviderTileDialog({
            linkableTiles, model, onLinkTile, onUnlinkTile
          });

  return { isLinkEnabled, showLinkTileDialog };
};
