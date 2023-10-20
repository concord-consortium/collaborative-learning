import React, { useContext } from "react";
import { getTileComponentInfo } from "../../models/tiles/tile-component-info";
import { SharedDataSet } from "../../models/shared/shared-data-set";
import { AddTilesContext, TileModelContext } from "../tiles/tile-api";
import { TileToolbarButton } from "./tile-toolbar-button";

import ViewBadgeIcon from "../../assets/icons/view/view-badge.svg";

import "./data-set-view-button.scss";

interface IProps {
  args: string[];
}

/**
 * Deprecated; Tiles should move to the shared toolbar components in src/components/toolbar
 */
export const DataSetViewButton: React.FC<IProps> = ({args}) => {
  const addTilesContext = useContext(AddTilesContext);
  const tile = useContext(TileModelContext);

  if (args.length !== 2 || args[0] !== "data-set-view") {
    console.error("Unknown args", args);
    return null;
  }

  const newTileType = args[1];

  // TODO: if the document or tile are undefined then disable the button

  function handleClick () {
    const tileId = tile?.id;
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
        className="dataset-view-button" onClick={handleClick}
        title={`Create a linked ${newTileType} tile`}>
      { Icon ? <Icon/> : "??" }
      <ViewBadgeIcon className="button-badge"/>
    </TileToolbarButton>
  );
};
