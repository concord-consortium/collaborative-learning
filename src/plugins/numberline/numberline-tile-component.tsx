import React from "react";
import classNames from "classnames";
import { ITileProps } from "../../components/tiles/tile-component";
import { NumberlineTile } from "./numberline-tile";
import { BasicEditableTileTitle } from "../../components/tiles/basic-editable-tile-title";
import { NumberlineToolbar } from "./numberline-toolbar";
import { useToolbarTileApi } from "../../components/tiles/hooks/use-toolbar-tile-api";
import { NumberlineContentModelType } from "./models/numberline-content";

import "./numberline-tile-component.scss";

export const NumberlineTileComponent: React.FC<ITileProps> = (props) => {
  const {
    documentContent, model, readOnly, scale, tileElt,
    onRegisterTileApi, onUnregisterTileApi
  } = props;
  const toolbarProps = useToolbarTileApi({ id: model.id, enabled: !readOnly, onRegisterTileApi, onUnregisterTileApi });

  const handlePlacePoint = () => {
    //TODO: will implement in future ticket
    //this should be active by default
  };

  const handleClearPoints = () => {
    const content = model.content as NumberlineContentModelType;
    content.clearAllPoints();
  };

  const handleDeletePoint = () => {
    //TODO: will implement in future ticket
  };


  return (
    <div className={classNames("numberline-wrapper", { "read-only": readOnly })}>
      <div className={"numberline-title"}>
        <BasicEditableTileTitle
          model={model}
          readOnly={readOnly}
          scale={scale}
        />
      </div>
      <NumberlineToolbar
        documentContent={documentContent}
        tileElt={tileElt}
        {...toolbarProps}
        scale={scale}
        handlePlacePoint={handlePlacePoint}
        handleClearPoints={handleClearPoints}
        handleDeletePoint={handleDeletePoint}
      />
      <NumberlineTile {...props}/>
    </div>
  );
};
