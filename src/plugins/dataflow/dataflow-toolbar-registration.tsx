import React, { useContext } from "react";
import { observer } from "mobx-react";
import { DataSetLinkButton } from "../../components/toolbar/data-set-link-button";
import { DataSetViewButton } from "../../components/toolbar/data-set-view-button";
import { registerTileToolbarButtons, IToolbarButtonComponentProps }
  from "../../components/toolbar/toolbar-button-manager";
import { TileToolbarButton } from "../../components/toolbar/tile-toolbar-button";
import { TileModelContext } from "../../components/tiles/tile-api";
import { DataflowReteManagerContext } from "./components/dataflow-rete-manager-context";
import { DataflowContentModelType } from "./model/dataflow-content";
import { resetProgramForTile } from "./utilities/device-actions";
import { ConnectDeviceButton } from "./components/toolbar/dataflow-connect-button";
import { ZoomInButton, ZoomOutButton, FitAllButton, PanButton } from "./components/toolbar/dataflow-zoom-pan-buttons";
import { DataflowTableButton, RecordSingleSampleButton } from "./components/toolbar/dataflow-table-buttons";

import DeleteIcon from "../../assets/icons/delete/delete-selection-icon.svg";
import ResetIcon from "./assets/icons/reset-icon.svg";
import GroupIcon from "../drawing/assets/group-objects-icon.svg";
import UngroupIcon from "../drawing/assets/ungroup-objects-icon.svg";

const DeleteNodeButton = observer(function DeleteNodeButton({ name }: IToolbarButtonComponentProps) {
  const reteManager = useContext(DataflowReteManagerContext);
  const selectedIds = reteManager?.getSelectedNodeIds() ?? [];
  const disabled = !reteManager || selectedIds.length === 0;

  function handleClick() {
    reteManager?.deleteSelectedNodes();
  }

  return (
    <TileToolbarButton
      name={name}
      title="Delete"
      onClick={handleClick}
      disabled={disabled}
    >
      <DeleteIcon />
    </TileToolbarButton>
  );
});

// Group 2+ selected blocks into a labeled "super node".
const GroupNodesButton = observer(function GroupNodesButton({ name }: IToolbarButtonComponentProps) {
  const reteManager = useContext(DataflowReteManagerContext);
  const disabled = !reteManager || !reteManager.canGroupSelection();

  function handleClick() {
    reteManager?.groupSelectedNodes();
  }

  return (
    <TileToolbarButton name={name} title="Group" onClick={handleClick} disabled={disabled}>
      <GroupIcon />
    </TileToolbarButton>
  );
});

// Ungroup the group(s) that the current selection belongs to.
const UngroupNodesButton = observer(function UngroupNodesButton({ name }: IToolbarButtonComponentProps) {
  const reteManager = useContext(DataflowReteManagerContext);
  const disabled = !reteManager || reteManager.getSelectedGroupIds().length === 0;

  function handleClick() {
    reteManager?.ungroupSelectedGroups();
  }

  return (
    <TileToolbarButton name={name} title="Ungroup" onClick={handleClick} disabled={disabled}>
      <UngroupIcon />
    </TileToolbarButton>
  );
});

// Resets the tile's program (resetProgramForTile says what that keeps). Disabled for read-only
// views and for the playback manager shown in Done mode, which is constructed read-only.
const ResetProgramButton = observer(function ResetProgramButton({ name }: IToolbarButtonComponentProps) {
  const reteManager = useContext(DataflowReteManagerContext);
  const model = useContext(TileModelContext);
  const disabled = !reteManager || reteManager.readOnly || !model;

  function handleClick() {
    if (!model) return;
    resetProgramForTile({
      content: model.content as DataflowContentModelType, tileId: model.id, trigger: "button"
    });
  }

  return (
    <TileToolbarButton name={name} title="Reset program" onClick={handleClick} disabled={disabled}
        disabledMessage="Reset isn't available while a recording is shown or in a read-only view">
      <ResetIcon />
    </TileToolbarButton>
  );
});

registerTileToolbarButtons('dataflow',
[
  {
    // Immediate view, unchanged and still the shared component. The dataflow toolbar uses it for
    // Graph It; Table It is "table-it" below, so this one is untouched by CLUE-740.
    name: "data-set-view",
    component: DataSetViewButton
  },
  {
    // Dataflow's Table It. Its own name rather than overriding data-set-view, so Graph It keeps
    // the shared behavior and icon. Reuses an already-linked table instead of always adding one,
    // which is what keeps a capture tied to the program it describes.
    name: "table-it",
    component: DataflowTableButton
  },
  {
    name: "record-sample",
    component: RecordSingleSampleButton
  },
  {
    // Dialog-mediated view. Also takes an argument for tile type.
    name: "data-set-link",
    component: DataSetLinkButton
  },
  {
    name: "delete",
    component: DeleteNodeButton
  },
  {
    name: "group",
    component: GroupNodesButton
  },
  {
    name: "ungroup",
    component: UngroupNodesButton
  },
  {
    name: "zoom-in",
    component: ZoomInButton
  },
  {
    name: "zoom-out",
    component: ZoomOutButton
  },
  {
    name: "fit-all",
    component: FitAllButton
  },
  {
    name: "pan",
    component: PanButton
  },
  {
    name: "connect",
    component: ConnectDeviceButton
  },
  {
    name: "reset",
    component: ResetProgramButton
  }
]);
