import { useCallback, useEffect } from "react";

import {
  ILinkableTiles, ITileLinkMetadata, ITypedTileLinkMetadata, kNoLinkableTiles
} from "../models/tiles/tile-link-types";
import {
  addTableToDocumentMap, getLinkedTableIndex, getTableLinkColors, removeTableFromDocumentMap
} from "../models/tiles/table-links";
import { ITileModel } from "../models/tiles/tile-model";
import { useLinkProviderTileDialog } from "./use-link-provider-tile-dialog";

interface IProps {
  actionHandlers?: any;
  documentId?: string;
  model: ITileModel;
  onRequestTilesOfType: (tileType: string) => ITileLinkMetadata[];
  onRequestLinkableTiles?: () => ILinkableTiles;
}
export const useProviderTileLinking = ({
  actionHandlers, documentId, model, onRequestTilesOfType, onRequestLinkableTiles
}: IProps) => {
  const {handleRequestTileLink, handleRequestTileUnlink} = actionHandlers || {};
  const modelId = model.id;
  const { providers: linkableTiles } = useLinkableTiles({ model, onRequestTilesOfType, onRequestLinkableTiles });
  const isLinkEnabled = (linkableTiles.length > 0);
  const linkColors = getTableLinkColors(modelId);

  const [showLinkTileDialog] =
          useLinkProviderTileDialog({
            linkableTiles, model, handleRequestTileLink, handleRequestTileUnlink
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
