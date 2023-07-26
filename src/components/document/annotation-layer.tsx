import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useState } from "react";

import { useUIStore } from "../../hooks/use-stores";
import { ArrowAnnotation } from "../../models/annotations/arrow-annotation";
import { ClueObjectModel } from "../../models/annotations/clue-object";
import { DocumentContentModelType } from "../../models/document/document-content";

import "./annotation-layer.scss";

function getObjectBoundingBox(
  rowId: string, tileId: string, objectId: string, documentScrollX?: number, documentScrollY?: number
) {
  const rowSelector = `[data-row-id='${rowId}']`;
  const rowElements = document.querySelectorAll(rowSelector);
  if (rowElements.length !== 1) return null;
  const rowElement = (rowElements[0] as HTMLElement);

  const tileSelector = `[data-tool-id='${tileId}']`;
  const tileElements = document.querySelectorAll(tileSelector);
  if (tileElements.length !== 1) return null;
  const tileElement = (tileElements[0] as HTMLElement);

  // TODO Each tile type needs to handle this itself
  const objectSelector = `[data-object-id='${objectId}']`;
  const objectElements = document.querySelectorAll(objectSelector);
  if (objectElements.length !== 1) return null;
  const objectElement = objectElements[0];

  const objectBoundingBox = (objectElement as SVGGraphicsElement).getBBox();
  const tileBorder = 2;
  const left = rowElement.offsetLeft + tileElement.offsetLeft - tileElement.scrollLeft
    + objectBoundingBox.x + tileBorder - (documentScrollX ?? 0);
  const top = rowElement.offsetTop + tileElement.offsetTop - tileElement.scrollTop
    + objectBoundingBox.y + tileBorder - (documentScrollY ?? 0);
  const objectStroke = 2;
  const height = objectBoundingBox.height + objectStroke;
  const width = objectBoundingBox.width + objectStroke;
  return { left, top, height, width };
}

interface IAnnotationButtonProps {
  documentScrollX?: number;
  documentScrollY?: number;
  key?: string;
  objectId: string;
  onClick?: (tileId: string, objectId: string, objectType?: string) => void;
  rowId: string;
  sourceObjectId?: string;
  sourceTileId?: string;
  tileId: string;
}
const AnnotationButton = observer(function AdornmentButton({
  documentScrollX, documentScrollY, objectId, onClick, rowId, sourceObjectId, sourceTileId, tileId
}: IAnnotationButtonProps) {
  const style = getObjectBoundingBox(rowId, tileId, objectId, documentScrollX, documentScrollY);
  if (!style) return null;

  const handleClick = () => onClick?.(tileId, objectId);

  const source = sourceObjectId === objectId && sourceTileId === tileId;
  const classes = classNames("annotation-button", { source });
  return (
    <button className={classes} onClick={handleClick} style={style} />
  );
});

interface IAnnotationLayerProps {
  content?: DocumentContentModelType;
  documentScrollX?: number;
  documentScrollY?: number;
}
export const AnnotationLayer = observer(function AdornmentLayer({
  content, documentScrollX, documentScrollY
}: IAnnotationLayerProps) {
  const [sourceTileId, setSourceTileId] = useState("");
  const [sourceObjectId, setSourceObjectId] = useState("");
  const [sourceObjectType, setSourceObjectType] = useState<string | undefined>();
  const ui = useUIStore();

  const rowIds = content?.rowOrder || [];

  const handleAnnotationButtonClick = (tileId: string, objectId: string, objectType?: string) => {
    if (!sourceTileId || !sourceObjectId) {
      setSourceTileId(tileId);
      setSourceObjectId(objectId);
      setSourceObjectType(objectType);
    } else {
      const sourceObject =
        ClueObjectModel.create({ tileId: sourceTileId, objectId: sourceObjectId, objectType: sourceObjectType });
      const targetObject = ClueObjectModel.create({ tileId, objectId, objectType });
      content?.addArrow(ArrowAnnotation.create({ sourceObject, targetObject }));
      console.log(`annotations`, content?.annotations);
      setSourceTileId("");
      setSourceObjectId("");
      setSourceObjectType(undefined);
    }
  };

  const editting = ui.adornmentMode !== undefined;
  const hidden = !ui.showAdornments;
  const classes = classNames("annotation-layer", { editting, hidden });
  return (
    <div className={classes}>
      { editting && rowIds.map(rowId => {
        const row = content?.rowMap.get(rowId);
        if (row) {
          const tiles = row.tiles;
          return tiles.map(tileInfo => {
            const tile = content?.tileMap.get(tileInfo.tileId);
            if (tile) {
              return tile.content.adornableObjectIds.map(objectId => {
                return (
                  <AnnotationButton
                    documentScrollX={documentScrollX}
                    documentScrollY={documentScrollY}
                    key={`${tile.id}-${objectId}-button`}
                    objectId={objectId}
                    onClick={handleAnnotationButtonClick}
                    rowId={rowId}
                    sourceObjectId={sourceObjectId}
                    sourceTileId={sourceTileId}
                    tileId={tile.id}
                  />
                );
              });
            }
          });
        }
      })}
    </div>
  );
});
