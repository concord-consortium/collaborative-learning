import React, { useCallback, useRef, useState } from "react";
import { GeometryContentWrapper } from "./geometry-content-wrapper";
import { IGeometryProps, IActionHandlers } from "./geometry-shared";
import { GeometryContentModelType } from "../../../models/tiles/geometry/geometry-content";
import { useTileSelectionPointerEvents } from "./use-tile-selection-pointer-events";
import { useUIStore } from "../../../hooks/use-stores";
import { useCurrent } from "../../../hooks/use-current";
import { useForceUpdate } from "../hooks/use-force-update";
import { HotKeys } from "../../../utilities/hot-keys";
import { TileToolbar } from "../../toolbar/tile-toolbar";
import { IGeometryTileContext, GeometryTileContext } from "./geometry-tile-context";
import { GeometryTileMode } from "./geometry-types";

import "./geometry-toolbar-registration";

import "./geometry-tile.scss";

const _GeometryToolComponent: React.FC<IGeometryProps> = ({
  model, readOnly, ...others
}) => {
  const { tileElt } = others;
  const modelRef = useCurrent(model);
  const domElement = useRef<HTMLDivElement>(null);
  const content = model.content as GeometryContentModelType;
  const [board, setBoard] = useState<JXG.Board>();
  const [actionHandlers, setActionHandlers] = useState<IActionHandlers>();
  const [mode, setMode] = useState<GeometryTileMode>("select");
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
    });
    setActionHandlers(handlers);
  };

  const context: IGeometryTileContext = {
    mode,
    setMode,
    content,
    board,
    handlers: actionHandlers
  };

  const ui = useUIStore();
  const [handlePointerDown, handlePointerUp] = useTileSelectionPointerEvents(
    useCallback(() => ui.isSelectedTile(modelRef.current), [modelRef, ui]),
    useCallback((append: boolean) => ui.setSelectedTile(modelRef.current, { append }), [modelRef, ui]),
    domElement
  );

  // We must listen for pointer events because we want to get the events before
  // JSXGraph, which appears to listen to pointer events on browsers that support them.
  // We must listen for mouse events because some browsers (notably Safari) don't
  // support pointer events.
  return (
    <GeometryTileContext.Provider value={context}>
      <div className="geometry-tool" ref={domElement} tabIndex={0}
        onPointerDownCapture={handlePointerDown}
        onPointerUpCapture={handlePointerUp}
        onMouseDownCapture={handlePointerDown}
        onMouseUpCapture={handlePointerUp}
        onKeyDown={e => hotKeys.current.dispatch(e)} >
        <GeometryContentWrapper model={model} readOnly={readOnly} {...others}
          onSetBoard={setBoard} onSetActionHandlers={handleSetHandlers}
          onContentChange={forceUpdate} />
        <TileToolbar tileType="geometry" readOnly={!!readOnly} tileElement={tileElt} />
      </div>
    </GeometryTileContext.Provider>
  );
};

const GeometryToolComponent = React.memo(_GeometryToolComponent);
export default GeometryToolComponent;
