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
import { useToolbarTileApi } from "../../../components/tiles/hooks/use-toolbar-tile-api";
import { GraphToolbar } from "./graph-toolbar";
import { useProviderTileLinking } from "../../../hooks/use-provider-tile-linking";

import "./graph-wrapper-component.scss";

export const GraphWrapperComponent: React.FC<ITileProps> = (props) => {
  const {
    documentContent, documentId, model, readOnly, scale, tileElt,
    onRegisterTileApi, onUnregisterTileApi, onRequestTilesOfType, onRequestLinkableTiles
  } = props;
  const contentRef = useCurrent(model.content as IGraphModel);
  const enabled = !readOnly;
  const content = model.content as IGraphModel;
  const toolbarProps = useToolbarTileApi({ id: model.id, enabled, onRegisterTileApi, onUnregisterTileApi });

  const { isLinkEnabled, showLinkTileDialog } = useProviderTileLinking({
    documentId, model, readOnly, onRequestTilesOfType, onRequestLinkableTiles
  });

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
      <GraphToolbar
        documentContent={documentContent}
        documentId={documentId}
        tileElt={tileElt}
        scale={scale}
        model={model}
        content={content} {...toolbarProps}
        isLinkEnabled={isLinkEnabled}
        onLinkTableButtonClick={showLinkTileDialog}
        onRequestTilesOfType={onRequestTilesOfType}
      />
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
