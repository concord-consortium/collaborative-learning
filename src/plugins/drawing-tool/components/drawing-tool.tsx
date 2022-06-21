import classNames from "classnames";
import React, { useEffect } from "react";
import { IToolTileProps } from "../../../components/tools/tool-tile";
import { ToolbarView } from "./drawing-toolbar";
import { DrawingLayerView } from "./drawing-layer";
import { useToolbarToolApi } from "../../../components/tools/hooks/use-toolbar-tool-api";
import { DrawingContentModelType, createDrawingContent } from "../model/drawing-content";
import { useCurrent } from "../../../hooks/use-current";
import { ITileExportOptions } from "../../../models/tools/tool-content-info";

import "./drawing-tool.sass";

type IProps = IToolTileProps;

// This default drawing content should never be used, but it is necessary
// so code using this context doesn't have to check for undefined
export const DrawingContentModelContext = React.createContext<DrawingContentModelType>(createDrawingContent());

const DrawingToolComponent: React.FC<IProps> = (props) => {
  const { documentContent, toolTile, model, readOnly, scale, onRegisterToolApi, onUnregisterToolApi } = props;
  const contentRef = useCurrent(model.content as DrawingContentModelType);

  useEffect(() => {
    if (!readOnly) {
      contentRef.current.reset();
    }

    onRegisterToolApi({
      exportContentAsTileJson: (options?: ITileExportOptions) => {
        return contentRef.current.exportJson(options);
      }
    });

  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toolbarProps = useToolbarToolApi({ id: model.id, enabled: !readOnly, onRegisterToolApi, onUnregisterToolApi });

  return (
    <DrawingContentModelContext.Provider value={contentRef.current} >
      <div className={classNames("drawing-tool", { "read-only": readOnly })} data-testid="drawing-tool">
        <ToolbarView model={model}
                    documentContent={documentContent}
                    toolTile={toolTile}
                    scale={scale}
                    {...toolbarProps} />
        <DrawingLayerView {...props} />
      </div>
    </DrawingContentModelContext.Provider>
  );
};
export default DrawingToolComponent;
