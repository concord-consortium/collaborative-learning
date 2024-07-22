import React, { useContext } from "react";
import { observer } from "mobx-react";
import { getTileComponentInfo } from "../../models/tiles/tile-component-info";
import { SharedDataSet } from "../../models/shared/shared-data-set";
import { TileModelContext } from "../tiles/tile-api";
import { TileToolbarButton } from "./tile-toolbar-button";
import { BadgedIcon } from "./badged-icon";
import { useConsumerTileLinking } from "../../hooks/use-consumer-tile-linking";
import { getTileDataSet } from "../../models/shared/shared-data-utils";
import { getTileCreateActionName } from "../../models/tiles/tile-content-info";

import ViewBadgeIcon from "../../assets/icons/view/view-badge.svg";

interface IProps {
  name: string;
  args?: string[];
}

/**
 * Defines a toolbar button that will bring up a dialog to link our data to another tile.
 * The type of tile to be used is set by an argument to the button.
 * So it is used in the toolbar config like `[data-set-link Graph]`.
 */
export const DataSetLinkButton = observer(({name, args}: IProps) => {
  const model = useContext(TileModelContext)!;

  const newTileType = args?.[1];
  const tooltip = getTileCreateActionName(newTileType);

  const dataSet = model && getTileDataSet(model.content);
  const hasLinkableRows = dataSet ? dataSet.attributes.length > 1 : false;

  const { isLinkEnabled, showLinkTileDialog } =
    useConsumerTileLinking({ model, hasLinkableRows, tileType: newTileType, shareType: SharedDataSet });

  if (args?.length !== 2 || args[0] !== "data-set-link") {
    console.error("Unknown args", args);
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    isLinkEnabled && showLinkTileDialog();
    e.stopPropagation();
  };

  const newTileInfo = getTileComponentInfo(newTileType);
  const Icon = newTileInfo?.Icon;

  return (
    <TileToolbarButton
        name={name}
        title={tooltip}
        disabled={!isLinkEnabled}
        onClick={handleClick}
    >
      {Icon ? <BadgedIcon Icon={Icon} Badge={ViewBadgeIcon}/> : "??"}
    </TileToolbarButton>
  );
});
