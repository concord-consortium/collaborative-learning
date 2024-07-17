import React, { useContext } from "react";
import { TileModelContext } from "../../components/tiles/tile-api";
import { BadgedIcon } from "../../components/toolbar/badged-icon";
import { TileToolbarButton } from "../../components/toolbar/tile-toolbar-button";
import { useConsumerTileLinking } from "../../hooks/use-consumer-tile-linking";
import { getTileComponentInfo } from "../../models/tiles/tile-component-info";
import { SharedVariables } from "./shared-variables";
import { getTileCreateActionName } from "../../models/tiles/tile-content-info";

import ViewBadgeIcon from "../../assets/icons/view/view-badge.svg";

interface IProps {
  name: string;
  args?: string[];
  disabled?: boolean;
}

export function SharedVariablesLinkButton({name, args, disabled}: IProps) {
  const tile = useContext(TileModelContext);

  if (args?.length !== 2 || args[0] !== "variables-link") {
    console.error("Unknown args", args);
  }

  const newTileType = args?.[1] || '';
  const tooltip = getTileCreateActionName(newTileType);

  const newTileInfo = getTileComponentInfo(newTileType);
  const Icon = newTileInfo?.Icon;

  const { isLinkEnabled, showLinkTileDialog }
    = useConsumerTileLinking({
      model: tile!,
      hasLinkableRows: !disabled,
      shareType: SharedVariables,
      tileType: newTileType
    });

  const handleClick = (e: React.MouseEvent) => {
    showLinkTileDialog && showLinkTileDialog();
    e.stopPropagation();
  };

  return (
    <TileToolbarButton
      name={name}
      title={tooltip}
      onClick={handleClick}
      disabled={!!disabled && !isLinkEnabled}
    >
      {Icon ? <BadgedIcon Icon={Icon} Badge={ViewBadgeIcon}/> : "??"}
    </TileToolbarButton>
 );

}
