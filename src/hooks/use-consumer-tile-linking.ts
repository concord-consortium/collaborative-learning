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

interface IProps {
  documentId?: string;
  model: ITileModel;
  hasLinkableRows: boolean;
  onRequestTilesOfType: (tileType: string) => ITileLinkMetadata[];
  onRequestLinkableTiles?: () => ILinkableTiles;
  onLinkTile: (tileInfo: ITileLinkMetadata) => void;
  onUnlinkTile: (tileInfo: ITileLinkMetadata) => void;
}
export const useConsumerTileLinking = ({
  documentId, model, hasLinkableRows, onRequestTilesOfType, onRequestLinkableTiles, onLinkTile, onUnlinkTile
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

  const [showLinkTileDialog] =
          useLinkConsumerTileDialog({ linkableTiles, model, onLinkTile, onUnlinkTile });

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
