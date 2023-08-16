import React from "react";
import classNames from "classnames";
import { ITileProps } from "../../components/tiles/tile-component";
import { NumberlineToolComponent } from "./numberline-tile";
import { BasicEditableTileTitle } from "../../components/tiles/basic-editable-tile-title";
import { NumberlineToolbar } from "./numberline-toolbar";
import { useToolbarTileApi } from "../../components/tiles/hooks/use-toolbar-tile-api";

import "./numberline-tile-wrapper.scss";

export const NumberlineTileWrapperComponent: React.FC<ITileProps> = (props) => {
  const {
    documentContent, model, readOnly, scale, tileElt,
    onRegisterTileApi, onUnregisterTileApi
  } = props;
  const placePointClicked = () => null;
  const toolbarProps = useToolbarTileApi({ id: model.id, enabled: !readOnly, onRegisterTileApi, onUnregisterTileApi });

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
        onSetPlacePoint={placePointClicked}
      />
      <NumberlineToolComponent {...props}/>
    </div>
  );
};
