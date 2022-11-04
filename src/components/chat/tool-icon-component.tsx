import React from "react";
import { useTypeOfTileInDocumentOrCurriculum } from "../../hooks/use-stores";
import DocumentIcon from "../../assets/icons/document-icon.svg";
import { getToolComponentInfo } from "../../models/tools/tool-component-info";

interface IProps {
  documentKey?: string;
  tileId?: string;
}

export const ToolIconComponent: React.FC<IProps> = ({documentKey, tileId}) => {
  const tileType = useTypeOfTileInDocumentOrCurriculum(documentKey, tileId);
  const Icon = tileType && getToolComponentInfo(tileType)?.Icon;
  return Icon ? <Icon/> : <DocumentIcon/>;
};
