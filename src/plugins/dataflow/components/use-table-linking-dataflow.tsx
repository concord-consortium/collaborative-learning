import { useCallback, useEffect } from "react";
import { useCurrent } from "../../../hooks/use-current";
import { useFeatureFlag } from "../../../hooks/use-stores";
import { kTableTileType } from "../../../models/tiles/table/table-content";
import { ITileLinkMetadata } from "../../../models/tiles/table-link-types";
import {
  addTableToDocumentMap, getLinkedTableIndex, getTableLinkColors, removeTableFromDocumentMap
} from "../../../models/tiles/table-links";
import { ITileModel } from "../../../models/tiles/tile-model";
import { useLinkTableDialogDataFlow } from "./use-link-table-dialog-dataflow";
import { IDataFlowActionHandlers } from "./dataflow-shared";

//TODO: this is generally a copy of use-table-linking.tsx for Geometry Tile
//consider refacxtoring -> https://www.pivotaltracker.com/n/projects/2441242/stories/184992684

interface IProps {
  documentId?: string;
  model: ITileModel;
  onRequestTilesOfType: (tileType: string) => ITileLinkMetadata[];
  actionHandlers?: IDataFlowActionHandlers; //maybe get rid of
}

export const useTableLinkingDataFlow = (props: IProps) => {
  const { documentId, model, onRequestTilesOfType, actionHandlers } = props;
  const { handleRequestTableLink, handleRequestTableUnlink } = actionHandlers || {};
  const modelId = model.id;

  const showLinkButton = useFeatureFlag("DataflowLinkedTables");
  const tableTiles = useLinkableTableTiles({ model, onRequestTilesOfType });
  const isLinkEnabled = (tableTiles.length > 0);
  const linkColors = getTableLinkColors(modelId);

  const [showLinkTableDialog] =
          useLinkTableDialogDataFlow({ tableTiles, model, handleRequestTableLink, handleRequestTableUnlink });

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

//this is what tells us which table tiles are currently in the document
export const useLinkableTableTiles = ({ onRequestTilesOfType }: IUseLinkableTableTilesProps) => {
  const tableTiles = useCurrent(onRequestTilesOfType(kTableTileType));
  // add default title if there isn't a title
  return tableTiles.current
          .map((tileInfo, i) => ({ id: tileInfo.id, title: tileInfo.title || `Table ${i + 1}` }));
};

