import classNames from "classnames";
import React, { useEffect, useState, useRef } from "react";
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
import { useContainerContext } from "../../../components/document/container-context";

import "./drawing-tile.scss";

export interface IDrawingTileProps extends ITileProps {
  overflowVisible?: boolean;
}

const DrawingToolComponent: React.FC<IDrawingTileProps> = observer(function DrawingToolComponent(props) {
  const { tileElt, model, readOnly, onRegisterTileApi, navigatorAllowed = true, overflowVisible } = props;
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
  const showNavigator = navigatorAllowed && contentRef.current.isNavigatorVisible;

  const updateTileVisibleBoundingBox = (bb: BoundingBox) => {
    if (!isEqual(bb, tileVisibleBoundingBox)) {
      setTileVisibleBoundingBox(bb);
    }
  };


  useEffect(() => {
    if (!readOnly) {
      contentRef.current.reset();
    }
    onRegisterTileApi({
      exportContentAsTileJson: (options?: ITileExportOptions) => {
        return contentRef.current.exportJson(options);
      },
      getObjectBoundingBox(objectId, objectType): ObjectBoundingBox | undefined {
        const bbPadding = 5;
        const bb = contentRef.current.getObjectBoundingBox(objectId);
        const zoom = contentRef.current.zoom;
        if (bb) {
          const height = (bb.se.y - bb.nw.y + bbPadding * 2) * zoom;
          const width = (bb.se.x - bb.nw.x + bbPadding * 2) * zoom;
          const left = (bb.nw.x - bbPadding) * zoom + getObjectListPanelWidth();
          const top = (bb.nw.y - bbPadding) * zoom;
          return { height, left, top, width };
        }
        return undefined;
      },
    });
    if (!readOnly) {
      hotKeys.current.register({
        "cmd-c": handleCopy, //allows user to copy image with cmd+c
        "cmd-v": handlePaste, //allows user to paste image with cmd+v
        "delete": handleDelete, // I'm not sure if this will handle "Del" IE 9 and Edge
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
  };

  const getObjectListPanelWidth = () => {
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

  return (
    <DrawingContentModelContext.Provider value={contentRef.current}>
      <BasicEditableTileTitle />
      <div
        ref={drawingToolElement}
        className={classNames("tile-content", "drawing-tool", {
          hovered: props.hovered,
          "read-only": readOnly,
          selected: ui.isSelectedTile(model),
          "overflow-visible": overflowVisible
        })}
        data-testid="drawing-tool"
        tabIndex={0}
        onKeyDown={(e) => hotKeys.current.dispatch(e)}
        onMouseDown={handlePointerDown}
      >
        <DrawingAreaContext.Provider
          value={{ getObjectListPanelWidth, getVisibleCanvasSize, imageUrlToAdd, setImageUrlToAdd }}
        >
          <div data-testid="drawing-toolbar" className="drawing-toolbar-wrapper">
            <TileToolbar tileType="drawing" readOnly={!!readOnly} tileElement={tileElt} />
          </div>
        </DrawingAreaContext.Provider>
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
    </DrawingContentModelContext.Provider>
  );
});

export default DrawingToolComponent;
