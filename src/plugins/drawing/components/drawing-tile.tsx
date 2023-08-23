import classNames from "classnames";
import React, { useEffect, useState, useRef } from "react";
import { ITileProps } from "../../../components/tiles/tile-component";
import { ToolbarView } from "./drawing-toolbar";
import { DrawingLayerView } from "./drawing-layer";
import { useToolbarTileApi } from "../../../components/tiles/hooks/use-toolbar-tile-api";
import { DrawingContentModelType } from "../model/drawing-content";
import { useCurrent } from "../../../hooks/use-current";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { DrawingContentModelContext } from "./drawing-content-context";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { HotKeys } from "../../../utilities/hot-keys";
import { getClipboardContent, pasteClipboardImage } from "../../../utilities/clipboard-utils";
import "./drawing-tile.scss";

type IProps = ITileProps;

const DrawingToolComponent: React.FC<IProps> = (props) => {
  const { documentContent, tileElt, model, readOnly, scale, onRegisterTileApi, onUnregisterTileApi } = props;
  const contentRef = useCurrent(model.content as DrawingContentModelType);
  const [imageUrlToAdd, setImageUrlToAdd] = useState("");
  const hotKeys = useRef(new HotKeys());
  const drawingToolElement = useRef<HTMLDivElement>(null);

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
          const left = bb.nw.x - bbPadding;
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
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const toolbarProps = useToolbarTileApi({ id: model.id, enabled: !readOnly, onRegisterTileApi, onUnregisterTileApi });

  const getVisibleCanvasSize = () => {
    if (!drawingToolElement.current || !drawingToolElement.current.clientWidth || !drawingToolElement.current.clientHeight) return undefined;
    return { x: drawingToolElement.current.clientWidth, y: drawingToolElement.current.clientHeight };
  }

  return (
    <DrawingContentModelContext.Provider value={contentRef.current} >
      <BasicEditableTileTitle
        model={model}
        readOnly={readOnly}
        scale={scale}
      />
      <div
        ref={drawingToolElement}
        className={classNames("drawing-tool", { "read-only": readOnly })}
        data-testid="drawing-tool"
        tabIndex={0}
        onKeyDown={(e) => hotKeys.current.dispatch(e)}
      >
        <ToolbarView
          model={model}
          documentContent={documentContent}
          tileElt={tileElt}
          scale={scale}
          setImageUrlToAdd={setImageUrlToAdd}
          getVisibleCanvasSize={getVisibleCanvasSize}
          {...toolbarProps}
        />
        <DrawingLayerView
          {...props}
          imageUrlToAdd={imageUrlToAdd}
          setImageUrlToAdd={setImageUrlToAdd}
        />
      </div>
    </DrawingContentModelContext.Provider>
  );
};
export default DrawingToolComponent;
