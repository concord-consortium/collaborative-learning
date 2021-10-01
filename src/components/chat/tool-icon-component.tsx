import React, { useContext } from "react";
import { useTypeOfTileInDocumentOrCurriculum } from "../../hooks/use-stores";
import { AppConfigContext } from "../../app-config-context";

interface IProps {
  documentKey?: string;
  tileId?: string;
}

export const ToolIconComponent: React.FC<IProps> = ({documentKey, tileId}) => {

  const tileType = useTypeOfTileInDocumentOrCurriculum(documentKey, tileId);
  const { appIcons } = useContext(AppConfigContext);
console.log('tool-icon-component:tileType', tileType);
console.log('tool-icon-component:appIcons', appIcons);
  
  if (!documentKey || !tileId || !appIcons ) {
    return null;
  }

  if (!tileType) {
    return <div>{appIcons?.["icon-open-workspace"]}</div>;
  }

  const iconName = `icon-${tileType.toLowerCase()}-tool`;
console.log('tool-icon-component:iconName', iconName);
  const TheIcon = appIcons?.[iconName];
  return <div><TheIcon/></div>;
};
