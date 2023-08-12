import classNames from "classnames";
import { observer } from "mobx-react-lite";
import React from "react";

import { ObjectBoundingBox } from "../../models/annotations/clue-object";

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
}
export const AnnotationButton = observer(function AnnotationButton({
  getObjectBoundingBox, objectId, objectType, onClick, rowId, sourceObjectId, sourceTileId, tileId
}: IAnnotationButtonProps) {
  const style = getObjectBoundingBox(rowId, tileId, objectId, objectType);
  if (!style) return null;

  const handleClick = () => onClick?.(tileId, objectId, objectType);

  const source = sourceObjectId === objectId && sourceTileId === tileId;
  const classes = classNames("annotation-button", { source });
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
