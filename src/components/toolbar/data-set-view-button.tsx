import React, { useContext } from "react";
import { getTileComponentInfo } from "../../models/tiles/tile-component-info";
import { SharedDataSet } from "../../models/shared/shared-data-set";
import { AddTilesContext, TileModelContext } from "../tiles/tile-api";
import { TileToolbarButton } from "./tile-toolbar-button";
import { BadgedIcon } from "./badged-icon";
import { getTileCreateActionName } from "../../models/tiles/tile-content-info";

import ViewBadgeIcon from "../../assets/icons/view/view-badge.svg";

interface IProps {
  name: string;
  args?: string[];
}

/**
 * Defines a button that will immediately create a tile and link our data to it.
 * The type of tile is defined by an argument to the button.
 * So it is used in the toolbar config like `[data-set-view Table]`.
 */
export function DataSetViewButton({name, args}: IProps) {
  const addTilesContext = useContext(AddTilesContext);
  const tile = useContext(TileModelContext);

  if (args?.length !== 2 || args[0] !== "data-set-view") {
    console.error("Unknown args", args);
    return null;
  }

  const newTileType = args[1];
  const tooltip = getTileCreateActionName(newTileType);

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
        name={name}
        title={tooltip}
        onClick={handleClick}
    >
      {Icon ? <BadgedIcon Icon={Icon} Badge={ViewBadgeIcon}/> : "??"}
    </TileToolbarButton>
  );
}
