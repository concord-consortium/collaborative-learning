import { useCallback, useEffect } from "react";
import { useFeatureFlag } from "../../../hooks/use-stores";
import { getColorMapEntry } from "../../../models/shared/shared-data-set-colors";
import { ITileLinkMetadata } from "../../../models/tiles/table-link-types";
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
  onRequestLinkableTiles: () => ITileLinkMetadata[];
  onLinkTile: (tileInfo: ITileLinkMetadata) => void;
  onUnlinkTile: (tileInfo: ITileLinkMetadata) => void;
}
export const useTileLinking = ({
  documentId, model, hasLinkableRows, onRequestTilesOfType, onRequestLinkableTiles, onLinkTile, onUnlinkTile
}: IProps) => {
  const modelId = model.id;
  const showLinkButton = useFeatureFlag("TileLinkedTables");
  const linkableTiles = useLinkableTiles({ model, onRequestTilesOfType, onRequestLinkableTiles });
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
    return showLinkButton ? getLinkedTableIndex(modelId) : -1;
  }, [modelId, showLinkButton]);

  return { showLinkButton, isLinkEnabled, linkColors, getLinkIndex, showLinkTileDialog };
};

interface IUseLinkableTilesProps {
  model: ITileModel;
  onRequestTilesOfType: (tileType: string) => ITileLinkMetadata[];
  onRequestLinkableTiles: () => ITileLinkMetadata[];
}
const useLinkableTiles = ({ model, onRequestTilesOfType, onRequestLinkableTiles }: IUseLinkableTilesProps) => {
  const linkableTiles = onRequestLinkableTiles();

  // add default title if there isn't a title
  return linkableTiles.map((tileInfo, i) => ({ id: tileInfo.id, title: tileInfo.title || `Graph ${i + 1}` }));
};
