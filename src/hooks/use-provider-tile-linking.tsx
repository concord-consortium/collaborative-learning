import { useCallback } from "react";
import { ITileModel } from "../models/tiles/tile-model";
import { useLinkProviderTileDialog } from "./use-link-provider-tile-dialog";
import { isGraphModel } from "../plugins/graph/models/graph-model";
import { getSharedModelManager } from "../models/tiles/tile-environment";
import { SharedModelType } from "../models/shared/shared-model";
import { LogEventName } from "../lib/logger-types";
import { logSharedModelDocEvent } from "../models/document/log-shared-model-document-event";
import { getTileContentInfo } from "../models/tiles/tile-content-info";
import { useAppConfig } from "./use-stores";

interface IProps {
  actionHandlers?: any;
  model: ITileModel;
  readOnly?: boolean;
  sharedModelTypes: string[];  // TODO should perhaps be SharedModelType[];
  allowMultipleGraphDatasets?: boolean;
}

/**
 * Sets up a dialog that allows the user to connect shared models to a given tile.
 * Dialog will show a list of tiles that provide shared models.
 * These are divided into ones that are aleady connected to the given tile and can be unlinked,
 * and ones that are not connected and can be linked.
 *
 * @param props - properties object
 * @param props.model - model representing the Tile that we are linking to.
 * @param props.actionHandlers - callback methods to handle linking and unlinking.
 *  Optional; default methods are provided.
 * @param props.readOnly - whether we are in a read-only context (default false)
 * @param props.sharedModelTypes - list of types of shared models to look for (as strings)
 * @param props.allowMultipleGraphDatasets - whether the dialog should allow multiple connections to an XY Plot tile.
 *  (default false)
 *
 * @returns a boolean indicating whether any providers are available, and a function to open the dialog.
 */
export const useProviderTileLinking = ({
  actionHandlers, model, readOnly, sharedModelTypes, allowMultipleGraphDatasets
}: IProps) => {
  const appConfig = useAppConfig();
  const {handleRequestTileLink, handleRequestTileUnlink} = actionHandlers || {};
  const sharedModelManager = getSharedModelManager(model);
  const sharedModels: SharedModelType[] = [];
  if (sharedModelManager?.isReady) {
    for (const type of sharedModelTypes) {
      for (const m of sharedModelManager.getSharedModelsByType(type)) {
        // Ignore any shared model that has no tile attached to it
        // (this is not necessary but keeps us compatible with previous behavior)
        if (sharedModelManager.getSharedModelTiles(m).length > 0) {
          sharedModels.push(m);
        }
      }
    }
  }

  const isLinkEnabled = sharedModels.length > 0;

  const linkTile = useCallback((sharedModel: SharedModelType) => {
    if (!readOnly && sharedModelManager?.isReady) {
      // Depending on the unit configuration, graphs sometimes allow multiple datasets and sometimes not.
      // Other tiles register their ability to consume multiple datasets as part of their content info.
      const allowsMultiple = isGraphModel(model.content)
       ? allowMultipleGraphDatasets
       : getTileContentInfo(model.content.type)?.consumesMultipleDataSets?.(appConfig);

      if (!allowsMultiple) {
        // Remove any existing shared models before adding the new one
        for (const shared of sharedModelManager.getTileSharedModels(model.content)) {
          sharedModelManager.removeTileSharedModel(model.content, shared);
        }
      }
      const sharedTiles = sharedModelManager.getSharedModelProviders(sharedModel);
      sharedModelManager.addTileSharedModel(model.content, sharedModel);
      logSharedModelDocEvent(LogEventName.TILE_LINK, model, sharedTiles, sharedModel);

    }
  }, [appConfig, readOnly, sharedModelManager, model, allowMultipleGraphDatasets]);

  const unlinkTile = useCallback((sharedModel: SharedModelType) => {
    if (!readOnly && sharedModelManager?.isReady) {
      sharedModelManager.removeTileSharedModel(model.content, sharedModel);
      const sharedTiles = sharedModelManager.getSharedModelProviders(sharedModel);
      logSharedModelDocEvent(LogEventName.TILE_UNLINK, model, sharedTiles, sharedModel);
    }
  }, [readOnly, sharedModelManager, model]);

  const onLinkTile = handleRequestTileLink || linkTile;
  const onUnlinkTile = handleRequestTileUnlink || unlinkTile;
  const [showLinkTileDialog] =
          useLinkProviderTileDialog({
            sharedModels, model, onLinkTile, onUnlinkTile
          });

  return { isLinkEnabled, showLinkTileDialog };
};
