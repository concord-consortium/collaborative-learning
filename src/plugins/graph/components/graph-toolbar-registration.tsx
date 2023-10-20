import React, { useContext } from "react";

import LinkTableIcon from "../../../clue/assets/icons/geometry/link-table-icon.svg";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { useProviderTileLinking } from "../../../hooks/use-provider-tile-linking";
import { registerTileToolbarButtons, registerTileToolbarConfig }
  from "../../../components/toolbar/toolbar-button-manager";

function LinkTileButton() {

  const model = useContext(TileModelContext)!;

  const { isLinkEnabled, showLinkTileDialog } = useProviderTileLinking({ model });

  const handleLinkTileButtonClick = (e: React.MouseEvent) => {
    isLinkEnabled && showLinkTileDialog();
    e.stopPropagation();
  };

  return (
    <TileToolbarButton
      onClick={handleLinkTileButtonClick}
      disabled={!isLinkEnabled}
    >
      <LinkTableIcon/>
    </TileToolbarButton>
  );
}

registerTileToolbarButtons("graph",
[
  {
    name: 'link-tile',
    title: 'Link data',
    component: LinkTileButton
  }
]);

registerTileToolbarConfig("graph", ['link-tile']);
