import React, { useEffect, useRef } from "react";
import classNames from "classnames";

import { NumberlineTile } from "./numberline-tile";
import { NumberlineToolbar } from "./numberline-toolbar";
import { NumberlineContentModelType } from "../models/numberline-content";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { useToolbarTileApi } from "../../../components/tiles/hooks/use-toolbar-tile-api";
import { ITileProps } from "../../../components/tiles/tile-component";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { HotKeys } from "../../../utilities/hot-keys";

import "./numberline-tile-component.scss";

export const NumberlineTileComponent: React.FC<ITileProps> = (props) => {
  const { documentContent, model, readOnly, scale, tileElt,
          onRegisterTileApi, onUnregisterTileApi } = props;

  const content = model.content as NumberlineContentModelType;
  const hotKeys = useRef(new HotKeys());
  const toolbarProps = useToolbarTileApi({ id: model.id, enabled: !readOnly, onRegisterTileApi, onUnregisterTileApi });

  const handleClearPoints = () => {
    content.deleteAllPoints();
  };

  const handleDeletePoint = () => {
    content.deleteSelectedPoints();
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
        return content.exportJson(options);
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
        handleClearPoints={handleClearPoints}
        handleDeletePoint={handleDeletePoint}
      />
        <NumberlineTile {...props}/>
    </div>
  );
};
