import React from "react";
import { useTypeOfTileInDocumentOrCurriculum } from "../../hooks/use-stores";
import DocumentIcon from "../../assets/icons/document-icon.svg";
import { getToolContentInfoById } from "../../models/tools/tool-content-info";

interface IProps {
  documentKey?: string;
  tileId?: string;
}

export const ToolIconComponent: React.FC<IProps> = ({documentKey, tileId}) => {
  const tileType = useTypeOfTileInDocumentOrCurriculum(documentKey, tileId);
  const Icon = getToolContentInfoById(tileType)?.icon;
  return Icon ? <Icon/> : <DocumentIcon/>;
};
