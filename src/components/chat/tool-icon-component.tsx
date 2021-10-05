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

  // if (!documentKey || !tileId || !appIcons) {
  //   return null;
  // }

  // if (!tileType) {
  //   return <div>{appIcons?.["icon-open-workspace"]}</div>;
  // }

  // const iconName = `icon-${tileType.toLowerCase()}-tool`;
  // const TheIcon = appIcons?.[iconName];
  // return <div><TheIcon/></div>;
  const iconName = tileType ? `icon-${tileType.toLowerCase()}-tool` : undefined;
  const Icon = iconName ? appIcons?.[iconName] : undefined;
  return Icon ? <Icon/> : <DocumentIcon/>;
};
