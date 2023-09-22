import React from "react";
import { useTypeOfTileInDocumentOrCurriculum } from "../../hooks/use-stores";
import DocumentIcon from "../../assets/icons/document-icon.svg";
import { getTileComponentInfo } from "../../models/tiles/tile-component-info";

interface IProps {
  documentKey?: string;
  tileId?: string;
}

export const TileIconComponent: React.FC<IProps> = ({ documentKey, tileId }) => {
  const tileType = useTypeOfTileInDocumentOrCurriculum(documentKey, tileId);
  const Icon = tileType && getTileComponentInfo(tileType)?.Icon;
  return Icon ? <Icon/> : <DocumentIcon/>;
};
