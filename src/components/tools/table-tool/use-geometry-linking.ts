import { useEffect } from "react";
import { useCurrent } from "../../../hooks/use-current";
import { kGeometryToolID } from "../../../models/tools/geometry/geometry-content";
import {
  addTableToDocumentMap, getLinkedTableIndex, removeTableFromDocumentMap
} from "../../../models/tools/table-links";
import { TableContentModelType } from "../../../models/tools/table/table-content";
import { ITileLinkMetadata } from "../../../models/tools/table/table-model-types";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { useLinkGeometryDialog } from "./use-link-geometry-dialog";

interface IProps {
  documentId?: string;
  model: ToolTileModelType;
  hasLinkableRows: boolean;
  onRequestTilesOfType: (tileType: string) => ITileLinkMetadata[];
  onLinkGeometryTile: (geomTileInfo: ITileLinkMetadata) => void;
}
export const useGeometryLinking = ({
  documentId, model, hasLinkableRows, onRequestTilesOfType, onLinkGeometryTile
}: IProps) => {
  const modelId = model.id;
  const linkIndex = getLinkedTableIndex(modelId);
  const geometryTiles = useLinkableGeometryTiles({ model, onRequestTilesOfType });
  const isLinkEnabled = hasLinkableRows && (geometryTiles.length > 0);

  const [showLinkGeometryDialog] = useLinkGeometryDialog({ geometryTiles, onLinkGeometryTile });

  useEffect(() => {
    documentId && addTableToDocumentMap(documentId, modelId);
    return () => removeTableFromDocumentMap(modelId);
  }, [documentId, modelId]);

  return { isLinkEnabled, linkIndex, showLinkGeometryDialog };
};

interface IUseLinkableGeometryTilesProps {
  model: ToolTileModelType;
  onRequestTilesOfType: (tileType: string) => ITileLinkMetadata[];
}
const useLinkableGeometryTiles = ({ model, onRequestTilesOfType }: IUseLinkableGeometryTilesProps) => {
  const geometryTiles = useCurrent(onRequestTilesOfType(kGeometryToolID));
  const content = model.content as TableContentModelType;
  // add default title if there isn't a title; filter out tiles we're already linked to
  return geometryTiles.current
          .map((tileInfo, i) => ({ id: tileInfo.id, title: tileInfo.title || `Graph ${i + 1}` }))
          .filter(tileInfo => content.metadata.linkedGeometries.indexOf(tileInfo.id) < 0);
};
