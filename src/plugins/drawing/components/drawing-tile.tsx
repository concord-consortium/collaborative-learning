import classNames from "classnames";
import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { observer } from "mobx-react";
import { getSnapshot } from "@concord-consortium/mobx-state-tree";
import { isEqual } from "lodash";

import { ITileProps } from "../../../components/tiles/tile-component";
import { DrawingLayerView } from "./drawing-layer";
import { DrawingContentModelType } from "../model/drawing-content";
import { DrawingObjectMSTUnion } from "./drawing-object-manager";
import { DrawingObjectType } from "../objects/drawing-object";
import { useCurrent } from "../../../hooks/use-current";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { DrawingContentModelContext } from "./drawing-content-context";
import { DrawingToolbarContext, IDrawingToolbarContext } from "./drawing-toolbar-context";
import { TitleTextInserter } from "../../../components/tiles/editable-tile-title";
import { useFunctionState } from "../../../hooks/use-function-state";
import { DrawingAreaContext } from "./drawing-area-context";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { HotKeys } from "../../../utilities/hot-keys";
import { getClipboardContent, pasteClipboardImage } from "../../../utilities/clipboard-utils";
import { ObjectListView } from "./object-list-view";
import { useStores } from "../../../hooks/use-stores";
import { hasSelectionModifier } from "../../../utilities/event-utils";
import { TileToolbar } from "../../../components/toolbar/tile-toolbar";
import { TileNavigator } from "../../../components/tiles/tile-navigator";
import { NavigatorDirection } from "../../../models/tiles/navigatable-tile-model";
import { BoundingBox } from "../model/drawing-basic-types";
import { TileNavigatorContext } from "../../../components/tiles/hooks/use-tile-navigator-context";
import { ObjectBoundingBox } from "../../../models/annotations/clue-object";
import { kClosedObjectListPanelWidth, kOpenObjectListPanelWidth } from "../model/drawing-types";
import { userSelectTile } from "../../../models/stores/ui";
import { VoiceTypingOverlay } from "../../../utilities/voice-typing-overlay";
import { useContainerContext } from "../../../components/document/container-context";
import { calculateFitContent } from "../model/drawing-utils";
import { useClueAccessibility } from "../../../hooks/use-clue-accessibility";
import { getEditableTitleElement, getVisibleFocusables } from "../../../utilities/dom-utils";

import "./drawing-tile.scss";

export interface IDrawingTileProps extends ITileProps {
  overflowVisible?: boolean;
}

const DrawingToolComponent: React.FC<IDrawingTileProps> = observer(function DrawingToolComponent(props) {
  const { tileElt, model, readOnly, onRegisterTileApi, onUnregisterTileApi,
    navigatorAllowed = true, overflowVisible } = props;
  const contentModel = model.content as DrawingContentModelType;
  const contentRef = useCurrent(contentModel);
  const containerContext = useContainerContext();
  const drawingToolElement = useRef<HTMLDivElement>(null);
  const hotKeys = useRef(new HotKeys());
  const [imageUrlToAdd, setImageUrlToAdd] = useState("");
  const [tileVisibleBoundingBox, setTileVisibleBoundingBox] = useState<BoundingBox|undefined>(undefined);
  const [objectListHoveredObject, setObjectListHoveredObject] = useState(null as string|null);
  const stores = useStores();
  const { clipboard, ui } = stores;
  const showNavigator = ui.isSelectedTile(model) &&
                        navigatorAllowed &&
                        contentRef.current.isNavigatorVisible;

  const [voiceTypingActive, setVoiceTypingActive] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleTextInserter, setTitleTextInserter] = useFunctionState<TitleTextInserter>();
  const commitInterimTextRef = useRef<(() => void) | null>(null);

  const drawingToolbarContext = useMemo<IDrawingToolbarContext>(() => ({
    voiceTypingActive,
    setVoiceTypingActive,
    interimText,
    setInterimText,
    titleEditing,
    setTitleEditing,
    titleTextInserter,
    setTitleTextInserter,
    commitInterimTextRef,
  }), [voiceTypingActive, interimText, titleEditing, titleTextInserter, setTitleTextInserter]);

  const updateTileVisibleBoundingBox = (bb: BoundingBox) => {
    if (!isEqual(bb, tileVisibleBoundingBox)) {
      setTileVisibleBoundingBox(bb);
    }
  };


  const tileAdditionalApi = useMemo(() => ({
    exportContentAsTileJson: (options?: ITileExportOptions) => {
      return contentRef.current.exportJson(options);
    },
    getViewTransform: () => {
      if (readOnly) {
        const canvasSize = getVisibleCanvasSize();
        const contentBoundingBox = contentRef.current.objectsBoundingBox;
        if (canvasSize && contentBoundingBox) {
          const fitResult = calculateFitContent({
            canvasSize, contentBoundingBox, minZoom: 0.1, maxZoom: 1
          });
          return { offsetX: fitResult.offsetX, offsetY: fitResult.offsetY, zoom: fitResult.zoom };
        }
      }
      return undefined;
    },
    getObjectBoundingBox(objectId: string, _objectType?: string): ObjectBoundingBox | undefined {
      const bbPadding = 5;
      const bb = contentRef.current.getObjectBoundingBox(objectId);
      if (bb) {
        const baseHeight = bb.se.y - bb.nw.y + bbPadding * 2;
        const baseWidth = bb.se.x - bb.nw.x + bbPadding * 2;
        const baseLeft = bb.nw.x - bbPadding;
        const baseTop = bb.nw.y - bbPadding;
        let height, width, left, top;
        if (readOnly) {
          height = baseHeight; width = baseWidth; left = baseLeft; top = baseTop;
        } else {
          const zoom = contentRef.current.zoom;
          const oX = contentRef.current.offsetX;
          const oY = contentRef.current.offsetY;
          height = baseHeight * zoom; width = baseWidth * zoom;
          left = baseLeft * zoom + oX + getObjectListPanelWidth();
          top = baseTop * zoom + oY;
        }
        return { height, left, top, width };
      }
      return undefined;
    },
    getTileDimensions: () => {
      if (drawingToolElement.current) {
        const { width, height } = drawingToolElement.current.getBoundingClientRect();
        return { width, height };
      }
      return { width: 0, height: 0 };
    },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useClueAccessibility(readOnly ? {
    type: "region",
  } : {
    type: "tile",
    focusTrap: {
      onRegisterTileApi,
      onUnregisterTileApi,
      tileType: "drawing",
      getTitleElement: () => {
        const tile = drawingToolElement.current?.closest('.tool-tile') as HTMLElement | null;
        return getEditableTitleElement(tile);
      },
      getContentElement: () => drawingToolElement.current ?? undefined,
      focusContent: () => {
        const container = drawingToolElement.current;
        if (!container) return false;
        const focusables = getVisibleFocusables(container);
        if (focusables.length > 0) {
          focusables[0].focus();
          return document.activeElement === focusables[0];
        }
        return false;
      },
      additionalApi: tileAdditionalApi,
    },
  });

  // Read-only instances register API for export/bounding box, but only when no editable
  // sibling exists (to avoid clobbering the editable instance's focus trap registration).
  useEffect(() => {
    if (readOnly) {
      const editableSibling = document.querySelector(
        `.tool-tile.drawing-tool-tile:not(.readonly)[data-tool-id="${model.id}"]`
      );
      if (!editableSibling) {
        onRegisterTileApi(tileAdditionalApi);
        return () => onUnregisterTileApi();
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!readOnly) {
      contentRef.current.reset();
    }
    if (!readOnly) {
      hotKeys.current.register({
        "cmd-c": handleCopy,
        "cmd-v": handlePaste,
        "delete": handleDelete,
        "backspace": handleDelete,
        "cmd-g": handleGroup,
        "cmd-shift-g": handleUngroup
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {

    const handleTilePointerDown = (e: MouseEvent | TouchEvent) => {
      // This handler gets attached to the outer Tile element (our parent).
      // It handles the literal "edge" case - where you've clicked the Tile element
      // but not inside the DrawingTile element.
      // I don't know if this ever happens in real life, but it does happen in Cypress.
      if (e.currentTarget === e.target) {
        const append = hasSelectionModifier(e);
        userSelectTile(ui, model, { readOnly, append, container: containerContext.model });
      }
    };

    if (tileElt) {
      tileElt.addEventListener("mousedown", handleTilePointerDown);
      tileElt.addEventListener("touchstart", handleTilePointerDown);
      return (() => {
        tileElt.removeEventListener("mousedown", handleTilePointerDown);
        tileElt.removeEventListener("touchstart", handleTilePointerDown);
      });
    }
  }, [tileElt, ui, containerContext.model, model, readOnly]);

  // copy to clipboard
  const handleCopy = () => {
    const content = contentRef.current;
    const objects = content.getSelectedObjects();
    if (objects && content.metadata) {
      const clipObjects = objects.map(obj => getSnapshot(obj));
      clipboard.clear();
      clipboard.addTileContent(content.metadata.id, content.type, clipObjects, stores);
    }
  };

  // paste from clipboard
  const handlePaste = async () => {
    const osClipboardContents = await getClipboardContent();
    if (osClipboardContents) {
      pasteClipboardImage(osClipboardContents, ({ image }) => {
        setImageUrlToAdd(image.contentUrl || '');
      });
    }

    const content = contentRef.current;
    const objects: DrawingObjectType[] = clipboard.getTileContent(content.type);
    if (content.metadata && !readOnly && objects?.length) {
      const kPixelOffset = 30;
      // check if there are objects copied from other drawing tiles
      const newObjects = objects.filter(object => !content.objectMap[object.id]);
      newObjects.forEach(obj => {
        const { id, ...objWithoutId } = obj;
        const newObj = DrawingObjectMSTUnion.create(objWithoutId);
        content.addObject(getSnapshot(newObj));
      });
      // duplicate objects that are already in the content
      const duplicateObjectIds = objects.filter(object => content.objectMap[object.id]).map(obj => obj.id);
      content.duplicateObjects(duplicateObjectIds, {x: kPixelOffset, y: kPixelOffset});
    }
  };

  const handleDelete = () => {
    contentRef.current.deleteObjects([...contentRef.current.selection]);
  };

  const handleGroup = () => {
    const content = contentRef.current;
    if (content.selection.length > 1) {
      content.createGroup(content.selection);
    }
    return true; // true return means 'prevent default action'
  };

  const handleUngroup = () => {
    const content = contentRef.current;
    if (content.selection.length > 0) {
      content.ungroupGroups(content.selection);
    }
    return true; // true return means 'prevent default action'
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    // Follows standard rules for clicking on tiles - with Cmd/Shift click,
    // adds or removes this tile from list of selected tiles. Without, just selects it.
    // Unlike default implementation in tile-component, does not capture events, so
    // we can avoid this getting called with stopPropagation().
    // When user clicks on specific objects, we handle those events locally
    // and don't allow the events to bubble up to this handler.
    const append = hasSelectionModifier(e);
    userSelectTile(ui, model, { readOnly, append, container: containerContext.model });
    // Redirect focus to the tile container so Tab enters the focus trap
    // (title first) rather than cycling within it. Object clicks don't reach
    // this handler — they're stopped by the drawing layer's stopPropagation.
    requestAnimationFrame(() => {
      const tileContainer = drawingToolElement.current?.closest('.tool-tile') as HTMLElement | null;
      tileContainer?.focus();
    });
  };

  const getObjectListPanelWidth = () => {
    if (readOnly) return 0;
    return contentRef.current.listViewOpen ? kOpenObjectListPanelWidth : kClosedObjectListPanelWidth;
  };

  const getVisibleCanvasSize = () => {
    if (!drawingToolElement.current
      || !drawingToolElement.current.clientWidth
      || !drawingToolElement.current.clientHeight) return undefined;
    return {
      x: drawingToolElement.current.clientWidth-getObjectListPanelWidth(),
      y: drawingToolElement.current.clientHeight
    };
  };

  const handleNavigatorPan = (direction: NavigatorDirection) => {
    const currOffsetX = contentModel.offsetX;
    const currOffsetY = contentModel.offsetY;
    const moveStep = 50;
    let newX = currOffsetX;
    let newY = currOffsetY;

    switch (direction) {
      case "up":
        newY = currOffsetY + moveStep;
        break;
      case "down":
        newY = currOffsetY - moveStep;
        break;
      case "left":
        newX = currOffsetX + moveStep;
        break;
      case "right":
        newX = currOffsetX - moveStep;
        break;
    }

    contentModel.setOffset(newX, newY);
  };

  const handleRegisterTextInserter = useCallback((inserter: TitleTextInserter | null) => {
    setTitleTextInserter(inserter);
  }, [setTitleTextInserter]);

  return (
    <DrawingContentModelContext.Provider value={contentRef.current}>
      <DrawingToolbarContext.Provider value={drawingToolbarContext}>
      <BasicEditableTileTitle
        className={voiceTypingActive && titleEditing ? "voice-typing-active" : undefined}
        onBeginEdit={() => setTitleEditing(true)}
        onEndEdit={() => setTitleEditing(false)}
        onBeforeClose={() => commitInterimTextRef.current?.()}
        onRegisterTextInserter={handleRegisterTextInserter}
      />
      <div
        ref={drawingToolElement}
        className={classNames("tile-content", "drawing-tool", {
          hovered: props.hovered,
          "read-only": readOnly,
          selected: ui.isSelectedTile(model),
          "overflow-visible": overflowVisible
        })}
        data-testid="drawing-tool"
        tabIndex={-1}
        onKeyDown={(e) => {
          const focusedEl = document.activeElement as HTMLElement;
          const focusedObjectId = focusedEl?.closest('.transformable[data-object-id]')
            ?.getAttribute('data-object-id');

          // Enter/Space on a focused object: select it (or edit if text and already selected)
          if ((e.key === "Enter" || e.key === " ") && focusedObjectId && !readOnly) {
            e.preventDefault();
            const obj = contentModel.objectMap[focusedObjectId];
            if (obj) {
              if (contentModel.isIdSelected(focusedObjectId) && obj.type === "text") {
                (obj as any).setEditing?.(true);
              } else {
                contentModel.setSelectedIds([focusedObjectId]);
              }
            }
            return;
          }

          hotKeys.current.dispatch(e);
        }}
        onMouseDown={handlePointerDown}
      >
        <DrawingAreaContext.Provider
          value={{ getObjectListPanelWidth, getVisibleCanvasSize, imageUrlToAdd, setImageUrlToAdd }}
        >
          <div data-testid="drawing-toolbar" className="drawing-toolbar-wrapper">
            <TileToolbar tileType="drawing" readOnly={!!readOnly} tileElement={tileElt} />
          </div>
          <div className="drawing-container">
            {!readOnly && <ObjectListView model={model} setHoverObject={setObjectListHoveredObject} />}
            <TileNavigatorContext.Provider value={{ reportVisibleBoundingBox: updateTileVisibleBoundingBox }}>
              <DrawingLayerView
                {...props}
                highlightObject={objectListHoveredObject}
                imageUrlToAdd={imageUrlToAdd}
                setImageUrlToAdd={setImageUrlToAdd}
              />
            </TileNavigatorContext.Provider>
          </div>
        </DrawingAreaContext.Provider>
        <VoiceTypingOverlay text={interimText} tileElement={drawingToolElement.current} />
      </div>
      {!readOnly && showNavigator &&
        <TileNavigator
          tileVisibleBoundingBox={tileVisibleBoundingBox}
          onNavigatorPan={handleNavigatorPan}
          tileProps={props}
          renderTile={(tileProps) =>
            <div className="drawing-tool read-only">
              <div className="drawing-container">
                <DrawingLayerView {...tileProps} />
              </div>
            </div>}
        />
      }
      </DrawingToolbarContext.Provider>
    </DrawingContentModelContext.Provider>
  );
});

export default DrawingToolComponent;
