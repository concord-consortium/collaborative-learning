import React, { useContext } from "react";
import { TileToolbarButton } from "../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../components/toolbar/toolbar-button-manager";
import { DrawingContentModelContext } from "./components/drawing-content-context";
import DeleteIcon from "../../assets/icons/delete/delete-selection-icon.svg";
import GroupObjectsIcon from "./assets/group-objects-icon.svg";
import UngroupObjectsIcon from "./assets/ungroup-objects-icon.svg";
import DuplicateIcon from "./assets/duplicate-icon.svg";

import "./drawing-toolbar.scss";

export function GroupButton({ name }: IToolbarButtonComponentProps) {
  const drawingModel = useContext(DrawingContentModelContext);

  function groupSelection() {
    if (drawingModel.selection.length > 1) {
      drawingModel.createGroup(drawingModel.selection);
    }
  }

  return (
    <TileToolbarButton name={name} title={"Group"} onClick={groupSelection}>
      <GroupObjectsIcon />
    </TileToolbarButton>
  );
}

export function UngroupButton({ name }: IToolbarButtonComponentProps) {
  const drawingModel = useContext(DrawingContentModelContext);

  function ungroupSelection() {
    if (drawingModel.selection.length > 0) {
      drawingModel.ungroupGroups(drawingModel.selection);
    }
  }

  return (
    <TileToolbarButton name={name} title={"Ungroup"} onClick={ungroupSelection}>
      <UngroupObjectsIcon />
    </TileToolbarButton>
  );
}

export function DuplicateButton({ name }: IToolbarButtonComponentProps) {
  const drawingModel = useContext(DrawingContentModelContext);

  function duplicateSelection() {
    drawingModel.duplicateObjects(drawingModel.selection);
  }

  return (
    <TileToolbarButton name={name} title={"Duplicate"} onClick={duplicateSelection}>
      <DuplicateIcon />
    </TileToolbarButton>
  );
}

export function DeleteButton({ name }: IToolbarButtonComponentProps) {
  const drawingModel = useContext(DrawingContentModelContext);

  const deleteSelection = () => {
    drawingModel.deleteObjects([...drawingModel.selection]);
  };

  return (
    <TileToolbarButton name={name} title={"Delete"} onClick={deleteSelection}>
      <DeleteIcon />
    </TileToolbarButton>
  );
}
