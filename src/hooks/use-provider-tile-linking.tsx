import { useCallback } from "react";

import { ITileLinkMetadata } from "../models/tiles/tile-link-types";
import { ITileModel } from "../models/tiles/tile-model";
import { useLinkProviderTileDialog } from "./use-link-provider-tile-dialog";
import { getTileContentById } from "../utilities/mst-utils";
import { SharedDataSet } from "../models/shared/shared-data-set";
import { useLinkableTiles } from "./use-linkable-tiles";
import { isGraphModel } from "../plugins/graph/models/graph-model";

interface IProps {
  actionHandlers?: any;
  model: ITileModel;
  readOnly?: boolean;
  allowMultipleGraphDatasets?: boolean;
}
export const useProviderTileLinking = ({
  actionHandlers, model, readOnly, allowMultipleGraphDatasets
}: IProps) => {
  const {handleRequestTileLink, handleRequestTileUnlink} = actionHandlers || {};
  const { providers: linkableTiles } = useLinkableTiles({ model });
  const isLinkEnabled = (linkableTiles.length > 0);

  const linkTile = useCallback((tileInfo: ITileLinkMetadata) => {
    const providerTile = getTileContentById(model.content, tileInfo.id);
    if (!readOnly && providerTile) {
      const sharedModelManager = providerTile.tileEnv?.sharedModelManager;
      if (sharedModelManager?.isReady) {
        // TODO: this is temporary while we are working on getting Graph to work with multiple datasets
        if (!allowMultipleGraphDatasets && isGraphModel(model.content)) {
          for (const shared of sharedModelManager.getTileSharedModels(model.content)) {
            console.log('Removing existing shared model before adding a new one: ', shared);
            sharedModelManager.removeTileSharedModel(model.content, shared);
          }
        }

        const sharedDataSet = sharedModelManager?.findFirstSharedModelByType(SharedDataSet, tileInfo.id);
        console.log('adding shared model: ', sharedDataSet?.dataSet.name, ' to ', model);
        sharedDataSet && sharedModelManager?.addTileSharedModel(model.content, sharedDataSet);
        // TODO determine if receiving tile can only handle one dataset...
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
