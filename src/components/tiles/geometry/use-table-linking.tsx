import { useCallback, useEffect } from "react";
import { useCurrent } from "../../../hooks/use-current";
import { useFeatureFlag } from "../../../hooks/use-stores";
import { kTableTileType } from "../../../models/tiles/table/table-content";
import { ITileLinkMetadata } from "../../../models/tiles/table-link-types";
import {
  addTableToDocumentMap, getLinkedTableIndex, getTableLinkColors, removeTableFromDocumentMap
} from "../../../models/tiles/table-links";
import { ITileModel } from "../../../models/tiles/tile-model";
import { useLinkTableDialog } from "./use-link-table-dialog";
import { IToolbarActionHandlers } from "./geometry-shared";

//TODO: use-table-linking-dataflow.tsx is very similar
//consider refactoring -> https://www.pivotaltracker.com/n/projects/2441242/stories/184992684

interface IProps {
  documentId?: string;
  model: ITileModel;
  onRequestTilesOfType: (tileType: string) => ITileLinkMetadata[];
  actionHandlers?: IToolbarActionHandlers;
}
export const useTableLinking = ({documentId, model, onRequestTilesOfType, actionHandlers}: IProps) => {
  const {handleRequestTableLink, handleRequestTableUnlink} = actionHandlers || {};
  const modelId = model.id;
  const showLinkButton = useFeatureFlag("GeometryLinkedTables");
  const tableTiles = useLinkableTableTiles({ model, onRequestTilesOfType });
  const isLinkEnabled = (tableTiles.length > 0);
  const linkColors = getTableLinkColors(modelId);

  const [showLinkTableDialog] =
          useLinkTableDialog({ tableTiles, model, handleRequestTableLink, handleRequestTableUnlink });

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
  model: ITileModel;
  onRequestTilesOfType: (tileType: string) => ITileLinkMetadata[];
}
const useLinkableTableTiles = ({ onRequestTilesOfType }: IUseLinkableTableTilesProps) => {
  const tableTiles = useCurrent(onRequestTilesOfType(kTableTileType));
  // add default title if there isn't a title
  return tableTiles.current
          .map((tileInfo, i) => ({ id: tileInfo.id, title: tileInfo.title || `Table ${i + 1}` }));
};
