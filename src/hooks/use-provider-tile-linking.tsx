import { useCallback } from "react";

import { ITileLinkMetadata } from "../models/tiles/tile-link-types";
import { ITileModel } from "../models/tiles/tile-model";
import { useLinkProviderTileDialog } from "./use-link-provider-tile-dialog";
import { getTileContentById } from "../utilities/mst-utils";
import { SharedDataSet } from "../models/shared/shared-data-set";
import { useLinkableTiles } from "./use-linkable-tiles";
import { isGraphModel } from "../plugins/graph/models/graph-model";
import { SharedVariables } from "../plugins/shared-variables/shared-variables";
import { getSharedModelManager } from "../models/tiles/tile-environment";
import { getTileContentInfo } from "../models/tiles/tile-content-info";

interface IProps {
  actionHandlers?: any;
  model: ITileModel;
  readOnly?: boolean;
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
 * @param props.readOnly - whether we are in a read-only context
 * @param props.allowMultipleGraphDatasets - whether the dialog should allow multiple connections to an XY Plot tile.
 *
 * @returns a boolean indicating whether any providers are available, and a function to open the dialog.
 */
export const useProviderTileLinking = ({
  actionHandlers, model, readOnly, allowMultipleGraphDatasets
}: IProps) => {
  const {handleRequestTileLink, handleRequestTileUnlink} = actionHandlers || {};
  const { providers, variableProviders } = useLinkableTiles({ model });
  const isLinkEnabled = (providers.length > 0 || variableProviders.length > 0);

  const linkTile = useCallback((tileInfo: ITileLinkMetadata) => {
    const providerTile = getTileContentById(model.content, tileInfo.id);
    if (!readOnly && providerTile) {
      const sharedModelManager = getSharedModelManager(providerTile);
      if (sharedModelManager?.isReady) {
        // TODO: this is temporary while we are working on getting Graph to work with multiple datasets
        // Once multiple datasets are fully implemented, we should look at the "consumesMultipleDataSets"
        // setting for the tile type; but for now graph has to allow multiples while not having that be the default.
        if (!allowMultipleGraphDatasets && isGraphModel(model.content)) {
          for (const shared of sharedModelManager.getTileSharedModels(model.content)) {
            console.log('Removing existing shared model before adding a new one: ', shared);
            sharedModelManager.removeTileSharedModel(model.content, shared);
          }
        }
        const contentInfo = getTileContentInfo(providerTile.type);
        const sharedModelType = contentInfo?.isVariableProvider ? SharedVariables : SharedDataSet;
        const sharedModel = sharedModelManager.findFirstSharedModelByType(sharedModelType, tileInfo.id);
        sharedModel && sharedModelManager.addTileSharedModel(model.content, sharedModel);
      }
    }
  }, [readOnly, model, allowMultipleGraphDatasets]);

  const unlinkTile = useCallback((tileInfo: ITileLinkMetadata) => {
    const linkedTile = getTileContentById(model.content, tileInfo.id);
    if (!readOnly && linkedTile) {
      const sharedModelManager = getSharedModelManager(linkedTile);
      if (sharedModelManager?.isReady) {
        const contentInfo = getTileContentInfo(linkedTile.type);
        const sharedModelType = contentInfo?.isVariableProvider ? SharedVariables : SharedDataSet;
        const sharedModel = sharedModelManager.findFirstSharedModelByType(sharedModelType, tileInfo.id);
        if (sharedModel) {
          sharedModelManager.removeTileSharedModel(model.content, sharedModel);
        }
      }
    }
  }, [readOnly, model]);

  const onLinkTile = handleRequestTileLink || linkTile;
  const onUnlinkTile = handleRequestTileUnlink || unlinkTile;

  const linkableTiles = providers.concat(variableProviders);

  const [showLinkTileDialog] =
          useLinkProviderTileDialog({
            linkableTiles, model, onLinkTile, onUnlinkTile
          });

  return { isLinkEnabled, showLinkTileDialog };
};
