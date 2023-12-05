import React, { FunctionComponent, SVGProps, useContext } from "react";
import { observer } from "mobx-react";
import { createPortal } from "react-dom";
import { DragOverlay, useDraggable } from "@dnd-kit/core";
import { TileToolbarButton } from "../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../components/toolbar/toolbar-button-manager";
import { DiagramContentModelType } from "./diagram-content";
import { useDiagramHelperContext } from "./use-diagram-helper-context";
import { TileModelContext } from "../../components/tiles/tile-api";
import { DiagramTileMethodsContext } from "./diagram-tile";
import { useUIStore } from "../../hooks/use-stores";
import { kNewVariableButtonDraggableId } from "./diagram-types";
import { kGraphTileType } from "../graph/graph-defs";
import { useConsumerTileLinking } from "../../hooks/use-consumer-tile-linking";

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
import ViewDataAsGraphIcon from "../../assets/icons/view-data-as-graph-icon.svg";

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

/**
 * Helper component for several buttons that change the viewport.
 */
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

// New variable button is draggable.
export function NewVariableButton({ name }: IToolbarButtonComponentProps) {
  const ui = useUIStore();
  const tile = useContext(TileModelContext);
  const draggableId = `${kNewVariableButtonDraggableId}-${tile?.id}`;
  const { attributes, listeners, setNodeRef } = useDraggable({ id: draggableId });

  const methods = useContext(DiagramTileMethodsContext);

  function handleClick() {
    methods && methods.showDialog(methods.showNewVariableDialog);
  }

  return (
    <>
      <TileToolbarButton name={name} title="New Variable" onClick={handleClick}>
        <div ref={setNodeRef} {...attributes} {...listeners}>
          <AddVariableCardIcon />
        </div>
      </TileToolbarButton>
      {createPortal(
      <DragOverlay>
        {ui.dragId === draggableId.toString()
          ? <AddVariableCardIcon />
          : null}
      </DragOverlay>, document.body)}
    </>
  );

}

export function InsertVariableButton({ name }: IToolbarButtonComponentProps) {
  const methods = useContext(DiagramTileMethodsContext);

  function handleClick() {
    methods && methods.showDialog(methods.showInsertVariableDialog);
  }

  return (
    <TileToolbarButton name={name} title="Add Variable" disabled={!methods?.isUnusedVariableAvailable()}
        onClick={handleClick}>
      <InsertVariableCardIcon/>
    </TileToolbarButton>
  );

}

// Observer since it has to re-render on changes in content (selectedNode)
export const EditVariableButton = observer(function EditVariableButton({ name }: IToolbarButtonComponentProps) {
  const methods = useContext(DiagramTileMethodsContext);
  const tile = useContext(TileModelContext);
  if (!tile) return null;

  const content = tile.content as DiagramContentModelType;
  const selectedVariable = content.root?.selectedNode?.variable;

  function handleClick() {
    methods && methods.showDialog(methods.showEditVariableDialog);
  }

  return (
    <TileToolbarButton name={name} disabled={!selectedVariable} title="Edit Variable" onClick={handleClick}>
      <VariableEditorIcon/>
    </TileToolbarButton>
  );

});

export function LockLayoutButton({ name }: IToolbarButtonComponentProps) {
  const methods = useContext(DiagramTileMethodsContext);
  const locked = methods && methods.isInteractionLocked();
  const title = locked ? "Unlock Layout" : "Lock Layout";

  function handleClick() {
    methods?.toggleInteractionLocked();
  }

  // TODO: not sure if it should be selected when locked
  return (
    <TileToolbarButton name={name} title={title} selected={locked} onClick={handleClick}>
      { locked ? <UnlockLayoutIcon/> : <LockLayoutIcon /> }
    </TileToolbarButton>
  );

}

export function HideNavigatorButton({ name }: IToolbarButtonComponentProps) {
  const methods = useContext(DiagramTileMethodsContext);
  const hidden = methods && methods.isNavigatorHidden();
  const title = hidden ? "Show Navigator" : "Hide Navigator";
  function handleClick() {
    methods?.toggleNavigatorHidden();
  }

  // TODO not sure if should be selected when hidden
  return (
    <TileToolbarButton name={name} title={title} selected={hidden} onClick={handleClick}>
      { hidden ? <ShowNavigatorIcon/> : <HideNavigatorIcon /> }
    </TileToolbarButton>
  );

}

export const DeleteButton = observer(function DeleteButton({ name }: IToolbarButtonComponentProps) {
  const tile = useContext(TileModelContext);
  if (!tile) return null;

  const content = tile.content as DiagramContentModelType;
  const selectedVariable = content.root?.selectedNode?.variable;

  function handleClick() {
    const selectedNode = content.root.selectedNode;
    if (selectedNode) {
      content.root.removeNode(selectedNode);
    }
  }

  return (
    <TileToolbarButton name={name} disabled={!selectedVariable} title="Delete" onClick={handleClick}>
      <DeleteSelectionIcon />
    </TileToolbarButton>
  );

});

export const LinkGraphButton = observer(function LinkGraphButton({name}: IToolbarButtonComponentProps) {
  const model = useContext(TileModelContext)!;

  const hasLinkableRows = true; // TODO

  const { isLinkEnabled, showLinkTileDialog }
  = useConsumerTileLinking({ model, hasLinkableRows, onlyType: kGraphTileType });

  const handleClick = (e: React.MouseEvent) => {
    showLinkTileDialog && showLinkTileDialog();
    e.stopPropagation();
  };

  return (
    <TileToolbarButton
      name={name}
      title="View data as graph"
      onClick={handleClick}
      disabled={!isLinkEnabled}
    >
      <ViewDataAsGraphIcon />
    </TileToolbarButton>
 );

});
