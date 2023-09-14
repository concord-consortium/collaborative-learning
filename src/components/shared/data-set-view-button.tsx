import React, { useContext } from "react";
import { getTileComponentInfo } from "../../models/tiles/tile-component-info";
import { SharedDataSet } from "../../models/shared/shared-data-set";
import { AddTilesContext, TileModelContext } from "../tiles/tile-api";
import { TileToolbarButton } from "./tile-toolbar-button";

import ViewBadgeIcon from "../../assets/icons/view/view-badge.svg";

import "./data-set-view-button.scss";

interface IProps {
  newTileType: string;
}

export const DataSetViewButton: React.FC<IProps> = ({newTileType}) => {
  const addTilesContext = useContext(AddTilesContext);
  const tile = useContext(TileModelContext);

  // TODO: if the document or tile are undefined then disable the button

  function handleClick () {
    const tileId = tile?.id;
    console.log("handleClick", {tileId, addTilesContext});
    if (!tileId || !addTilesContext) return;

    // Find the first shared dataset of the target tile
    const content = tile.content;
    const dataSet = content.tileEnv?.sharedModelManager?.findFirstSharedModelByType(SharedDataSet, tileId);
    const sharedModels = dataSet ? [dataSet] : undefined;

    addTilesContext.addTileAfter(newTileType, tile, sharedModels);
  }

  const newTileInfo = getTileComponentInfo(newTileType);
  const Icon = newTileInfo?.Icon;

  return (
    <TileToolbarButton 
        className="dataset-view-button" onClick={handleClick} tooltipOptions={{ title: `View data in ${newTileType}`}}>
      { Icon ? <Icon/> : "??" }
      <ViewBadgeIcon className="button-badge"/>
    </TileToolbarButton>
  );
};
