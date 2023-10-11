import { useCallback, useContext } from "react";

import { ITileLinkMetadata} from "../models/tiles/tile-link-types";
import { ITileModel } from "../models/tiles/tile-model";
import { useLinkConsumerTileDialog } from "./use-link-consumer-tile-dialog";
import { getTileContentById } from "../utilities/mst-utils";
import { SharedDataSet } from "../models/shared/shared-data-set";
import { getTileContentInfo } from "../models/tiles/tile-content-info";
import { useLinkableTiles } from "./use-linkable-tiles";
import { AddTilesContext } from "../components/tiles/tile-api";
import { getTileSharedModels } from "../models/shared/shared-data-utils";

interface IProps {
  // TODO: This should be replaced with a generic disabled
  // property. If it is disabled that would override the linkableTiles.length check
  // Or we could just remove it and let the caller do this overriding itself
  // In that case it should return hasLinkableTiles instead of isLinkEnabled
  hasLinkableRows: boolean;
  model: ITileModel;
  onlyType?: string;
  readOnly?: boolean;

  // These callbacks are used by components to override the default link
  // and unlink behavior. If they are set, the caller
  // is responsible for actually linking the tile.
  onLinkTile?: (tileInfo: ITileLinkMetadata) => void;
  onUnlinkTile?: (tileInfo: ITileLinkMetadata) => void;
  onCreateTile?: () => void;
}
export const useConsumerTileLinking = ({
  model, hasLinkableRows, readOnly, onlyType, onLinkTile, onUnlinkTile, onCreateTile
}: IProps) => {
  const { consumers: linkableTilesAllTypes } = useLinkableTiles({ model });
  const linkableTiles = onlyType ? linkableTilesAllTypes.filter(t=>t.type===onlyType) : linkableTilesAllTypes;
  // Button should be enabled if we have sufficient data to provide, and
  // either there are existing tiles to link it to, or we are able to create a tile for it.
  const isLinkEnabled = hasLinkableRows && (onlyType || linkableTiles.length > 0);

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
      const sharedModelManager = consumerTile.tileEnv?.sharedModelManager;
      if (sharedModelManager?.isReady) {
        // If the consumer tile does not support multiple shared data sets, remove it from
        // any existing shared data sets before linking.
        if (!getTileContentInfo(consumerTile.type)?.consumesMultipleDataSets) {
          const allSharedDataSets = sharedModelManager?.getSharedModelsByType("SharedDataSet");
          allSharedDataSets?.forEach(sharedDataSet => {
            const sharedModelTileIds = sharedModelManager?.getSharedModelTileIds(sharedDataSet);
            if (sharedModelTileIds?.includes(tileInfo.id)) {
              sharedModelManager?.removeTileSharedModel(consumerTile, sharedDataSet);
            }
          });
        }
        const sharedModel = sharedModelManager?.findFirstSharedModelByType(SharedDataSet, model.id);
        sharedModel && sharedModelManager?.addTileSharedModel(consumerTile, sharedModel);
      }
    }
  }, [readOnly, model]);

  const unlinkTile = useCallback((tileInfo: ITileLinkMetadata) => {
    const linkedTile = getTileContentById(model.content, tileInfo.id);
    if (!readOnly && linkedTile) {
      const sharedModelManager = linkedTile.tileEnv?.sharedModelManager;
      if (sharedModelManager?.isReady) {
        const sharedModel = sharedModelManager?.findFirstSharedModelByType(SharedDataSet, model.id);
        // If providerId matches model.id, we're the provider and should remove the other tile
        // from the sharedModel. Otherwise, we're the consumer and should remove ourselves.
        if (sharedModel && sharedModel.providerId === model.id) {
          sharedModelManager?.removeTileSharedModel(linkedTile, sharedModel);
        } else if (sharedModel) {
          sharedModelManager?.removeTileSharedModel(model.content, sharedModel);
        }
      }
    }
  }, [readOnly, model]);

  const addTilesContext = useContext(AddTilesContext);

  const createTile = useCallback(() => {
    if (onlyType && !readOnly) {
      const sharedModels = getTileSharedModels(model.content);
      if (sharedModels) {
        addTilesContext?.addTileAfter(onlyType, model, sharedModels, {title: model.title});
      }
    }
  }, [onlyType, readOnly, model, addTilesContext]);

  const onLinkTileHandler = onLinkTile || linkTile;
  const onUnlinkTileHandler = onUnlinkTile || unlinkTile;
  const onCreateTileHandler = onCreateTile || createTile;

  const [showLinkTileDialog] = useLinkConsumerTileDialog({
    linkableTiles,
    model,
    tileType: onlyType,
    onLinkTile: onLinkTileHandler,
    onUnlinkTile: onUnlinkTileHandler,
    onCreateTile: onCreateTileHandler
  });

  return { isLinkEnabled, showLinkTileDialog };
};


