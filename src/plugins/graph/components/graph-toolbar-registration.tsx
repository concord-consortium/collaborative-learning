import React, { useContext } from "react";
import { observer } from "mobx-react";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { useProviderTileLinking } from "../../../hooks/use-provider-tile-linking";
import { IToolbarButtonComponentProps, registerTileToolbarButtons }
  from "../../../components/toolbar/toolbar-button-manager";
import { GraphControllerContext } from "../models/graph-controller";
import { useGraphModelContext } from "../hooks/use-graph-model-context";

import LinkTableIcon from "../../../clue/assets/icons/geometry/link-table-icon.svg";
import AddIcon from "../../../assets/icons/add-data-graph-icon.svg";
import FitAllIcon from "../assets/fit-all-icon.svg";
import LockAxesIcon from "../assets/lock-axes-icon.svg";
import UnlockAxesIcon from "../assets/unlock-axes-icon.svg";
import MovableLineIcon from "../assets/movable-line-icon.svg";

function LinkTileButton(name: string, title: string, allowMultiple: boolean) {

  const model = useContext(TileModelContext)!;

  const { isLinkEnabled, showLinkTileDialog }
    = useProviderTileLinking({ model, allowMultipleGraphDatasets: allowMultiple,
        sharedModelTypes: [ "SharedDataSet", "SharedVariables" ] });

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

function FitAllButton({name}: IToolbarButtonComponentProps) {
  const controller = useContext(GraphControllerContext);

  function handleClick() {
    controller && controller.autoscaleAllAxes();
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

const ToggleLockAxesButton = observer(function ToggleLockAxesButton({name}: IToolbarButtonComponentProps) {
  const graph = useGraphModelContext();
  const locked = graph.lockAxes;

  function handleClick() {
    graph.setLockAxes(!graph.lockAxes);
  }

  return (
    <TileToolbarButton
      name={name}
      title={locked ? "Unlock Axes: Autoscale" : "Lock Axes"}
      onClick={handleClick}
      selected={locked}
      >
        { locked ? <UnlockAxesIcon/> : <LockAxesIcon/> }
    </TileToolbarButton>
  );
});

const MovableLineButton = observer(function MovableLineButton({name}: IToolbarButtonComponentProps) {
  const graph = useGraphModelContext();
  const selected = graph.isShowingMovableLine;

  function handleClick() {
    graph.toggleMovableLine();
  }

  return (
    <TileToolbarButton
    name={name}
    title="Movable line"
    selected={selected}
    onClick={handleClick}>
      <MovableLineIcon/>
    </TileToolbarButton>
  );
});

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
    name: 'fit-all',
    component: FitAllButton
  },
  {
    name: 'toggle-lock',
    component: ToggleLockAxesButton
  },
  {
    name: 'movable-line',
    component: MovableLineButton
  }
]);
