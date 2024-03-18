import React, { useContext } from "react";
import { observer } from "mobx-react";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { useProviderTileLinking } from "../../../hooks/use-provider-tile-linking";
import { IToolbarButtonComponentProps, registerTileToolbarButtons }
  from "../../../components/toolbar/toolbar-button-manager";
import { GraphControllerContext } from "../models/graph-controller";
import { useGraphModelContext } from "../hooks/use-graph-model-context";
import { kMovableLineType } from "../adornments/movable-line/movable-line-types";
import { defaultMovableLineAdornment } from "../adornments/movable-line/movable-line-model";

import LinkTableIcon from "../../../clue/assets/icons/geometry/link-table-icon.svg";
import AddIcon from "../../../assets/icons/add-data-graph-icon.svg";
import FitAllIcon from "../assets/fit-all-icon.svg";
import LockAxesIcon from "../assets/lock-axes-icon.svg";
import UnlockAxesIcon from "../assets/unlock-axes-icon.svg";
import MovableLineIcon from "../assets/movable-line-icon.svg";
import AddPointsByHandIcon from "../assets/add-points-by-hand-icon.svg";
import SelectToolIcon from "../assets/select-tool-icon.svg";
import AddPointsIcon from "../assets/add-points-icon.svg";
import DeleteSelectionIcon from "../assets/delete-selection-icon.svg";

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
  const disabled = graph.plotType !== "scatterPlot";
  const adornment = graph.getAdornmentOfType(kMovableLineType);
  const showing = adornment?.isVisible;

  function handleClick() {
    // Toggle whether movable line is showing
    if (showing) {
      graph.hideAdornment(kMovableLineType);
    } else {
      if (adornment) {
        graph.showAdornment(kMovableLineType);
      } else {
        graph.addAdornment(defaultMovableLineAdornment(graph));
      }
    }
  }

  return (
    <TileToolbarButton
      name={name}
      title="Movable line"
      disabled={disabled}
      selected={showing && !disabled}
      onClick={handleClick}>
      <MovableLineIcon />
    </TileToolbarButton>
  );
});

const AddPointsByHandButton = observer(function AddPointsByHandButton({name}: IToolbarButtonComponentProps) {
  const graph = useGraphModelContext();
  const hasEditableLayers = graph.getEditableLayers().length > 0;

  // Enable button if axes are numeric or undefined.
  const isNumeric = (graph.attributeType("x")||"numeric") === "numeric"
    && (graph.attributeType("y")||"numeric") === "numeric";

  const enabled = isNumeric && !hasEditableLayers;

  function handleClick() {
    graph.createEditableLayer();
    graph.setEditingMode("add");
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
  const currentMode = graph.editingMode;

  const linked = graph.isLinkedToDataSet;

  function handleClick() {
    graph.setEditingMode(currentMode==="edit" ? "none" : "edit");
  }

  return (
    <TileToolbarButton
      name={name}
      title="Select/Move point"
      onClick={handleClick}
      selected={currentMode === "edit"}
      disabled={!linked}
    >
      <SelectToolIcon/>
    </TileToolbarButton>
  );
});

const AddPointsButton = observer(function({name}: IToolbarButtonComponentProps) {
  const graph = useGraphModelContext();
  const currentMode = graph.editingMode;

  const editableLayers = graph.getEditableLayers();
  const hasEditableLayers = editableLayers.length > 0;

  const iconStyle = { fill: graph.getEditablePointsColor() };

  function handleClick() {
    graph.setEditingMode(currentMode==="add" ? "none" : "add");
  }

  return (
    <TileToolbarButton
      name={name}
      title="Add point"
      onClick={handleClick}
      selected={currentMode==="add"}
      disabled={!hasEditableLayers}
    >
      <AddPointsIcon style={iconStyle} />
    </TileToolbarButton>
  );

});

const DeleteButton = observer(function({name}: IToolbarButtonComponentProps) {
  const graph = useGraphModelContext();
  const disabled = !graph.isAnyCellSelected;

  function handleClick() {
    graph.clearSelectedCellValues();
  }

  return (
    <TileToolbarButton
      name={name}
      title="Delete"
      onClick={handleClick}
      disabled={disabled}
    >
      <DeleteSelectionIcon />
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
  },
  {
    name: 'delete',
    component: DeleteButton
  }

]);
