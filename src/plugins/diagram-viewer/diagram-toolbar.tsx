import classNames from "classnames";
import { observer } from "mobx-react";
import React from "react";
import ReactDOM from "react-dom";
import { Tooltip } from "react-tippy";
import { DragOverlay, useDraggable } from "@dnd-kit/core";
import { DiagramHelper/*, VariableType*/ } from "@concord-consortium/diagram-view";

import { DiagramContentModelType } from "./diagram-content";
import { kNewVariableButtonDraggableId } from "./diagram-types";
import { usePersistentUIStore } from "../../hooks/use-stores";
import { useTooltipOptions } from "../../hooks/use-tooltip-options";
import { ButtonDivider } from "../../components/tiles/toolbar/button-divider";
import { IFloatingToolbarProps, useFloatingToolbarLocation }
  from "../../components/tiles/hooks/use-floating-toolbar-location";

import AddVariableCardIcon from "./src/assets/add-variable-card-icon.svg";
import InsertVariableCardIcon from "./src/assets/insert-variable-card-icon.svg";
import VariableEditorIcon from "../shared-variables/assets/variable-editor-icon.svg";
import ZoomInIcon from "./src/assets/zoom-in-icon.svg";
import ZoomOutIcon from "./src/assets/zoom-out-icon.svg";
import FitViewIcon from "./src/assets/fit-view-icon.svg";
import LockLayoutIcon from "./src/assets/lock-layout-icon.svg";
import UnlockLayoutIcon from "./src/assets/unlock-layout-icon.svg";
import HideNavigatorIcon from "./src/assets/hide-navigator-icon.svg";
import ShowNavigatorIcon from "./src/assets/show-navigator-icon.svg";
import DeleteSelectionIcon from "../../assets/icons/delete/delete-selection-icon.svg";
import "./diagram-toolbar.scss";

/*
 * SvgToolbarButton
 * Taken and modified from drawing-toolbar-buttons.tsx
 */
interface ButtonStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}
interface ISvgToolbarButtonProps {
  SvgIcon: React.FC<React.SVGProps<SVGSVGElement>>;
  buttonClass: string;
  disabled?: boolean;
  selected?: boolean;
  style?: ButtonStyle;
  title: string;
  onClick: () => void;
}
export const SvgToolbarButton: React.FC<ISvgToolbarButtonProps> = ({
  SvgIcon, buttonClass, disabled, selected, style, title, onClick
}) => {
  const tooltipOptions = useTooltipOptions();
  const stroke = style?.stroke || "#000000";
  const fill = style?.fill || "none";
  const strokeWidth = (style && Object.hasOwn(style, "strokeWidth")) ? style.strokeWidth : 2;
  return SvgIcon
    ? <Tooltip title={title} {...tooltipOptions}>
        <button className={classNames("diagram-tool-button", { disabled, selected }, buttonClass)}
            disabled={disabled} onClick={onClick} type="button">
          <SvgIcon fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        </button>
      </Tooltip>
    : null;
};

interface INewVariableButton {
  handleClick: () => void;
  tileId: string;
}
const NewVaribleButton = ({ handleClick, tileId }: INewVariableButton) => {
  const ui = usePersistentUIStore();
  const draggableId = `${kNewVariableButtonDraggableId}-${tileId}`;
  const { attributes, listeners, setNodeRef } = useDraggable({ id: draggableId });

  return (
    <>
      <div ref={setNodeRef} {...attributes} {...listeners} >
        <SvgToolbarButton SvgIcon={AddVariableCardIcon} buttonClass="button-add-variable" title="New Variable"
          onClick={handleClick} />
      </div>
      <DragOverlay>
        { ui.dragId === draggableId.toString()
          ? <AddVariableCardIcon />
          : null }
      </DragOverlay>
    </>
  );
};

interface IInsertVariableButton {
  disabled?: boolean;
  handleClick: () => void;
}
const InsertVariableButton = ({ disabled, handleClick }: IInsertVariableButton) => {
  return (
    <SvgToolbarButton SvgIcon={InsertVariableCardIcon} buttonClass="button-insert-variable" disabled={disabled}
      title="Insert Variable" onClick={handleClick} />
  );
};

interface IEditVariableButton {
  handleClick: () => void;
  selectedVariable?: any; // TODO VariableType Should be VariableType
}
const EditVariableButton = ({ handleClick, selectedVariable }: IEditVariableButton) => {
  return (
    <SvgToolbarButton SvgIcon={VariableEditorIcon} buttonClass="button-edit-variable" disabled={!selectedVariable}
      title="Edit Variable" onClick={handleClick} style={{fill: "#000000", strokeWidth: 0.1}} />
  );
};

interface IZoomControlButton {
  handleClick?: () => void;
}
const doNothing = () => { return undefined; };
const ZoomInButton = ({ handleClick }: IZoomControlButton) => {
  return (
    <SvgToolbarButton SvgIcon={ZoomInIcon} buttonClass="button-zoom-in" title="Zoom In"
      onClick={handleClick || doNothing} />
  );
};
const ZoomOutButton = ({ handleClick }: IZoomControlButton) => {
  return (
    <SvgToolbarButton SvgIcon={ZoomOutIcon} buttonClass="button-zoom-out" title="Zoom Out"
      onClick={handleClick || doNothing} />
  );
};
const FitViewButton = ({ handleClick }: IZoomControlButton) => {
  return (
    <SvgToolbarButton SvgIcon={FitViewIcon} buttonClass="button-fit-view" title="Fit View"
      onClick={handleClick || doNothing} />
  );
};

interface ILockLayoutButton {
  interactionLocked: boolean;
  toggleInteractionLocked: () => void;
}
const LockLayoutButton = ({ interactionLocked, toggleInteractionLocked }: ILockLayoutButton) => {
  return (
    <SvgToolbarButton SvgIcon={interactionLocked ? UnlockLayoutIcon : LockLayoutIcon}
      buttonClass="button-lock-layout" title={interactionLocked ? "Unlock Layout" : "Lock Layout"}
      onClick={toggleInteractionLocked} />
  );
};

interface IHideNavigatorButton {
  hideNavigator: boolean;
  toggleNavigator: () => void;
}
const HideNavigatorButton = ({ hideNavigator, toggleNavigator }: IHideNavigatorButton) => {
  return (
    <SvgToolbarButton SvgIcon={hideNavigator ? ShowNavigatorIcon : HideNavigatorIcon}
      buttonClass="button-hide-navigator" title={hideNavigator ? "Show Navigator" : "Hide Navigator"}
      onClick={toggleNavigator} />
  );
};

interface IDeleteButton {
  handleClick: () => void;
  selectedVariable?: any; // TODO VariableType Should be VariableType
}
const DeleteButton = ({ handleClick, selectedVariable }: IDeleteButton) => {
  return (
    <SvgToolbarButton SvgIcon={DeleteSelectionIcon} buttonClass="button-delete" disabled={!selectedVariable}
      title="Delete" onClick={handleClick} />
  );
};

interface IProps extends IFloatingToolbarProps {
  content: DiagramContentModelType;
  diagramHelper?: DiagramHelper;
  disableInsertVariableButton?: boolean;
  handleDeleteClick: () => void;
  handleEditVariableClick: () => void;
  handleInsertVariableClick: () => void;
  hideNavigator: boolean;
  handleNewVariableClick: () => void;
  interactionLocked: boolean;
  tileId: string;
  toggleInteractionLocked: () => void;
  toggleNavigator: () => void;
}
export const DiagramToolbar: React.FC<IProps> = observer(({
  content, diagramHelper, disableInsertVariableButton, documentContent, handleDeleteClick, handleEditVariableClick,
  handleInsertVariableClick, hideNavigator, handleNewVariableClick, interactionLocked, onIsEnabled, tileId,
  toggleInteractionLocked, toggleNavigator,  ...others
}) => {
  const root = content?.root;
  const selectedVariable = root?.selectedNode?.variable;

  const handleViewportChange = (changeFunction?: () => any) => {
    const updatedViewport = changeFunction?.();
    if (updatedViewport) {
      content.root.setTransform(updatedViewport);
    }
  };

  const enabled = onIsEnabled();
  const location = useFloatingToolbarLocation({
    documentContent,
    toolbarHeight: 34,
    toolbarTopOffset: 2,
    enabled,
    ...others
  });
  return documentContent
    ? ReactDOM.createPortal(
      <div className={`diagram-toolbar ${enabled && location ? "enabled" : "disabled"}`}
          style={location} onMouseDown={e => e.stopPropagation()}>
        <NewVaribleButton handleClick={handleNewVariableClick} tileId={tileId} />
        <InsertVariableButton disabled={disableInsertVariableButton} handleClick={handleInsertVariableClick} />
        <EditVariableButton handleClick={handleEditVariableClick} selectedVariable={selectedVariable} />
        <ButtonDivider />
        <ZoomInButton handleClick={() => handleViewportChange(() => diagramHelper?.zoomIn())} />
        <ZoomOutButton handleClick={() => handleViewportChange(() => diagramHelper?.zoomOut())} />
        <FitViewButton handleClick={() => handleViewportChange(() => diagramHelper?.fitView())} />
        <LockLayoutButton interactionLocked={interactionLocked} toggleInteractionLocked={toggleInteractionLocked} />
        <HideNavigatorButton hideNavigator={hideNavigator} toggleNavigator={toggleNavigator} />
        <ButtonDivider />
        <DeleteButton handleClick={handleDeleteClick} selectedVariable={selectedVariable} />
      </div>, documentContent)
    : null;
});
