import classNames from "classnames";
import React, { useEffect } from "react";
import { IToolTileProps } from "../../../components/tools/tool-tile";
import { ToolbarView } from "./drawing-toolbar";
import { DrawingLayerView } from "./drawing-layer";
import { useToolbarToolApi } from "../../../components/tools/hooks/use-toolbar-tool-api";
import { DrawingContentModelType } from "../model/drawing-content";
import { useCurrent } from "../../../hooks/use-current";
import { exportDrawingTileSpec } from "../model/drawing-export";
import { ITileExportOptions } from "../../../models/tools/tool-content-info";

import "./drawing-tool.sass";

type IProps = IToolTileProps;

const DrawingToolComponent: React.FC<IProps> = (props) => {
  const { documentContent, toolTile, model, readOnly, scale, onRegisterToolApi, onUnregisterToolApi } = props;
  const contentRef = useCurrent(model.content as DrawingContentModelType);

  useEffect(() => {
    if (!readOnly) {
      contentRef.current.reset();
    }

    onRegisterToolApi({
      exportContentAsTileJson: (options?: ITileExportOptions) => {
        return exportDrawingTileSpec(contentRef.current.changes, options);
      }
    });

  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toolbarProps = useToolbarToolApi({ id: model.id, enabled: !readOnly, onRegisterToolApi, onUnregisterToolApi });

  return (
    <div className={classNames("drawing-tool", { "read-only": readOnly })}>
      <ToolbarView model={model}
                  documentContent={documentContent}
                  toolTile={toolTile}
                  scale={scale}
                  {...toolbarProps} />
      <DrawingLayerView {...props} />
    </div>
  );
};
export default DrawingToolComponent;
