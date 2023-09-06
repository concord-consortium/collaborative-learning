import classNames from "classnames";
import { observer } from "mobx-react-lite";
import React, { useContext } from "react";

import { TileApiInterfaceContext } from "../tiles/tile-api";
import { ObjectBoundingBox } from "../../models/annotations/clue-object";
import { Point } from "../../utilities/math-utils";

import "./annotation-button.scss";

interface IAnnotationButtonProps {
  getObjectBoundingBox:
    (rowId: string, tileId: string, objectId: string, objectType?: string) => ObjectBoundingBox | undefined;
  key?: string;
  objectId: string;
  objectType?: string;
  onClick?: (tileId: string, objectId: string, objectType?: string) => void;
  rowId: string;
  sourceObjectId?: string;
  sourceTileId?: string;
  tileId: string;
  translateTilePointToScreenPoint?: (point: Point) => Point | undefined;
}
export const AnnotationButton = observer(function AnnotationButton({
  getObjectBoundingBox, objectId, objectType, onClick, rowId, sourceObjectId, sourceTileId, tileId,
  translateTilePointToScreenPoint
}: IAnnotationButtonProps) {
  const tileApiInterface = useContext(TileApiInterfaceContext);

  const handleClick = () => onClick?.(tileId, objectId, objectType);

  const source = sourceObjectId === objectId && sourceTileId === tileId;
  const classes = classNames("annotation-button", { source });

  // Use a tile specified button if there is one
  const tileApi = tileApiInterface?.getTileApi(tileId);
  const button = tileApi?.getObjectButtonSVG?.({
    classes, handleClick, objectId, objectType, translateTilePointToScreenPoint
  });
  if (button) return button;

  // Otherwise, use the object's bounding box
  const style = getObjectBoundingBox(rowId, tileId, objectId, objectType);
  if (!style) return null;

  return (
    <rect
      className={classes}
      fill="transparent"
      height={style.height}
      onClick={handleClick}
      width={style.width}
      x={style.left}
      y={style.top}
    />
  );
});
