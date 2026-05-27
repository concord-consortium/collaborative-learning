import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useClueAccessibility } from "../../../hooks/use-clue-accessibility";
import { HotKeys } from "../../../utilities/hot-keys";
import { TileToolbar } from "../../toolbar/tile-toolbar";
import { IGeometryTileContext, GeometryTileContext } from "./geometry-tile-context";
import { GeometryTileMode } from "./geometry-types";
import { BoundingBox, NavigatorDirection } from "../../../models/tiles/navigatable-tile-model";
import { TileNavigatorContext } from "../hooks/use-tile-navigator-context";
import { TileNavigator } from "../tile-navigator";
import { userSelectTile } from "../../../models/stores/ui";
import { useContainerContext } from "../../document/container-context";
import { getEditableTitleElement } from "../../../utilities/dom-utils";
import { ITileApi } from "../tile-api";
import { selectFocusedGeometryObject } from "./geometry-keyboard-selection";
import {
  announceGeometry, applyA11yAttributes, focusGeometryContentEntry, getOrderedGeometryFocusables,
} from "./geometry-aria-utils";

import "./geometry-toolbar-registration";

import "./geometry-tile.scss";

/**
 * Tab handler for the content slot that walks the semantic order from
 * getOrderedGeometryFocusables instead of DOM order (which JSXGraph paints as
 * "every shape, then every point"). Returns "exit" at the slot boundaries.
 */
function handleContentTab(
  e: KeyboardEvent,
  reverse: boolean,
  tileElt: HTMLElement | null | undefined,
  board: JXG.Board | undefined,
): "handled" | "exit" {
  if (!board || !tileElt) return "exit";
  const active = document.activeElement;
  if (!active) return "exit";

  const svg = tileElt.querySelector<SVGElement>(".geometry-content svg");
  const ordered = getOrderedGeometryFocusables(board);

  if (svg && active === svg) {
    if (reverse) return "exit";
    if (ordered.length === 0) return "exit";
    e.preventDefault();
    ordered[0].focus();
    return "handled";
  }

  const idx = ordered.indexOf(active as HTMLElement);
  if (idx < 0) return "exit";

  if (reverse) {
    if (idx === 0) {
      // Step back to the SVG board (carries the dynamic summary aria-label).
      if (svg) {
        e.preventDefault();
        (svg as unknown as HTMLElement).focus();
        return "handled";
      }
      return "exit";
    }
    e.preventDefault();
    ordered[idx - 1].focus();
    return "handled";
  }

  if (idx === ordered.length - 1) return "exit";
  e.preventDefault();
  ordered[idx + 1].focus();
  return "handled";
}

const GeometryToolComponent: React.FC<IGeometryProps> = observer(function _GeometryToolComponent(props) {
  const {
    model, readOnly, navigatorAllowed = true, hovered, onRegisterTileApi, onUnregisterTileApi, ...others
  } = props;
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

  // HotKeys handlers are registered once at mount, before `board` state is set;
  // read the latest via this ref at dispatch time.
  const boardRef = useRef<JXG.Board>();
  boardRef.current = board;

  // tileAdditionalApi below must be a stable reference per mount — a fresh
  // object each render would re-register the tile API and clobber the focus
  // trap. The proxy delegates here so the impl can update without re-registering.
  const apiImplRef = useRef<Partial<ITileApi>>({});
  const handleSetAdditionalApi = useCallback((api: Partial<ITileApi>) => {
    apiImplRef.current = api;
  }, []);

  const tileAdditionalApi = useMemo<Partial<ITileApi>>(() => ({
    isLinked: () => apiImplRef.current.isLinked?.() ?? false,
    getLinkedTiles: () => apiImplRef.current.getLinkedTiles?.(),
    exportContentAsTileJson: (opts) => apiImplRef.current.exportContentAsTileJson?.(opts) ?? "",
    getObjectBoundingBox: (id, type) => apiImplRef.current.getObjectBoundingBox?.(id, type),
    getObjectButtonSVG: (args) => apiImplRef.current.getObjectButtonSVG?.(args),
  }), []);

  useClueAccessibility(readOnly ? { type: "region" } : {
    type: "tile",
    focusTrap: {
      tileType: "geometry",
      onRegisterTileApi,
      onUnregisterTileApi,
      getTitleElement: () => getEditableTitleElement(tileElt ?? undefined),
      getContentElement: () => tileElt?.querySelector<HTMLElement>(".geometry-content") ?? undefined,
      focusContent: ({ entryMode }) => focusGeometryContentEntry(
        tileElt?.querySelector<HTMLElement>(".geometry-content") ?? undefined,
        entryMode === "reverse",
        boardRef.current,
        content,
      ),
      additionalApi: tileAdditionalApi,
      escapeHandlers: {
        // Intercept Escape while the Color palette is open so it closes the
        // palette and refocuses the Color button instead of exiting the trap.
        // stopPropagation here kills both the toolbar's capture listener and
        // the palette's React bubble listener — so we close + refocus inline.
        toolbar: (e) => {
          if (!content.showColorPalette) return "exit";
          e.stopPropagation();
          e.preventDefault();
          const active = document.activeElement;
          const button = active?.closest?.(".geometry-toolbar")
            ?.querySelector<HTMLButtonElement>("button.toolbar-button.color");
          content.setShowColorPalette(false);
          button?.focus();
          return "handled";
        },
        // While the title input is focused, let EditableTileTitle's bubble-phase
        // onKeyDown cancel the edit instead of exiting the whole tile's trap.
        title: () => {
          const active = document.activeElement;
          if (active?.tagName === "INPUT" && active.closest(".editable-tile-title")) {
            return "handled";
          }
          return "exit";
        },
      },
      tabHandlers: {
        content: (e, reverse) => handleContentTab(e, reverse, tileElt, boardRef.current),
      },
    },
  });

  // Read-only path: register the annotation/export API directly — the
  // type:"region" branch above doesn't touch the tile API.
  useEffect(() => {
    if (readOnly) {
      onRegisterTileApi?.(tileAdditionalApi);
      return () => onUnregisterTileApi?.();
    }
  }, [readOnly, tileAdditionalApi, onRegisterTileApi, onUnregisterTileApi]);

  // HotKeys (Arrow nudge / Delete / Cut / Copy / Paste) attach at tileElt
  // because the focus-trap wrapper isn't a tab stop. Gate on selection.
  useEffect(() => {
    if (!tileElt || readOnly) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!ui.isSelectedTile(modelRef.current)) return;
      // HotKeys.dispatch is typed for React.KeyboardEvent but only reads
      // modifier flags / keyCode / preventDefault — all present on native.
      hotKeys.current.dispatch(e as unknown as React.KeyboardEvent);
    };
    tileElt.addEventListener("keydown", handleKeyDown);
    return () => tileElt.removeEventListener("keydown", handleKeyDown);
  }, [tileElt, readOnly, ui, modelRef]);

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
    const handleSelectFocused = (extend: boolean) => () => {
      const currentBoard = boardRef.current;
      if (!currentBoard) return false;
      const handled = selectFocusedGeometryObject(currentBoard, content, { extend, readOnly });
      if (handled) {
        const focused = document.activeElement as HTMLElement | null;
        const focusedId = focused?.getAttribute("data-object-id");
        const elt = focusedId ? currentBoard.objects[focusedId] : undefined;
        if (focused && elt) {
          // Sync-refresh aria on the focused element so the announce below
          // reads fresh values; the board-wide refresh is rAF-coalesced.
          applyA11yAttributes(elt as JXG.GeometryElement, content, { readOnly });
          const isSelected = focused.getAttribute("aria-pressed") === "true";
          const label = focused.getAttribute("aria-label") ?? "";
          announceGeometry(focused, isSelected ? label : `${label}, Deselected`);
        }
      }
      return handled;
    };
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
      "return": handleSelectFocused(false),
      "shift-return": handleSelectFocused(true),
      "space": handleSelectFocused(false),
      "shift-space": handleSelectFocused(true),
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
        ref={domElement}
        onPointerDownCapture={handlePointerDown}
        onPointerUpCapture={handlePointerUp}
        onMouseDownCapture={handlePointerDown}
        onMouseUpCapture={handlePointerUp} >
        {/* Aria-live region for selection announcements; reached via
            closest('.geometry-tool') > [data-grid-announcer]. */}
        <div
          aria-live="polite"
          aria-atomic="true"
          className="visually-hidden"
          data-grid-announcer=""
        />
        <TileNavigatorContext.Provider value={{ reportVisibleBoundingBox: updateMainTileBoundingBox }}>
          <GeometryContentWrapper model={model} readOnly={readOnly} showAllContent={false} {...others}
            onRegisterTileApi={onRegisterTileApi} onUnregisterTileApi={onUnregisterTileApi}
            onSetAdditionalApi={handleSetAdditionalApi}
            onSetBoard={setBoard} onSetActionHandlers={handleSetHandlers}
            onContentChange={forceUpdate} />
        </TileNavigatorContext.Provider>
        <TileToolbar tileType="geometry" readOnly={!!readOnly} tileElement={tileElt} />
      </div>
      {/* FIXME: It would be best to not render the navigator at all when `showNavigator` is false. This is how
          other tiles that support the navigator work. However, there is currently an issue with the Geometry
          Tile and annotation arrows where if `showNavigator` becomes false, any existing annotations in the
          tile disappear, and new ones can't be added. This may have something to do with multiple JXG boards
          when the navigator is present and includes its own rendering of the geometry content, but we have not
          been able to confirm that yet. As a temporary workaround, the navigator is rendered but with
          visibility:hidden when `showNavigator` is false. */}
      {!readOnly &&
        <TileNavigator
          tileVisibleBoundingBox={mainTileBoundingBox}
          onNavigatorPan={handleNavigatorPan}
          showNavigator={showNavigator}
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
