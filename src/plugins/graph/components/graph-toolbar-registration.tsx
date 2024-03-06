import React, { useContext } from "react";
import { observer } from "mobx-react";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { useProviderTileLinking } from "../../../hooks/use-provider-tile-linking";
import { IToolbarButtonComponentProps, registerTileToolbarButtons }
  from "../../../components/toolbar/toolbar-button-manager";
import { GraphControllerContext } from "../models/graph-controller";
import { useGraphModelContext } from "../hooks/use-graph-model-context";
import { useGraphEditingContext } from "../hooks/use-graph-editing-context";

import LinkTableIcon from "../../../clue/assets/icons/geometry/link-table-icon.svg";
import AddIcon from "../../../assets/icons/add-data-graph-icon.svg";
import FitAllIcon from "../assets/fit-all-icon.svg";
import LockAxesIcon from "../assets/lock-axes-icon.svg";
import UnlockAxesIcon from "../assets/unlock-axes-icon.svg";
import AddPointsByHandIcon from "../assets/add-points-by-hand-icon.svg";
import SelectToolIcon from "../assets/select-tool-icon.svg";
import AddPointsIcon from "../assets/add-points-icon.svg";

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

const AddPointsByHandButton = observer(function AddPointsByHandButton({name}: IToolbarButtonComponentProps) {
  const graph = useGraphModelContext();
  const graphEditMode = useGraphEditingContext();
  const hasEditableLayers = graph.getEditableLayers().length > 0;

  // Enable button if axes are numeric or undefined.
  const isNumeric = (graph.attributeType("x")||"numeric") === "numeric"
    && (graph.attributeType("y")||"numeric") === "numeric";

  const enabled = isNumeric && !hasEditableLayers;

  function handleClick() {
    graph.createEditableLayer();
    graphEditMode.setEditMode("add");
  }

  return (
    <TileToolbarButton
      name={name}
      title="Add points by hand"
      onClick={handleClick}
      disabled={!enabled}
    >
      <AddPointsByHandIcon/>
    </TileToolbarButton>
  );

});

const SelectPointsButton = observer(function({name}: IToolbarButtonComponentProps) {
  const graph = useGraphModelContext();
  const graphEditModeContext = useGraphEditingContext();

  const editableLayers = graph.getEditableLayers();
  const hasEditableLayers = editableLayers.length > 0;

  function handleClick() {
    graphEditModeContext.setEditMode(graphEditModeContext.editPointsMode ? "none" : "edit");
  }

  return (
    <TileToolbarButton
      name={name}
      title="Select/Move point"
      onClick={handleClick}
      selected={graphEditModeContext.editPointsMode}
      disabled={!hasEditableLayers}
    >
      <SelectToolIcon/>
    </TileToolbarButton>
  );
});

const AddPointsButton = observer(function({name}: IToolbarButtonComponentProps) {
  const graph = useGraphModelContext();
  const graphEditModeContext = useGraphEditingContext();

  const editableLayers = graph.getEditableLayers();
  const hasEditableLayers = editableLayers.length > 0;

  const iconStyle = { fill: graphEditModeContext.getEditablePointsColor() };

  function handleClick() {
    // Toggle the mode
    graphEditModeContext.setEditMode(graphEditModeContext.addPointsMode ? "none" : "add");
  }

  return (
    <TileToolbarButton
      name={name}
      title="Add point"
      onClick={handleClick}
      selected={graphEditModeContext.addPointsMode}
      disabled={!hasEditableLayers}
    >
      <AddPointsIcon style={iconStyle} />
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
    name: 'add-points-by-hand',
    component: AddPointsByHandButton
  },
  {
    name: 'add-points',
    component: AddPointsButton
  },
  {
    name: 'move-points',
    component: SelectPointsButton
  }

]);
