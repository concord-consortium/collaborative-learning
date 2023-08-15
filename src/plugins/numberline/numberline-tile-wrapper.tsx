import React, { useEffect } from "react";
import classNames from "classnames";
import { ITileProps } from "../../components/tiles/tile-component";
import { NumberlineToolComponent } from "./numberline-tile";
import { BasicEditableTileTitle } from "../../components/tiles/basic-editable-tile-title";
import { IGraphModel } from "../graph/models/graph-model";
import { NumberlineToolbar } from "./numberline-toolbar";
import { useToolbarTileApi } from "../../../src/components/tiles/hooks/use-toolbar-tile-api";


import "./numberline-tile-wrapper.scss";

export const NumberlineTileWrapperComponent: React.FC<ITileProps> = (props) => {

  const {
    documentContent, documentId, model, readOnly, scale, tileElt,
    onRegisterTileApi, onUnregisterTileApi, onRequestTilesOfType, onRequestLinkableTiles
  } = props;

  const content = model.content as IGraphModel;

  useEffect(() => {
    // console.log("Wrapper time!");
  }, []);

  const placePointClicked = () => {
    console.log("placePointClicked");
  };
  const toolbarProps = useToolbarTileApi({ id: model.id, enabled: !readOnly, onRegisterTileApi, onUnregisterTileApi });


  return (
    <div className={classNames("numberline-wrapper", { "read-only": readOnly })}>
      <BasicEditableTileTitle
        model={model}
        readOnly={readOnly}
        scale={scale}
      />
      <NumberlineToolbar
        documentContent={documentContent}
        tileElt={tileElt}
        {...toolbarProps}
        scale={scale}
        onSetPlacePoint={placePointClicked}
      />
      <NumberlineToolComponent model={model}/>

    </div>

  );




};
