import React, { useEffect, useRef } from "react";
import classNames from "classnames";
import { ITileProps } from "../../components/tiles/tile-component";
import { NumberlineTile } from "./numberline-tile";
import { BasicEditableTileTitle } from "../../components/tiles/basic-editable-tile-title";
import { NumberlineToolbar } from "./numberline-toolbar";
import { useToolbarTileApi } from "../../components/tiles/hooks/use-toolbar-tile-api";
import { NumberlineContentModelType } from "./models/numberline-content";
import { useCurrent } from "../../hooks/use-current";
import { ITileExportOptions } from "../../models/tiles/tile-content-info";
import { HotKeys } from "../../utilities/hot-keys";

import "./numberline-tile-component.scss";

export const NumberlineTileComponent: React.FC<ITileProps> = (props) => {
  const { documentContent, model, readOnly, scale, tileElt,
          onRegisterTileApi, onUnregisterTileApi } = props;

  const contentRef = useCurrent(model.content as NumberlineContentModelType);
  const hotKeys = useRef(new HotKeys());
  const toolbarProps = useToolbarTileApi({ id: model.id, enabled: !readOnly, onRegisterTileApi, onUnregisterTileApi });

  const handlePlacePoint = () => {
    //TODO: will implement in future ticket
    //this should be active by default
  };

  const handleClearPoints = () => {
    contentRef.current.deleteAllPoints();
  };

  const handleDeletePoint = () => {
    contentRef.current.deleteSelectedPointsFromPointsMap();
  };

  useEffect(()=>{
    if (!readOnly) {
      hotKeys.current.register({
        "delete": handleDeletePoint,
        "backspace": handleDeletePoint,
      });
    }
    onRegisterTileApi({
      exportContentAsTileJson: (options?: ITileExportOptions) => {
        return contentRef.current.exportJson(options);
      },
      getTitle: () => {
        return getTitle();
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getTitle = () => {
    return model.title || "";
  };

  return (
    <div
      className={classNames("numberline-wrapper", { "read-only": readOnly })}
      onKeyDown={(e) => hotKeys.current.dispatch(e)}
      tabIndex={0}
    >
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
