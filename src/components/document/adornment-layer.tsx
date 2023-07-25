import classNames from "classnames";
import { observer } from "mobx-react";
import React from "react";

import { useUIStore } from "../../hooks/use-stores";
import { DocumentContentModelType } from "../../models/document/document-content";

import "./adornment-layer.scss";

interface IAdornmentButtonProps {
  documentScrollX?: number;
  documentScrollY?: number;
  key?: string;
  objectId: string;
  rowId: string;
  tileId: string;
}
const AdornmentButton = observer(function AdornmentButton({
  documentScrollX, documentScrollY, objectId, rowId, tileId
}: IAdornmentButtonProps) {
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
  const style = { left, top, height, width };

  return (
    <div className="adornment-button" style={style} />
  );
});

interface IAdornmentLayerProps {
  content?: DocumentContentModelType;
  documentScrollX?: number;
  documentScrollY?: number;
}
export const AdornmentLayer = observer(function AdornmentLayer({
  content, documentScrollX, documentScrollY
}: IAdornmentLayerProps) {
  const ui = useUIStore();

  const rowIds = content?.rowOrder || [];

  const editting = ui.adornmentMode !== undefined;
  const hidden = !ui.showAdornments;
  const classes = classNames("adornment-layer", { editting, hidden });
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
                  <AdornmentButton
                    documentScrollX={documentScrollX}
                    documentScrollY={documentScrollY}
                    key={`${tile.id}-${objectId}-button`}
                    objectId={objectId}
                    rowId={rowId}
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
