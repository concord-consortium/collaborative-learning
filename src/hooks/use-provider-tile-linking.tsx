import { useCallback } from "react";
import { ITileModel } from "../models/tiles/tile-model";
import { useLinkProviderTileDialog } from "./use-link-provider-tile-dialog";
import { isGraphModel } from "../plugins/graph/models/graph-model";
import { getSharedModelManager } from "../models/tiles/tile-environment";
import { SharedModelType } from "../models/shared/shared-model";

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
      // TODO: this is temporary while we are working on getting Graph to work with multiple datasets
      // Once multiple datasets are fully implemented, we should look at the "consumesMultipleDataSets"
      // setting for the tile type; but for now graph has to allow multiples while not having that be the default.
      if (!allowMultipleGraphDatasets && isGraphModel(model.content)) {
        for (const shared of sharedModelManager.getTileSharedModels(model.content)) {
          console.log('Removing existing shared model before adding a new one: ', shared);
          sharedModelManager.removeTileSharedModel(model.content, shared);
        }
      }
      sharedModelManager.addTileSharedModel(model.content, sharedModel);
    }
  }, [readOnly, sharedModelManager, model.content, allowMultipleGraphDatasets]);

  const unlinkTile = useCallback((sharedModel: SharedModelType) => {
    if (!readOnly && sharedModelManager?.isReady) {
      sharedModelManager.removeTileSharedModel(model.content, sharedModel);
    }
  }, [readOnly, sharedModelManager, model.content]);

  const onLinkTile = handleRequestTileLink || linkTile;
  const onUnlinkTile = handleRequestTileUnlink || unlinkTile;

  const [showLinkTileDialog] =
          useLinkProviderTileDialog({
            sharedModels, model, onLinkTile, onUnlinkTile
          });

  return { isLinkEnabled, showLinkTileDialog };
};
