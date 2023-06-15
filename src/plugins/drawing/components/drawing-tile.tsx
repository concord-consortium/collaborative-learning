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
import { ToolTitleArea } from "../../../components/tiles/tile-title-area";
import { EditableTileTitle } from "../../../components/tiles/editable-tile-title";
import { measureText } from "../../../components/tiles/hooks/use-measure-text";
import { defaultTileTitleFont } from "../../../components/constants";
import { HotKeys } from "../../../utilities/hot-keys";
import { getClipboardContent, pasteClipboardImage } from "../../../utilities/clipboard-utils";
import "./drawing-tile.scss";

type IProps = ITileProps;

const DrawingToolComponent: React.FC<IProps> = (props) => {
  const { documentContent, tileElt, model, readOnly, scale, onRegisterTileApi, onUnregisterTileApi } = props;
  const contentRef = useCurrent(model.content as DrawingContentModelType);
  const [imageUrlToAdd, setImageUrlToAdd] = useState("");
  const hotKeys = useRef(new HotKeys());

  useEffect(() => {
    if (!readOnly) {
      contentRef.current.reset();
    }
    onRegisterTileApi({
      exportContentAsTileJson: (options?: ITileExportOptions) => {
        return contentRef.current.exportJson(options);
      },
      getTitle: () => {
        return getTitle();
      }
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
    contentRef.current.deleteObjects(contentRef.current.selectedIds);
  };

  const toolbarProps = useToolbarTileApi({ id: model.id, enabled: !readOnly, onRegisterTileApi, onUnregisterTileApi });
  const getTitle  = () => {
    return model.title || "";
  };

  const handleTitleChange = (title?: string) => {
    title && model.setTitle(title);
  };

  return (
    <DrawingContentModelContext.Provider value={contentRef.current} >
      <ToolTitleArea>
        <EditableTileTitle
          key="drawing-title"
          size={{width:null, height:null}}
          scale={scale}
          getTitle={getTitle}
          readOnly={readOnly}
          measureText={(text) => measureText(text, defaultTileTitleFont)}
          onEndEdit={handleTitleChange}
        />
      </ToolTitleArea>
      <div
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
