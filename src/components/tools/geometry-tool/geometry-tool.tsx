import React, { useCallback, useRef, useState } from "react";
import { GeometryContentWrapper } from "./geometry-content-wrapper";
import { IGeometryProps, IActionHandlers } from "./geometry-shared";
import { GeometryToolbar } from "./geometry-toolbar";
import { GeometryContentModelType } from "../../../models/tools/geometry/geometry-content";
import { useTileSelectionPointerEvents } from "./use-tile-selection-pointer-events";
import { useUIStore } from "../../../hooks/use-stores";
import { useCurrent } from "../../../hooks/use-current";
import { useForceUpdate } from "../hooks/use-force-update";
import { useToolbarToolApi } from "../hooks/use-toolbar-tool-api";
import { useTableLinking } from "./use-table-linking";
import { HotKeys } from "../../../utilities/hot-keys";

import "./geometry-tool.sass";

const GeometryToolComponent: React.FC<IGeometryProps> = ({
  model, readOnly, ...others
}) => {
  const { documentId, documentContent, toolTile, scale, onRequestTilesOfType,
    onRegisterToolApi, onUnregisterToolApi } = others;
  const modelRef = useCurrent(model);
  const domElement = useRef<HTMLDivElement>(null);
  const content = model.content as GeometryContentModelType;
  const [board, setBoard] = useState<JXG.Board>();
  const [actionHandlers, setActionHandlers] = useState<IActionHandlers>();
  const hotKeys = useRef(new HotKeys());
  const forceUpdate = useForceUpdate();

  const handleSetHandlers = (handlers: IActionHandlers) => {
    hotKeys.current.register({
      "left": handlers.handleArrows,
      "up": handlers.handleArrows,
      "right": handlers.handleArrows,
      "down":  handlers.handleArrows,
      "backspace": handlers.handleDelete,
      "delete": handlers.handleDelete,
      "cmd-c": handlers.handleCopy,
      "cmd-x": handlers.handleCut,
      "cmd-v": handlers.handlePaste,
      "cmd-z": handlers.handleUndo,
      "cmd-shift-z": handlers.handleRedo,
    });
    setActionHandlers(handlers);
  };

  const ui = useUIStore();
  const [handlePointerDown, handlePointerUp] = useTileSelectionPointerEvents(
    useCallback(() => ui.isSelectedTile(modelRef.current), [modelRef, ui]),
    useCallback((append: boolean) => ui.setSelectedTile(modelRef.current, { append }), [modelRef, ui]),
    domElement
  );

  const onUnlinkTableTile = useCallback(() => {
    console.log("unlink table");
  },[]);
  const enabled = !readOnly && !!board && !!actionHandlers;
  const toolbarProps = useToolbarToolApi({ id: model.id, enabled, onRegisterToolApi, onUnregisterToolApi });
  const { showLinkTableDialog } =
    useTableLinking({ documentId, model,
                        onRequestTilesOfType, actionHandlers, onUnlinkTableTile });

  // We must listen for pointer events because we want to get the events before
  // JSXGraph, which appears to listen to pointer events on browsers that support them.
  // We must listen for mouse events because some browsers (notably Safari) don't
  // support pointer events.
  return (
    <div className="geometry-tool" ref={domElement} tabIndex={0}
          onPointerDownCapture={handlePointerDown}
          onPointerUpCapture={handlePointerUp}
          onMouseDownCapture={handlePointerDown}
          onMouseUpCapture={handlePointerUp}
          onKeyDown={e => hotKeys.current.dispatch(e)} >

      <GeometryToolbar documentContent={documentContent} toolTile={toolTile} scale={scale}
        board={board} content={content} handlers={actionHandlers} {...toolbarProps} />
      <GeometryContentWrapper model={model} readOnly={readOnly} {...others}
        onSetBoard={setBoard} onSetActionHandlers={handleSetHandlers}
        onContentChange={forceUpdate} onLinkTableButtonClick={showLinkTableDialog}/>
    </div>
  );
};
(GeometryToolComponent as any).getDragImageNode = (dragTargetNode: HTMLElement) => {
  // dragTargetNode is the tool-tile div
  const geometryElts = dragTargetNode.getElementsByClassName("geometry-content");
  const geometryElt = geometryElts?.[0];
  // geometryElt's firstChild is the actual SVG, which works as a drag image
  return geometryElt?.firstChild;
};
export default GeometryToolComponent;
