import React, { useContext } from "react";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { useProviderTileLinking } from "../../../hooks/use-provider-tile-linking";
import { IToolbarButtonComponentProps, registerTileToolbarButtons }
  from "../../../components/toolbar/toolbar-button-manager";
  import { GraphControllerContext } from "../models/graph-controller";

import LinkTableIcon from "../../../clue/assets/icons/geometry/link-table-icon.svg";
import AddIcon from "../assets/add-data-graph-icon.svg";
import FitAllIcon from "../assets/fit-all-icon.svg";

function LinkTileButton(name: string, title: string, allowMultiple: boolean) {

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
      name={name}
      title={title}
      onClick={handleLinkTileButtonClick}
      disabled={!isLinkEnabled}
    >
      <Icon/>
    </TileToolbarButton>
  );
}

function LinkTileButtonMultiple({name}: IToolbarButtonComponentProps) {
  return LinkTileButton(name, "Add data", true);
}

function LinkTileButtonNoMultiple({name}: IToolbarButtonComponentProps) {
  return LinkTileButton(name, "Link data", false);
}

function FullViewButton({name}: IToolbarButtonComponentProps) {
  const controller = useContext(GraphControllerContext);

  function handleClick() {
    controller && controller.handleFullView();
  }

  return (
    <TileToolbarButton
      name={name}
      title="Fit All"
      onClick={handleClick}
    >
      <FitAllIcon/>
    </TileToolbarButton>
  );

}

registerTileToolbarButtons("graph",
[
  {
    name: 'link-tile',
    component: LinkTileButtonNoMultiple
  },
  {
    name: 'link-tile-multiple',
    component: LinkTileButtonMultiple
  },
  {
    name: 'full-view',
    component: FullViewButton
  }
]);
