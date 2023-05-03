import { useCallback, useEffect } from "react";
import { getColorMapEntry } from "../../../models/shared/shared-data-set-colors";
import {
  ILinkableTiles, ITileLinkMetadata, ITypedTileLinkMetadata, kNoLinkableTiles
} from "../../../models/tiles/tile-link-types";
import {
  addTableToDocumentMap, getLinkedTableIndex, removeTableFromDocumentMap
} from "../../../models/tiles/table-links";
import { ITileModel } from "../../../models/tiles/tile-model";
import { useLinkTileDialog } from "./use-link-tile-dialog";

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

  const [showLinkTileDialog] =
          useLinkTileDialog({ linkableTiles, model, onLinkTile, onUnlinkTile });

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
  function addDefaultTitle({ id, type, title }: ITypedTileLinkMetadata, i: number) {
    return { id, type, title: title || `${type} ${i + 1}`};
  }

  return {
    providers: providers.map(addDefaultTitle),
    consumers: consumers.map(addDefaultTitle)
  };
};
