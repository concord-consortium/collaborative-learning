import React from "react";
import classNames from "classnames";
import { ITileProps } from "../../components/tiles/tile-component";
import { NumberlineToolComponent } from "./numberline-tile";
import { BasicEditableTileTitle } from "../../components/tiles/basic-editable-tile-title";
import { NumberlineToolbar } from "./numberline-toolbar";
import { useToolbarTileApi } from "../../components/tiles/hooks/use-toolbar-tile-api";
import { NumberlineContentModelType } from "./models/numberline-content";

import "./numberline-tile-wrapper.scss";

export const NumberlineTileWrapperComponent: React.FC<ITileProps> = (props) => {
  const {
    documentContent, model, readOnly, scale, tileElt,
    onRegisterTileApi, onUnregisterTileApi
  } = props;
  const toolbarProps = useToolbarTileApi({ id: model.id, enabled: !readOnly, onRegisterTileApi, onUnregisterTileApi });

  const handlePlacePoint = () => null;

  const handleUndoPoints = () => {
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
        handleClearPoints={handleUndoPoints}
        handleDeletePoint={handleDeletePoint}
      />
      <NumberlineToolComponent {...props}/>
    </div>
  );
};
