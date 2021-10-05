import React, { useContext } from "react";
import { useTypeOfTileInDocumentOrCurriculum } from "../../hooks/use-stores";
import { AppConfigContext } from "../../app-config-context";
import DocumentIcon from "../../assets/icons/document-icon.svg";

interface IProps {
  documentKey?: string;
  tileId?: string;
}

export const ToolIconComponent: React.FC<IProps> = ({documentKey, tileId}) => {

  const tileType = useTypeOfTileInDocumentOrCurriculum(documentKey, tileId);
  const { appIcons } = useContext(AppConfigContext);
  const iconName = tileType ? `icon-${tileType.toLowerCase()}-tool` : undefined;
  const Icon = iconName ? appIcons?.[iconName] : undefined;
  return Icon ? <Icon/> : <DocumentIcon/>;
};
