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

  if (!documentKey || !tileId || !appIcons) {
    return null;
  }

  if (!tileType) {
    return <div>{appIcons?.["icon-open-workspace"]}</div>;
  }

  const iconName = `icon-${tileType.toLowerCase()}-tool`;
  const TheIcon = appIcons?.[iconName];
  return <div><TheIcon/></div>;
};
