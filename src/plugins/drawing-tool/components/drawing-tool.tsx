import classNames from "classnames";
import React, { useEffect, useState, useRef } from "react";
import { IToolTileProps } from "../../../components/tools/tool-tile";
import { ToolbarView } from "./drawing-toolbar";
import { DrawingLayerView } from "./drawing-layer";
import { useToolbarToolApi } from "../../../components/tools/hooks/use-toolbar-tool-api";
import { DrawingContentModelType } from "../model/drawing-content";
import { useCurrent } from "../../../hooks/use-current";
import { ITileExportOptions } from "../../../models/tools/tool-content-info";
import { DrawingContentModelContext } from "./drawing-content-context";
import { ToolTitleArea } from "../../../components/tools/tool-title-area";
import { EditableTileTitle } from "../../../components/tools/editable-tile-title";
import { measureText } from "../../../components/tools/hooks/use-measure-text";
import { defaultTileTitleFont } from "../../../components/constants";
import { HotKeys } from "../../../utilities/hot-keys";
import { pasteClipboardImage } from "../../../utilities/clipboard-utils";
import "./drawing-tool.scss";

type IProps = IToolTileProps;

const DrawingToolComponent: React.FC<IProps> = (props) => {
  const { documentContent, toolTile, model, readOnly, scale, onRegisterToolApi, onUnregisterToolApi } = props;
  const contentRef = useCurrent(model.content as DrawingContentModelType);
  const [imageUrlToAdd, setImageUrlToAdd] = useState("");
  const hotKeys = useRef(new HotKeys());

  useEffect(() => {
    if (!readOnly) {
      contentRef.current.reset();
    }
    onRegisterToolApi({
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

  const handlePaste = () => {
    pasteClipboardImage(({ image }) => {
      setImageUrlToAdd(image.contentUrl || '');
    });
  };

  const handleDelete = () => {
    contentRef.current.deleteObjects(contentRef.current.selectedIds);
  };

  const toolbarProps = useToolbarToolApi({ id: model.id, enabled: !readOnly, onRegisterToolApi, onUnregisterToolApi });
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
        <ToolbarView model={model}
                    documentContent={documentContent}
                    toolTile={toolTile}
                    scale={scale}
                    setImageUrlToAdd={setImageUrlToAdd}
                    {...toolbarProps} />
        <DrawingLayerView {...props} imageUrlToAdd={imageUrlToAdd} setImageUrlToAdd={setImageUrlToAdd} />
      </div>
    </DrawingContentModelContext.Provider>
  );
};
export default DrawingToolComponent;
