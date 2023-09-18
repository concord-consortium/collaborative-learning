import { observer } from "mobx-react";
import React from "react";
import { isGroupObject } from "../objects/group";
import { IActionButtonProps, SvgToolbarButton } from "./drawing-toolbar-buttons";
import GroupObjectsIcon from "../assets/group-objects-icon.svg";
import UngroupObjectsIcon from "../assets/ungroup-objects-icon.svg";

export const GroupObjectsButton: React.FC<IActionButtonProps> = observer(function GroupObjectsButton({
  toolbarManager 
}) {
  const onClick = () => {
    toolbarManager.createGroup(toolbarManager.selection);
  };
  // Require at least two objects to group.
  const disabled = toolbarManager.selection.length <= 1;
  return <SvgToolbarButton SvgIcon={GroupObjectsIcon}  buttonClass="group" title="Group"
          onClick={onClick} disabled={disabled} />;
});

export const UngroupObjectsButton: React.FC<IActionButtonProps> = observer(function UngroupObjectsButton({
  toolbarManager
}) {
  const onClick = () => {
    toolbarManager.ungroupGroups(toolbarManager.selection);
  };
  // Enabled if at least one selected object is a group
  const disabled = !toolbarManager.selection.some((id: string)=> {
    const selectedObj = toolbarManager.objectMap[id];
    return selectedObj ? isGroupObject(selectedObj) : false;
  });
  return <SvgToolbarButton SvgIcon={UngroupObjectsIcon}  buttonClass="ungroup" title="Ungroup"
          onClick={onClick} disabled={disabled} />;
});
