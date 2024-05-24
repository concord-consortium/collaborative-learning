import classNames from "classnames";
import React, { useEffect, useState, useRef } from "react";
import { ITileProps } from "../../../components/tiles/tile-component";
import { DrawingLayerView } from "./drawing-layer";
import { DrawingContentModelType } from "../model/drawing-content";
import { useCurrent } from "../../../hooks/use-current";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { DrawingContentModelContext } from "./drawing-content-context";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { HotKeys } from "../../../utilities/hot-keys";
import { getClipboardContent, pasteClipboardImage } from "../../../utilities/clipboard-utils";
import "./drawing-tile.scss";
import { ObjectListView } from "./object-list-view";
import { useUIStore } from "../../../hooks/use-stores";
import { hasSelectionModifier } from "../../../utilities/event-utils";
import { TileToolbar } from "../../../components/toolbar/tile-toolbar";

type IProps = ITileProps;

const DrawingToolComponent: React.FC<IProps> = (props) => {
  const { tileElt, model, readOnly, onRegisterTileApi } = props;
  const contentRef = useCurrent(model.content as DrawingContentModelType);
  const [imageUrlToAdd, setImageUrlToAdd] = useState("");
  const [objectListHoveredObject, setObjectListHoveredObject] = useState(null as string|null);
  const hotKeys = useRef(new HotKeys());
  const drawingToolElement = useRef<HTMLDivElement>(null);

  const ui = useUIStore();

  useEffect(() => {
    if (!readOnly) {
      contentRef.current.reset();
    }
    onRegisterTileApi({
      exportContentAsTileJson: (options?: ITileExportOptions) => {
        return contentRef.current.exportJson(options);
      },
      getObjectBoundingBox(objectId, objectType) {
        const bbPadding = 5;
        const object = contentRef.current.objectMap[objectId];
        if (object) {
          const bb = object.boundingBox;
          const height = bb.se.y - bb.nw.y + bbPadding * 2;
          const width = bb.se.x - bb.nw.x + bbPadding * 2;
          const left = bb.nw.x - bbPadding + getObjectListPanelWidth();
          const top = bb.nw.y - bbPadding;
          return { height, left, top, width };
        }
        return undefined;
      },
    });
    if (!readOnly) {
      hotKeys.current.register({
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
        ui.setSelectedTileId(model.id, { append });
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
  }, [model.id, tileElt, ui]);

  const handlePaste = async () => {
    const osClipboardContents = await getClipboardContent();
    if (osClipboardContents) {
      pasteClipboardImage(osClipboardContents, ({ image }) => {
        setImageUrlToAdd(image.contentUrl || '');
      });
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
    ui.setSelectedTileId(model.id, { append });
  };

  const getObjectListPanelWidth = () => {
    if (drawingToolElement.current) {
      const objectListElement = drawingToolElement.current.querySelector<HTMLDivElement>('div.object-list');
      return objectListElement ? objectListElement.offsetWidth : 0;
    } else {
      return 0;
    }
  };

  return (
    <DrawingContentModelContext.Provider value={contentRef.current} >
      <BasicEditableTileTitle />
      <div
        ref={drawingToolElement}
        className={classNames("drawing-tool", { "read-only": readOnly })}
        data-testid="drawing-tool"
        tabIndex={0}
        onKeyDown={(e) => hotKeys.current.dispatch(e)}
        onMouseDown={handlePointerDown}
      >
        <TileToolbar tileType="drawing" readOnly={!!readOnly} tileElement={tileElt} data-testid="drawing-toolbar"/>
        <div className="drawing-container">
          {!readOnly && <ObjectListView model={model} setHoverObject={setObjectListHoveredObject} />}
          <DrawingLayerView
            {...props}
            highlightObject={objectListHoveredObject}
            imageUrlToAdd={imageUrlToAdd}
            setImageUrlToAdd={setImageUrlToAdd}
          />
        </div>
      </div>
    </DrawingContentModelContext.Provider>
  );
};
export default DrawingToolComponent;
