import React, { useEffect } from "react";
import classNames from "classnames";

import { GraphComponent } from "./graph-component";
import { ITileProps } from "../../../components/tiles/tile-component";
import { ToolTitleArea } from "../../../components/tiles/tile-title-area";
import { EditableTileTitle } from "../../../components/tiles/editable-tile-title";
import { measureText } from "../../../components/tiles/hooks/use-measure-text";
import { defaultTileTitleFont } from "../../../components/constants";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { useCurrent } from "../../../hooks/use-current";
import { IGraphModel } from "../models/graph-model";

import "./graph-wrapper-component.scss";

export const GraphWrapperComponent: React.FC<ITileProps> = (props) => {
  const { model, readOnly, scale, onRegisterTileApi } = props;
  const contentRef = useCurrent(model.content as IGraphModel);

  useEffect(() => {
    onRegisterTileApi({
      exportContentAsTileJson: (options?: ITileExportOptions) => {
        return contentRef.current.exportJson(options);
      },
      getTitle: () => {
        return getTitle();
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getTitle  = () => {
    return model.title || "";
  };

  const handleTitleChange = (title?: string) => {
    title && model.setTitle(title);
  };

  return (
    <div className={classNames("graph-wrapper", { "read-only": readOnly })}>
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
      <GraphComponent tile={model} />
    </div>
  );
};
