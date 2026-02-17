import React, { useContext } from "react";
import { observer } from "mobx-react";
import { DataSetLinkButton } from "../../components/toolbar/data-set-link-button";
import { DataSetViewButton } from "../../components/toolbar/data-set-view-button";
import { registerTileToolbarButtons, registerDefaultToolbarTools }
  from "../../components/toolbar/toolbar-button-manager";
import { IToolbarButtonComponentProps } from "../../components/toolbar/toolbar-button-manager";
import { TileToolbarButton } from "../../components/toolbar/tile-toolbar-button";
import { DataflowReteManagerContext } from "./components/dataflow-rete-manager-context";

import DeleteIcon from "../../assets/icons/delete/delete-selection-icon.svg";

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

registerTileToolbarButtons('dataflow',
[
  {
    // Immediate view. Takes an argument saying what kind of tile it should create.
    name: "data-set-view",
    component: DataSetViewButton
  },
  {
    // Dialog-mediated view. Also takes an argument for tile type.
    name: "data-set-link",
    component: DataSetLinkButton
  },
  {
    name: "delete",
    component: DeleteNodeButton
  }
]);

registerDefaultToolbarTools('dataflow', ["delete"]);
