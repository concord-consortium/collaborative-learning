import React, { useCallback, useRef, useState } from "react";
import classNames from "classnames";
import { observer } from "mobx-react";
import { isEqual } from "lodash";

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
import { BoundingBox, NavigatorDirection } from "../../../models/tiles/navigatable-tile-model";
import { TileNavigatorContext } from "../hooks/use-tile-navigator-context";
import { TileNavigator } from "../tile-navigator";
import { userSelectTile } from "../../../models/stores/ui";
import { useContainerContext } from "../../document/container-context";

import "./geometry-toolbar-registration";

import "./geometry-tile.scss";

const GeometryToolComponent: React.FC<IGeometryProps> = observer(function _GeometryToolComponent(props) {
  const { model, readOnly, navigatorAllowed = true, hovered, ...others } = props;
  const { tileElt } = others;
  const modelRef = useCurrent(model);
  const containerContext = useContainerContext();
  const domElement = useRef<HTMLDivElement>(null);
  const content = model.content as GeometryContentModelType;
  const ui = useUIStore();
  const showNavigator = ui.isSelectedTile(model) && navigatorAllowed && content.isNavigatorVisible;
  const [board, setBoard] = useState<JXG.Board>();
  const [actionHandlers, setActionHandlers] = useState<IActionHandlers>();
  const [mode, setMode] = useState<GeometryTileMode>("select");
  const hotKeys = useRef(new HotKeys());
  const forceUpdate = useForceUpdate();

  const [mainTileBoundingBox, setMainTileBoundingBox] = useState<BoundingBox|undefined>(undefined);

  const updateMainTileBoundingBox = (bb: BoundingBox) => {
    if (!isEqual(bb, mainTileBoundingBox)) {
      setMainTileBoundingBox(bb);
    }
  };

  const handleNavigatorPan = (direction: NavigatorDirection) => {
    if (!content.board) return;
    const panStep = 50; // number of pixels to move in whichever direction
    switch (direction) {
      case "left":
        content.board.xAxis.panByPixels(-panStep);
        break;
      case "right":
        content.board.xAxis.panByPixels(panStep);
        break;
      case "up":
        content.board.yAxis.panByPixels(panStep);
        break;
      case "down":
        content.board.yAxis.panByPixels(-panStep);
        break;
    }
  };

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

  const [handlePointerDown, handlePointerUp] = useTileSelectionPointerEvents(
    useCallback(() => modelRef.current.id, [modelRef]),
    useCallback(() => ui.selectedTileIds, [ui]),
    useCallback((append: boolean) => userSelectTile(ui, modelRef.current,
      { readOnly, append, container: containerContext.model }),
      [modelRef, ui, containerContext.model, readOnly]),
    domElement
  );

  const classes = classNames("tile-content", "geometry-tool", {
    hovered,
    selected: ui.isSelectedTile(modelRef.current)
  });

  // We must listen for pointer events because we want to get the events before
  // JSXGraph, which appears to listen to pointer events on browsers that support them.
  // We must listen for mouse events because some browsers (notably Safari) don't
  // support pointer events.
  return (
    <GeometryTileContext.Provider value={context}>
      <div
        className={classes}
        data-testid="geometry-tool"
        ref={domElement} tabIndex={0}
        onPointerDownCapture={handlePointerDown}
        onPointerUpCapture={handlePointerUp}
        onMouseDownCapture={handlePointerDown}
        onMouseUpCapture={handlePointerUp}
        onKeyDown={e => hotKeys.current.dispatch(e)} >
        <TileNavigatorContext.Provider value={{ reportVisibleBoundingBox: updateMainTileBoundingBox }}>
          <GeometryContentWrapper model={model} readOnly={readOnly} showAllContent={false} {...others}
            onSetBoard={setBoard} onSetActionHandlers={handleSetHandlers}
            onContentChange={forceUpdate} />
        </TileNavigatorContext.Provider>
        <TileToolbar tileType="geometry" readOnly={!!readOnly} tileElement={tileElt} />
      </div>
      {!readOnly && showNavigator &&
        <TileNavigator
          tileVisibleBoundingBox={mainTileBoundingBox}
          onNavigatorPan={handleNavigatorPan}
          tileProps={props}
          renderTile={(tileProps) =>
            <div className="geometry-tool">
              <GeometryContentWrapper readOnly={true} showAllContent={true} {...tileProps} />
            </div>} />
      }
    </GeometryTileContext.Provider>
  );
});

export default GeometryToolComponent;
