import { useCallback, useEffect } from "react";
import { useCurrent } from "../../../hooks/use-current";
import { useFeatureFlag } from "../../../hooks/use-stores";
import { kTableTileType } from "../../../models/tiles/table/table-content";
import { ITileLinkMetadata } from "../../../models/tiles/table-link-types";
import {
  addTableToDocumentMap, getLinkedTableIndex, getTableLinkColors, removeTableFromDocumentMap
} from "../../../models/tiles/table-links";
import { ITileModel } from "../../../models/tiles/tile-model";
import { useLinkTableDialog } from "./dataflow-use-link-table-dialog";
import { IToolbarActionHandlers } from "../../../components/tiles/geometry/geometry-shared";

interface IProps {
  documentId?: string;
  model: ITileModel;
  onRequestTilesOfType: (tileType: string) => ITileLinkMetadata[];
  actionHandlers?: IToolbarActionHandlers; //maybe get rid of
}



export const useTableLinking = (props: IProps) => {
  const { documentId, model, onRequestTilesOfType, actionHandlers } = props;
  const {handleRequestTableLink, handleRequestTableUnlink} = actionHandlers || {};
  const modelId = model.id;
  // const showLinkButton = useFeatureFlag("GeometryLinkedTables"); //original
  const showLinkButton = useFeatureFlag("DataflowLinkedTables"); //modified
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
  // const isLinkEnabled = true;
  // const getLinkIndex = false;

  console.log("typeof getLinkIndex:", typeof getLinkIndex);
  // return {isLinkEnabled, getLinkIndex};
  // return testReturn;
};

interface IUseLinkableTableTilesProps {
  model: ITileModel;
  onRequestTilesOfType: (tileType: string) => ITileLinkMetadata[];
}

//this is what tells us which table tiles are currently in the document
const useLinkableTableTiles = ({ onRequestTilesOfType }: IUseLinkableTableTilesProps) => {
  const tableTiles = useCurrent(onRequestTilesOfType(kTableTileType));
  // add default title if there isn't a title
  return tableTiles.current
          .map((tileInfo, i) => ({ id: tileInfo.id, title: tileInfo.title || `Table ${i + 1}` }));
};

