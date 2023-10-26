import React, { useContext } from "react";

import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { useProviderTileLinking } from "../../../hooks/use-provider-tile-linking";
import { registerTileToolbarButtons, registerTileToolbarConfig }
  from "../../../components/toolbar/toolbar-button-manager";

import LinkTableIcon from "../../../clue/assets/icons/geometry/link-table-icon.svg";
import AddIcon from "../../../assets/icons/new/add.svg";

function LinkTileButton(allowMultiple: boolean) {

  const model = useContext(TileModelContext)!;

  const { isLinkEnabled, showLinkTileDialog }
    = useProviderTileLinking({ model, allowMultipleGraphDatasets: allowMultiple });

  const handleLinkTileButtonClick = (e: React.MouseEvent) => {
    isLinkEnabled && showLinkTileDialog();
    e.stopPropagation();
  };

  const Icon = allowMultiple ? AddIcon : LinkTableIcon;

  return (
    <TileToolbarButton
      onClick={handleLinkTileButtonClick}
      disabled={!isLinkEnabled}
    >
      <Icon/>
    </TileToolbarButton>
  );
}

function LinkTileButtonMultiple() {
  return LinkTileButton(true);
}

function LinkTileButtonNoMultiple() {
  return LinkTileButton(false);
}

registerTileToolbarButtons("graph",
[
  {
    name: 'link-tile',
    title: 'Link data',
    component: LinkTileButtonNoMultiple
  },
  {
    name: 'link-tile-multiple',
    title: 'Link more data',
    component: LinkTileButtonMultiple
  }
]);

registerTileToolbarConfig("graph", ['link-tile', 'link-tile-multiple']);
