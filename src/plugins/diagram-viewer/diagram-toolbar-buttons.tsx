import React, { FunctionComponent, SVGProps, useContext } from "react";
import { TileToolbarButton } from "../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../components/toolbar/toolbar-button-manager";
import { DiagramContentModelType } from "./diagram-content";
import { useDiagramHelperContext } from "./use-diagram-helper-context";
import { TileModelContext } from "../../components/tiles/tile-api";

import ZoomInIcon from "./src/assets/zoom-in-icon.svg";
import ZoomOutIcon from "./src/assets/zoom-out-icon.svg";
import FitViewIcon from "./src/assets/fit-view-icon.svg";
// import AddVariableCardIcon from "./src/assets/add-variable-card-icon.svg";
// import InsertVariableCardIcon from "./src/assets/insert-variable-card-icon.svg";
// import VariableEditorIcon from "../shared-variables/assets/variable-editor-icon.svg";
// import LockLayoutIcon from "./src/assets/lock-layout-icon.svg";
// import UnlockLayoutIcon from "./src/assets/unlock-layout-icon.svg";
// import HideNavigatorIcon from "./src/assets/hide-navigator-icon.svg";
// import ShowNavigatorIcon from "./src/assets/show-navigator-icon.svg";
// import DeleteSelectionIcon from "../../assets/icons/delete/delete-selection-icon.svg";

import "./diagram-toolbar.scss";

function handleViewportChange(content: DiagramContentModelType, changeFunction: () => any) {
  const updatedViewport = changeFunction?.();
  if (updatedViewport) {
    content.root.setTransform(updatedViewport);
  }
}

interface IChangeViewportToolbarButtonProps {
  name: string;
  title: string;
  Icon: FunctionComponent<SVGProps<SVGSVGElement>>;
  onClick: ()=>any;
}

function ChangeViewportToolbarButton({name, title, Icon, onClick}: IChangeViewportToolbarButtonProps) {
  const tile = useContext(TileModelContext);
  if (!tile) return null;

  const content = tile.content as DiagramContentModelType;

  function handleClick() {
    handleViewportChange(content, onClick);
  }

  return (
    <TileToolbarButton name={name} title={title} selected={false} onClick={handleClick}>
      <Icon />
    </TileToolbarButton>
  );
}

export function ZoomInToolbarButton({ name }: IToolbarButtonComponentProps) {
  const diagramHelper = useDiagramHelperContext();
  return (
    <ChangeViewportToolbarButton name={name} title="Zoom In" Icon={ZoomInIcon}
      onClick={() => diagramHelper?.zoomIn()} />);
}

export function ZoomOutToolbarButton({ name }: IToolbarButtonComponentProps) {
  const diagramHelper = useDiagramHelperContext();
  return (
    <ChangeViewportToolbarButton name={name} title="Zoom Out" Icon={ZoomOutIcon}
      onClick={() => diagramHelper?.zoomOut()} />);
}

export function FitViewToolbarButton({ name }: IToolbarButtonComponentProps) {
  const diagramHelper = useDiagramHelperContext();
  return (
    <ChangeViewportToolbarButton name={name} title="Fit View" Icon={FitViewIcon}
      onClick={() => diagramHelper?.fitView()} />);
}
