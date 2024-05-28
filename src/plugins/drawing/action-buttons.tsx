import React, { useContext } from "react";
import { observer } from "mobx-react";
import { TileToolbarButton } from "../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../components/toolbar/toolbar-button-manager";
import { DrawingContentModelContext } from "./components/drawing-content-context";
import { OpenPaletteValues } from "./model/drawing-content";
import DeleteIcon from "../../assets/icons/delete/delete-selection-icon.svg";
import GroupObjectsIcon from "./assets/group-objects-icon.svg";
import UngroupObjectsIcon from "./assets/ungroup-objects-icon.svg";
import DuplicateIcon from "./assets/duplicate-icon.svg";
import { isGroupObject } from "./objects/group";

export const GroupButton = observer(({ name }: IToolbarButtonComponentProps) => {
  const drawingModel = useContext(DrawingContentModelContext);
  const enabled = drawingModel.selection.length > 1;

  function groupSelection() {
    drawingModel.setOpenPalette(OpenPaletteValues.None);
    if (drawingModel.selection.length > 1) {
      drawingModel.createGroup(drawingModel.selection);
    }
  }
  return (
    <TileToolbarButton
      name={name} title={"Group"}
      onClick={groupSelection}
      disabled={!enabled}
    >
      <GroupObjectsIcon />
    </TileToolbarButton>
  );
});

export const UngroupButton = observer(({ name }: IToolbarButtonComponentProps) => {
  const drawingModel = useContext(DrawingContentModelContext);
  const disabled = !drawingModel.selection.some((id: string)=> {
    const selectedObj = drawingModel.objectMap[id];
    return selectedObj ? isGroupObject(selectedObj) : false;
  });

  function ungroupSelection() {
    drawingModel.setOpenPalette(OpenPaletteValues.None);
    if (drawingModel.selection.length > 0) {
      drawingModel.ungroupGroups(drawingModel.selection);
    }
  }
  return (
    <TileToolbarButton
      name={name}
      title={"Ungroup"}
      onClick={ungroupSelection}
      disabled={disabled}
    >
      <UngroupObjectsIcon />
    </TileToolbarButton>
  );
});

// Duplicate
export const DuplicateButton = observer(({ name }: IToolbarButtonComponentProps) => {
  const drawingModel = useContext(DrawingContentModelContext);
  const enabled = drawingModel.selection.length > 0;

  function duplicateSelection() {
    drawingModel.setOpenPalette(OpenPaletteValues.None);
    drawingModel.duplicateObjects(drawingModel.selection);
  }

  return (
    <TileToolbarButton
      name={name}
      title={"Duplicate"}
      onClick={duplicateSelection}
      disabled={!enabled}
    >
      <DuplicateIcon />
    </TileToolbarButton>
  );
});

// Delete
export const DeleteButton = observer(({ name }: IToolbarButtonComponentProps) => {
  const drawingModel = useContext(DrawingContentModelContext);
  const enabled = drawingModel.selection.length > 0;

  const deleteSelection = () => {
    drawingModel.setOpenPalette(OpenPaletteValues.None);
    drawingModel.deleteObjects([...drawingModel.selection]);
  };

  return (
    <TileToolbarButton
      name={name}
      title={"Delete"}
      onClick={deleteSelection}
      disabled={!enabled}
    >
      <DeleteIcon />
    </TileToolbarButton>
  );
});
