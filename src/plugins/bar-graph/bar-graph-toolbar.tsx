import React, { useContext } from "react";
import { TileModelContext } from "../../components/tiles/tile-api";
import { TileToolbarButton } from "../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps, registerTileToolbarButtons }
  from "../../components/toolbar/toolbar-button-manager";
import { useProviderTileLinking } from "../../hooks/use-provider-tile-linking";

import LinkTableIcon from "../../clue/assets/icons/geometry/link-table-icon.svg";

function LinkTileButton({name}: IToolbarButtonComponentProps) {

  const model = useContext(TileModelContext)!;

  const { isLinkEnabled, showLinkTileDialog }
    = useProviderTileLinking({ model, sharedModelTypes: [ "SharedDataSet" ] });

  const handleLinkTileButtonClick = (e: React.MouseEvent) => {
    isLinkEnabled && showLinkTileDialog();
    e.stopPropagation();
  };

  return (
    <TileToolbarButton
      name={name}
      title="Link data"
      onClick={handleLinkTileButtonClick}
      disabled={!isLinkEnabled}
    >
      <LinkTableIcon/>
    </TileToolbarButton>
  );
}

registerTileToolbarButtons("bargraph",
[
  {
    name: 'link-tile',
    component: LinkTileButton
  }
]);
