import classNames from "classnames";
import { observer } from "mobx-react-lite";
import React, { useContext } from "react";

import { TileApiInterfaceContext } from "../tiles/tile-api";
import { ObjectBoundingBox } from "../../models/annotations/clue-object";
import { Point } from "../../utilities/math-utils";

import "./annotation-button.scss";

interface IAnnotationButtonProps {
  getObjectBoundingBox:
    (tileId: string, objectId: string, objectType?: string) => ObjectBoundingBox | undefined;
  getTileOffset: () => Point | undefined;
  key?: string;
  objectId: string;
  objectType?: string;
  onClick?: (event: React.MouseEvent, tileId: string, objectId: string, objectType?: string) => void;
  sourceObjectId?: string;
  sourceTileId?: string;
  tileId: string;
}
export const AnnotationButton = observer(function AnnotationButton({
  getObjectBoundingBox, getTileOffset, objectId, objectType, onClick, sourceObjectId, sourceTileId, tileId
}: IAnnotationButtonProps) {
  const tileApiInterface = useContext(TileApiInterfaceContext);

  const handleClick = (e: React.MouseEvent) => onClick?.(e, tileId, objectId, objectType);

  const source = sourceObjectId === objectId && sourceTileId === tileId;
  const classes = classNames("annotation-button", { source });

  function getButton() {
    // Use a tile specified button if there is one
    const tileApi = tileApiInterface?.getTileApi(tileId);
    const _button = tileApi?.getObjectButtonSVG?.({ classes, handleClick, objectId, objectType });
    if (_button) return _button;

    // Otherwise, use the object's bounding box
    const style = getObjectBoundingBox(tileId, objectId, objectType);
    if (!style) return null;

    return (
      <rect
        className={classes}
        height={style.height}
        onClick={handleClick}
        width={style.width}
        x={style.left}
        y={style.top}
      />
    );
  }
  const button = getButton();
  if (!button) return null;

  const tileOffset = getTileOffset();
  if (tileOffset) {
    return (
      <g transform={`translate(${tileOffset[0]} ${tileOffset[1]})`}>
        {button}
      </g>
    );
  }

  return null;
});
