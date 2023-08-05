import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useContext, useEffect, useState } from "react";

import { ArrowAnnotationComponent } from "../annotations/arrow-annotation";
import { TileApiInterfaceContext } from "../tiles/tile-api";
import { useUIStore } from "../../hooks/use-stores";
import { ArrowAnnotation, IArrowAnnotation } from "../../models/annotations/arrow-annotation";
import { ObjectBoundingBox, ClueObjectModel, IClueObject } from "../../models/annotations/clue-object";
import { DocumentContentModelType } from "../../models/document/document-content";

import "./annotation-layer.scss";

interface IAnnotationButtonProps {
  getObjectBoundingBox: (rowId: string, tileId: string, objectId: string) => ObjectBoundingBox | undefined;
  key?: string;
  objectId: string;
  objectType?: string;
  onClick?: (tileId: string, objectId: string, objectType?: string) => void;
  rowId: string;
  sourceObjectId?: string;
  sourceTileId?: string;
  tileId: string;
}
const AnnotationButton = observer(function AnnotationButton({
  getObjectBoundingBox, objectId, objectType, onClick, rowId, sourceObjectId, sourceTileId, tileId
}: IAnnotationButtonProps) {
  const style = getObjectBoundingBox(rowId, tileId, objectId);
  if (!style) return null;

  const handleClick = () => onClick?.(tileId, objectId, objectType);

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
  readOnly?: boolean;
}
export const AnnotationLayer = observer(function AnnotationLayer({
  content, documentScrollX, documentScrollY, readOnly
}: IAnnotationLayerProps) {
  const [_initialized, setInitialized] = useState(false);
  useEffect(() => {
    // Forces the annotation layer to rerender after initial load, getting access to the locations of elements.
    setInitialized(true);
  }, []);
  const [sourceTileId, setSourceTileId] = useState("");
  const [sourceObjectId, setSourceObjectId] = useState("");
  const [sourceObjectType, setSourceObjectType] = useState<string | undefined>();
  const ui = useUIStore();
  const tileApiInterface = useContext(TileApiInterfaceContext);

  const rowIds = content?.rowOrder || [];

  function getObjectBoundingBox(
    rowId: string, tileId: string, objectId: string
  ) {
    const readWriteClass = readOnly ? "read-only" : "read-write";
    const documentClasses = `.document-content.${readWriteClass} `;
    const rowSelector = `${documentClasses}[data-row-id='${rowId}']`;
    const rowElements = document.querySelectorAll(rowSelector);
    if (rowElements.length !== 1) return undefined;
    const rowElement = (rowElements[0] as HTMLElement);
  
    const tileSelector = `${documentClasses}[data-tool-id='${tileId}']`;
    const tileElements = document.querySelectorAll(tileSelector);
    if (tileElements.length !== 1) return undefined;
    const tileElement = (tileElements[0] as HTMLElement);
  
    const tileApi = tileApiInterface?.getTileApi(tileId);
    const objectBoundingBox = tileApi?.getObjectBoundingBox?.(objectId);
    if (!objectBoundingBox) return undefined;

    const tileBorder = 3;
    const left = rowElement.offsetLeft + tileElement.offsetLeft - tileElement.scrollLeft
      + objectBoundingBox.left + tileBorder - (documentScrollX ?? 0);
    const top = rowElement.offsetTop + tileElement.offsetTop - tileElement.scrollTop
      + objectBoundingBox.top + tileBorder - (documentScrollY ?? 0);
    const height = objectBoundingBox.height;
    const width = objectBoundingBox.width;
    return { left, top, height, width };
  }
  
  function getObjectBoundingBoxUnknownRow(
    tileId: string, objectId: string
  ) {
    if (!content) return undefined;
  
    const rowId = content.findRowContainingTile(tileId);
    return getObjectBoundingBox(rowId ?? "", tileId, objectId);
  }

  const handleAnnotationButtonClick = (tileId: string, objectId: string, objectType?: string) => {
    if (!sourceTileId || !sourceObjectId) {
      // We don't have a source object yet, so make this one the source object
      setSourceTileId(tileId);
      setSourceObjectId(objectId);
      setSourceObjectType(objectType);
    } else if (tileId === sourceTileId && objectId === sourceObjectId && objectType === sourceObjectType) {
      // This object is already selected as the source object, so deselect it
      setSourceTileId("");
      setSourceObjectId("");
      setSourceObjectType(undefined);
    } else {
      // Create an arrow from the source object to this object
      const sourceObject =
        ClueObjectModel.create({ tileId: sourceTileId, objectId: sourceObjectId, objectType: sourceObjectType });
      const targetObject = ClueObjectModel.create({ tileId, objectId, objectType });
      content?.addArrow(ArrowAnnotation.create({ sourceObject, targetObject }));
      setSourceTileId("");
      setSourceObjectId("");
      setSourceObjectType(undefined);
    }
  };

  const getBoundingBox = (object: IClueObject) => {
    return getObjectBoundingBoxUnknownRow(object.tileId, object.objectId);
  };

  const editing = ui.annotationMode !== undefined;
  const hidden = !ui.showAnnotations;
  const classes = classNames("annotation-layer", { editing, hidden });
  return (
    <div className={classes}>
      { editing && !readOnly && rowIds.map(rowId => {
        const row = content?.rowMap.get(rowId);
        if (row) {
          const tiles = row.tiles;
          return tiles.map(tileInfo => {
            const tile = content?.tileMap.get(tileInfo.tileId);
            if (tile) {
              return tile.content.annotatableObjects.map(({ objectId, objectType }) => {
                return (
                  <AnnotationButton
                    getObjectBoundingBox={getObjectBoundingBox}
                    key={`${tile.id}-${objectId}-button`}
                    objectId={objectId}
                    objectType={objectType}
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
      <svg xmlnsXlink="http://www.w3.org/1999/xlink" className="annotation-svg" height="1500" width="1500">
        { content?.annotations.map((arrow: IArrowAnnotation) => {
          const key = `${arrow.sourceObject?.objectId}-${arrow.targetObject?.objectId}`;
          return (
            <ArrowAnnotationComponent
              arrow={arrow}
              canEdit={!readOnly && editing}
              getBoundingBox={getBoundingBox}
              key={key}
            />
          );
        })}
      </svg>
    </div>
  );
});
