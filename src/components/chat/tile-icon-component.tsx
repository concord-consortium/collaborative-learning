import React from "react";
import { useTypeOfTileInDocumentOrCurriculum } from "../../hooks/use-stores";
import { getTileComponentInfo } from "../../models/tiles/tile-component-info";

import DocumentIcon from "../../assets/icons/document-icon.svg";

interface IProps {
  documentKey?: string;
  tileId?: string;
}

export const TileIconComponent: React.FC<IProps> = ({documentKey, tileId}) => {
  const tileType = useTypeOfTileInDocumentOrCurriculum(documentKey, tileId);
  const Icon = tileType && getTileComponentInfo(tileType)?.HeaderIcon;
  return Icon ? <Icon/> : <DocumentIcon/>;
};
