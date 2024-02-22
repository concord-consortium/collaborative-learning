import { useCallback, useContext } from "react";
import { ITileLinkMetadata} from "../models/tiles/tile-link-types";
import { ITileModel, getTileModel } from "../models/tiles/tile-model";
import { useLinkConsumerTileDialog } from "./use-link-consumer-tile-dialog";
import { getTileContentById } from "../utilities/mst-utils";
import { isSharedDataSet, SharedDataSet } from "../models/shared/shared-data-set";
import { getTileContentInfo } from "../models/tiles/tile-content-info";
import { useLinkableTiles } from "./use-linkable-tiles";
import { AddTilesContext } from "../components/tiles/tile-api";
import { getSharedModelManager } from "../models/tiles/tile-environment";
import { SharedModelUnion } from "../models/shared/shared-model-manager";
import { SharedModelType } from "../models/shared/shared-model";
import { logSharedModelDocEvent } from "../models/document/log-shared-model-document-event";
import { LogEventName } from "../lib/logger-types";

interface IProps {
  // TODO: This should be replaced with a generic disabled
  // property. If it is disabled that would override the linkableTiles.length check
  // Or we could just remove it and let the caller do this overriding itself
  // In that case it should return hasLinkableTiles instead of isLinkEnabled
  hasLinkableRows: boolean;
  model: ITileModel;
  shareType: typeof SharedModelUnion;
  tileType?: string;
  readOnly?: boolean;

  // These callbacks are used by components to override the default link
  // and unlink behavior. If they are set, the caller
  // is responsible for actually linking the tile.
  onLinkTile?: (tileInfo: ITileLinkMetadata) => void;
  onUnlinkTile?: (tileInfo: ITileLinkMetadata) => void;
  onCreateTile?: () => void;
}

/**
 * Sets up a dialog that lists potential tiles that can "consume" a given tile's data.
 * Dialog will show tiles that can accept a shared dataset (or shared variables if that is
 * what the given tile provides).
 * Tiles that are already linked with the given shared model are listed in an "Unlink" list
 * and can be removed.
 * A specific tile type can be specified, in which case only tiles of that type are shown,
 * and in addition a button is shown to create a new tile of that type to receive the data.
 *
 * @param props - properties object
 * @param props.model - model representing the tile that has data to share.
 * @param props.shareType - the type of SharedModel that this tile is offering.
 * @param props.hasLinkableRows - whether the tile currently has sufficient data to allow sharing.
 * @param props.readOnly - whether we are in a read-only context (default false)
 * @param props.tileType - only show this tile type in the menu.
 * @param props.onLinkTile - callback, overrides default connection method
 * @param props.onUnlinkTile - callback, overrides default disconnection method
 * @param props.onCreateTile - callback, overrides default tile-create-and-link method
 *
 * @returns a boolean indicating whether any receivers are available, and a function to open the dialog.
 */
export const useConsumerTileLinking = ({
  model, shareType, hasLinkableRows, readOnly, tileType, onLinkTile, onUnlinkTile, onCreateTile
}: IProps) => {
  // In the future we might need to limit this search to only tiles that are consumers for 'shareType'.
  // At the moment we have no cases where it matters.
  const { consumers: linkableTilesAllTypes } = useLinkableTiles({ model });
  let linkableTiles = tileType ? linkableTilesAllTypes.filter(t=>t.type===tileType) : linkableTilesAllTypes;
  const sharedModelManager = getSharedModelManager(model);
  const modelToShare = sharedModelManager?.isReady ?
                       sharedModelManager.findFirstSharedModelByType(shareType, model.id) : undefined;

  // Can't link to self
  linkableTiles = linkableTiles.filter(t => t.id!==model.id);
  // Button should be enabled if we have sufficient data to provide, and
  // either there are existing tiles to link it to, or we are able to create a tile for it.
  const isLinkEnabled = hasLinkableRows && (tileType || linkableTiles.length > 0);

  // sort linkableTiles so all Graph tiles are first, then all Geometry tiles
  linkableTiles.sort((a, b) => {
    if (a.type === b.type) return 0;
    if (a.type === "Graph") return -1;
    if (b.type === "Graph") return 1;
    if (a.type === "Geometry") return -1;
    if (b.type === "Geometry") return 1;
    return 0;
  });

  const linkTile = useCallback((tileInfo: ITileLinkMetadata) => {
    const consumerTile = getTileContentById(model.content, tileInfo.id);
    if (!readOnly && consumerTile) {
      if (sharedModelManager?.isReady) {
        // If the consumer tile does not support multiple shared data sets, we will remove it from
        // any existing shared data sets later.
        // Don't remove old links before adding the new one, since some models (eg, table) take action
        // if they see they have no linked data.
        let dataSetsToRemove = [] as SharedModelType[];
        if (shareType === SharedDataSet && !getTileContentInfo(consumerTile.type)?.consumesMultipleDataSets) {
          dataSetsToRemove = sharedModelManager.getTileSharedModelsByType(consumerTile, SharedDataSet);
        }
        modelToShare && sharedModelManager.addTileSharedModel(consumerTile, modelToShare);

        const sharedTiles = modelToShare && sharedModelManager.getSharedModelProviders(modelToShare);
        if (sharedTiles){
          const consumerModel = consumerTile && getTileModel(consumerTile);
          if(consumerModel){
            logSharedModelDocEvent(LogEventName.TILE_LINK, consumerModel, sharedTiles, modelToShare);
          }
        }
        dataSetsToRemove.forEach(sharedDataSet => {
          sharedModelManager.removeTileSharedModel(consumerTile, sharedDataSet);
        });
      }
    }
  }, [model.content, modelToShare, readOnly, shareType, sharedModelManager]);

  const unlinkTile = useCallback((tileInfo: ITileLinkMetadata) => {
    const linkedTile = getTileContentById(model.content, tileInfo.id);
    if (!readOnly && linkedTile) {
      if (sharedModelManager?.isReady) {
        // Normally we unlink the other tile to break the connection.
        // However, if the other tile matches the shared model's providerId, then it is the owner;
        // we leave it attached and unlink ourselves.
        if (modelToShare && isSharedDataSet(modelToShare) && modelToShare.providerId === tileInfo.id) {
          sharedModelManager.removeTileSharedModel(model.content, modelToShare);  // unlink us
        } else if (modelToShare) {
          sharedModelManager.removeTileSharedModel(linkedTile, modelToShare); // unlink them
          const sharedTiles = modelToShare && sharedModelManager.getSharedModelProviders(modelToShare);
          logSharedModelDocEvent(LogEventName.TILE_UNLINK, model, sharedTiles, modelToShare);
        }
      }
    }
  }, [model, modelToShare, readOnly, sharedModelManager]);

  const addTilesContext = useContext(AddTilesContext);

  const createTile = useCallback(() => {
    if (tileType && !readOnly) {
      if (modelToShare) {
        addTilesContext?.addTileAfter(tileType, model, [modelToShare], {title: model.title});
      }
    }
  }, [tileType, readOnly, modelToShare, addTilesContext, model]);

  const onLinkTileHandler = onLinkTile || linkTile;
  const onUnlinkTileHandler = onUnlinkTile || unlinkTile;
  const onCreateTileHandler = onCreateTile || createTile;

  const [showLinkTileDialog] = useLinkConsumerTileDialog({
    linkableTiles,
    model,
    tileType,
    modelToShare,
    onLinkTile: onLinkTileHandler,
    onUnlinkTile: onUnlinkTileHandler,
    onCreateTile: onCreateTileHandler
  });

  return { isLinkEnabled, showLinkTileDialog };
};


