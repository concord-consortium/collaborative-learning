import classNames from "classnames";
import { observer } from "mobx-react";
import React, { MouseEventHandler, useContext, useEffect, useRef, useState } from "react";

import { AnnotationButton } from "../annotations/annotation-button";
import { getDeafultPeak } from "../annotations/annotation-utilities";
import { ArrowAnnotationComponent } from "../annotations/arrow-annotation";
import { PreviewArrow } from "../annotations/preview-arrow";
import { TileApiInterfaceContext } from "../tiles/tile-api";
import { useUIStore } from "../../hooks/use-stores";
import { ArrowAnnotation } from "../../models/annotations/arrow-annotation";
import { ClueObjectModel, IClueObject, OffsetModel } from "../../models/annotations/clue-object";
import { DocumentContentModelType } from "../../models/document/document-content";

import "./annotation-layer.scss";

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
  const [mouseX, setMouseX] = useState<number | undefined>();
  const [mouseY, setMouseY] = useState<number | undefined>();
  const divRef = useRef<HTMLDivElement>();
  const ui = useUIStore();
  const tileApiInterface = useContext(TileApiInterfaceContext);

  const handleMouseMove: MouseEventHandler<HTMLDivElement> = event => {
    if (divRef.current) {
      const bb = divRef.current.getBoundingClientRect();
      setMouseX(event.clientX - bb.left);
      setMouseY(event.clientY - bb.top);
    }
  };

  const rowIds = content?.rowOrder || [];

  function getObjectBoundingBox(
    rowId: string, tileId: string, objectId: string, objectType?: string
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
    const objectBoundingBox = tileApi?.getObjectBoundingBox?.(objectId, objectType);
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
    tileId: string, objectId: string, objectType?: string
  ) {
    if (!content) return undefined;
  
    const rowId = content.findRowContainingTile(tileId);
    return getObjectBoundingBox(rowId ?? "", tileId, objectId, objectType);
  }

  const sourceBoundingBox = sourceTileId && sourceObjectId
    ? getObjectBoundingBoxUnknownRow(sourceTileId, sourceObjectId, sourceObjectType)
    : undefined;

  const handleAnnotationButtonClick = (tileId: string, objectId: string, objectType?: string) => {
    if (!sourceBoundingBox) {
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
      const targetBoundingBox = getObjectBoundingBoxUnknownRow(tileId, objectId, objectType);
      let textOffset;
      if (targetBoundingBox) {
        const sourceX = sourceBoundingBox.left + sourceBoundingBox.width / 2;
        const sourceY = sourceBoundingBox.top + sourceBoundingBox.height / 2;
        const targetX = targetBoundingBox.left + targetBoundingBox.width / 2;
        const targetY = targetBoundingBox.top + targetBoundingBox.height / 2;
        const { peakDx, peakDy } = getDeafultPeak(sourceX, sourceY, targetX, targetY);
        textOffset = OffsetModel.create({ dx: peakDx, dy: peakDy });
      }
      const newArrow = ArrowAnnotation.create({ sourceObject, targetObject, textOffset });
      newArrow.setIsNew(true);
      content?.addArrow(newArrow);
      setSourceTileId("");
      setSourceObjectId("");
      setSourceObjectType(undefined);
    }
  };

  const getBoundingBox = (object: IClueObject) => {
    return getObjectBoundingBoxUnknownRow(object.tileId, object.objectId, object.objectType);
  };

  const editing = ui.annotationMode !== undefined;
  const hidden = !ui.showAnnotations;
  const classes = classNames("annotation-layer", { editing, hidden });
  return (
    <div
      className={classes}
      onMouseMove={handleMouseMove}
      ref={element => {
        if (element) divRef.current = element;
      }}
    >
      <svg
        className="annotation-svg"
        height="100%"
        width="100%"
        xmlnsXlink="http://www.w3.org/1999/xlink"
      >
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
        { Array.from(content?.annotations.values() ?? []).map(arrow => {
          const key = `sparrow-${arrow.id}`;
          return (
            <ArrowAnnotationComponent
              arrow={arrow}
              canEdit={!readOnly && editing}
              getBoundingBox={getBoundingBox}
              key={key}
            />
          );
        })}
        <PreviewArrow
          sourceX={sourceBoundingBox ? sourceBoundingBox.left + sourceBoundingBox.width / 2 : undefined}
          sourceY={sourceBoundingBox ? sourceBoundingBox.top + sourceBoundingBox.height / 2 : undefined}
          targetX={mouseX}
          targetY={mouseY}
        />
      </svg>
    </div>
  );
});
