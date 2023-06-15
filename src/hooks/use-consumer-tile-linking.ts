import { useCallback, useEffect } from "react";

import { getColorMapEntry } from "../models/shared/shared-data-set-colors";
import {
  ILinkableTiles, ITileLinkMetadata, ITypedTileLinkMetadata, kNoLinkableTiles
} from "../models/tiles/tile-link-types";
import {
  addTableToDocumentMap, getLinkedTableIndex, removeTableFromDocumentMap
} from "../models/tiles/table-links";
import { ITileModel } from "../models/tiles/tile-model";
import { useLinkConsumerTileDialog } from "./use-link-consumer-tile-dialog";
import { getTileContentById } from "../utilities/mst-utils";
import { SharedDataSet } from "../models/shared/shared-data-set";
import { getTileContentInfo } from "../models/tiles/tile-content-info";
import { ILinkOptions } from "../models/shared/shared-types";
import { linkTileToDataSet } from "../models/shared/shared-data-utils";

interface IProps {
  documentId?: string;
  hasLinkableRows: boolean;
  model: ITileModel;
  readOnly?: boolean;
  onRequestTilesOfType: (tileType: string) => ITileLinkMetadata[];
  onRequestLinkableTiles?: () => ILinkableTiles;
  onLinkTile?: (tileInfo: ITileLinkMetadata) => void;
  onUnlinkTile?: (tileInfo: ITileLinkMetadata) => void;
}
export const useConsumerTileLinking = ({
  documentId, model, hasLinkableRows, readOnly, onRequestTilesOfType, onRequestLinkableTiles, onLinkTile, onUnlinkTile
}: IProps) => {
  const modelId = model.id;
  const { consumers: linkableTiles } = useLinkableTiles({ model, onRequestTilesOfType, onRequestLinkableTiles });
  const isLinkEnabled = hasLinkableRows && (linkableTiles.length > 0);
  const colorMapEntry = getColorMapEntry(modelId);
  const linkColors = colorMapEntry?.colorSet;

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
        const sharedModel = sharedModelManager?.findFirstSharedModelByType(SharedDataSet, model.id);
        if (sharedModel) {
          const { consumesMultipleDataSets, requiresCaseMetadata } = getTileContentInfo(consumerTile.type) || {};
          const options: ILinkOptions = { consumesMultipleDataSets, requiresCaseMetadata };
          linkTileToDataSet(consumerTile, sharedModel?.dataSet, options);
        }
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

  const onLinkTileHandler = onLinkTile || linkTile;
  const onUnlinkTileHandler = onUnlinkTile || unlinkTile;

  const [showLinkTileDialog] = useLinkConsumerTileDialog({
    linkableTiles, model, onLinkTile: onLinkTileHandler, onUnlinkTile: onUnlinkTileHandler
  });

  useEffect(() => {
    documentId && addTableToDocumentMap(documentId, modelId);
    return () => removeTableFromDocumentMap(modelId);
  }, [documentId, modelId]);

  const getLinkIndex = useCallback(() => {
    return getLinkedTableIndex(modelId);
  }, [modelId]);

  return { isLinkEnabled, linkColors, getLinkIndex, showLinkTileDialog };
};

interface IUseLinkableTilesProps {
  model: ITileModel;
  onRequestTilesOfType: (tileType: string) => ITileLinkMetadata[];
  onRequestLinkableTiles?: () => ILinkableTiles;
}
const useLinkableTiles = ({ model, onRequestTilesOfType, onRequestLinkableTiles }: IUseLinkableTilesProps) => {
  const { providers, consumers } = onRequestLinkableTiles?.() || kNoLinkableTiles;

  // add default title if there isn't a title
  const countsOfType = {} as Record<string, number>;
  function addDefaultTitle({ id, type, title, titleBase }: ITypedTileLinkMetadata) {
    if (!countsOfType[type]) {
      countsOfType[type] = 1;
    } else {
      countsOfType[type]++;
    }
    return { id, type, title: title || `${titleBase || type} ${countsOfType[type]}`};
  }

  return {
    providers: providers.map(addDefaultTitle),
    consumers: consumers.map(addDefaultTitle)
  };
};
