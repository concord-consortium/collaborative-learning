import React, { useContext } from "react";

import LinkTableIcon from "../../../clue/assets/icons/geometry/link-table-icon.svg";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { useProviderTileLinking } from "../../../hooks/use-provider-tile-linking";
import { IToolbarButtonComponentProps, registerTileToolbarButtons }
  from "../../../components/toolbar/toolbar-button-manager";

function LinkTileButton({name}: IToolbarButtonComponentProps) {

  const model = useContext(TileModelContext)!;

  const { isLinkEnabled, showLinkTileDialog } = useProviderTileLinking({ model });

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

registerTileToolbarButtons("graph",
[
  {
    name: 'link-tile',
    component: LinkTileButton
  }
]);
