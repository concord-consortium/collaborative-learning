import { useCallback, useEffect } from "react";
import { useCurrent } from "../../../hooks/use-current";
import { useFeatureFlag } from "../../../hooks/use-stores";
import { kGeometryToolID } from "../../../models/tiles/geometry/geometry-types";
import { ITileLinkMetadata } from "../../../models/tiles/table-link-types";
import {
  addTableToDocumentMap, getLinkedTableIndex, getTableLinkColors, removeTableFromDocumentMap
} from "../../../models/tiles/table-links";
import { ITileModel } from "../../../models/tiles/tile-model";
import { useLinkGeometryDialog } from "./use-link-geometry-dialog";

interface IProps {
  documentId?: string;
  model: ITileModel;
  hasLinkableRows: boolean;
  onRequestTilesOfType: (tileType: string) => ITileLinkMetadata[];
  onLinkGeometryTile: (geomTileInfo: ITileLinkMetadata) => void;
  onUnlinkGeometryTile: (geomTileInfo: ITileLinkMetadata) => void;
}
export const useGeometryLinking = ({
  documentId, model, hasLinkableRows, onRequestTilesOfType, onLinkGeometryTile, onUnlinkGeometryTile
}: IProps) => {
  const modelId = model.id;
  const showLinkButton = useFeatureFlag("GeometryLinkedTables");
  const geometryTiles = useLinkableGeometryTiles({ model, onRequestTilesOfType });
  const isLinkEnabled = hasLinkableRows && (geometryTiles.length > 0);
  const linkColors = getTableLinkColors(modelId);

  const [showLinkGeometryDialog] =
          useLinkGeometryDialog({ geometryTiles, model, onLinkGeometryTile, onUnlinkGeometryTile });

  useEffect(() => {
    documentId && addTableToDocumentMap(documentId, modelId);
    return () => removeTableFromDocumentMap(modelId);
  }, [documentId, modelId]);

  const getLinkIndex = useCallback(() => {
    return showLinkButton ? getLinkedTableIndex(modelId) : -1;
  }, [modelId, showLinkButton]);

  return { showLinkButton, isLinkEnabled, linkColors, getLinkIndex, showLinkGeometryDialog };
};

interface IUseLinkableGeometryTilesProps {
  model: ITileModel;
  onRequestTilesOfType: (tileType: string) => ITileLinkMetadata[];
}
const useLinkableGeometryTiles = ({ model, onRequestTilesOfType }: IUseLinkableGeometryTilesProps) => {
  const geometryTiles = useCurrent(onRequestTilesOfType(kGeometryToolID));
  // add default title if there isn't a title
  return geometryTiles.current
          .map((tileInfo, i) => ({ id: tileInfo.id, title: tileInfo.title || `Graph ${i + 1}` }));
};
