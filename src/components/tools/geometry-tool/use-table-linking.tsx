import { useCallback, useEffect } from "react";
import { useCurrent } from "../../../hooks/use-current";
import { useFeatureFlag } from "../../../hooks/use-stores";
import { kTableToolID } from "../../../models/tools/table/table-content";
import {
  addTableToDocumentMap, getLinkedTableIndex, getTableLinkColors, removeTableFromDocumentMap
} from "../../../models/tools/table-links";
import { ITileLinkMetadata } from "../../../models/tools/table/table-model-types";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { useLinkTableDialog } from "./use-link-table-dialog";

interface IProps {
  documentId?: string;
  model: ToolTileModelType;
  hasLinkableRows?: boolean;
  onRequestTilesOfType: (tileType: string) => ITileLinkMetadata[];
  onLinkTableTile: (tableTileInfo: ITileLinkMetadata) => void;
  onUnlinkTableTile: (tableTileInfo: ITileLinkMetadata) => void;
}
export const useTableLinking = ({
  // documentId, model, hasLinkableRows, onRequestTilesOfType, onLinkTableTile, onUnlinkTableTile
  documentId, model, onRequestTilesOfType, onLinkTableTile, onUnlinkTableTile

}: IProps) => {
  const modelId = model.id;
  const showLinkButton = useFeatureFlag("GeometryLinkedTables");
  const tableTiles = useLinkableTableTiles({ model, onRequestTilesOfType });
  // const isLinkEnabled = hasLinkableRows && (tableTiles.length > 0);
  const isLinkEnabled = (tableTiles.length > 0);

  const linkColors = getTableLinkColors(modelId);

  const [showLinkTableDialog] =
          useLinkTableDialog({ tableTiles, model, onLinkTableTile, onUnlinkTableTile });

  useEffect(() => {
    documentId && addTableToDocumentMap(documentId, modelId);
    return () => removeTableFromDocumentMap(modelId);
  }, [documentId, modelId]);

  const getLinkIndex = useCallback(() => {
    return showLinkButton ? getLinkedTableIndex(modelId) : -1;
  }, [modelId, showLinkButton]);

  return { showLinkButton, isLinkEnabled, linkColors, getLinkIndex, showLinkTableDialog };
};

interface IUseLinkableTableTilesProps {
  model: ToolTileModelType;
  onRequestTilesOfType: (tileType: string) => ITileLinkMetadata[];
}
const useLinkableTableTiles = ({ model, onRequestTilesOfType }: IUseLinkableTableTilesProps) => {
  const tableTiles = useCurrent(onRequestTilesOfType(kTableToolID));
  // add default title if there isn't a title
  return tableTiles.current
          .map((tileInfo, i) => ({ id: tileInfo.id, title: tileInfo.title || `Table ${i + 1}` }));
};
