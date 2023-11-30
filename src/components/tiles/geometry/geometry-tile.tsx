import React, { useCallback, useRef, useState } from "react";
import { GeometryContentWrapper } from "./geometry-content-wrapper";
import { IGeometryProps, IActionHandlers } from "./geometry-shared";
import { GeometryToolbar } from "./geometry-toolbar";
import { GeometryContentModelType } from "../../../models/tiles/geometry/geometry-content";
import { useTileSelectionPointerEvents } from "./use-tile-selection-pointer-events";
import { usePersistentUIStore } from "../../../hooks/use-stores";
import { useCurrent } from "../../../hooks/use-current";
import { useForceUpdate } from "../hooks/use-force-update";
import { useToolbarTileApi } from "../hooks/use-toolbar-tile-api";
import { useProviderTileLinking } from "../../../hooks/use-provider-tile-linking";
import { HotKeys } from "../../../utilities/hot-keys";

import "./geometry-tile.sass";

const _GeometryToolComponent: React.FC<IGeometryProps> = ({
  model, readOnly, ...others
}) => {
  const { documentContent, tileElt, scale, onRegisterTileApi, onUnregisterTileApi } = others;
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
    });
    setActionHandlers(handlers);
  };

  const ui = usePersistentUIStore();
  const [handlePointerDown, handlePointerUp] = useTileSelectionPointerEvents(
    useCallback(() => ui.isSelectedTile(modelRef.current), [modelRef, ui]),
    useCallback((append: boolean) => ui.setSelectedTile(modelRef.current, { append }), [modelRef, ui]),
    domElement
  );
  const enabled = !readOnly && !!board && !!actionHandlers;
  const toolbarProps = useToolbarTileApi({ id: model.id, enabled, onRegisterTileApi, onUnregisterTileApi });
  const { isLinkEnabled, showLinkTileDialog } = useProviderTileLinking({ model, readOnly });
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

      <GeometryToolbar documentContent={documentContent} tileElt={tileElt} scale={scale}
        board={board} content={content} handlers={actionHandlers} {...toolbarProps} />
      <GeometryContentWrapper model={model} readOnly={readOnly} {...others}
        onSetBoard={setBoard} onSetActionHandlers={handleSetHandlers}
        onContentChange={forceUpdate} isLinkButtonEnabled={isLinkEnabled} onLinkTileButtonClick={showLinkTileDialog}/>
    </div>
  );
};
const GeometryToolComponent = React.memo(_GeometryToolComponent);
export default GeometryToolComponent;
