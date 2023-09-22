import classNames from "classnames";
import { observer } from "mobx-react";
import React, { MouseEventHandler, useContext, useEffect, useRef, useState } from "react";
import useResizeObserver from "use-resize-observer";

import { AnnotationButton } from "../annotations/annotation-button";
import { getDefaultPeak } from "../annotations/annotation-utilities";
import { ArrowAnnotationComponent } from "../annotations/arrow-annotation";
import { PreviewArrow } from "../annotations/preview-arrow";
import { TileApiInterfaceContext } from "../tiles/tile-api";
import { useUIStore } from "../../hooks/use-stores";
import { ArrowAnnotation } from "../../models/annotations/arrow-annotation";
import { ClueObjectModel, IClueObject, OffsetModel } from "../../models/annotations/clue-object";
import { DocumentContentModelType } from "../../models/document/document-content";
import { Point } from "../../utilities/math-utils";

import "./annotation-layer.scss";

interface IAnnotationLayerProps {
  canvasElement?: HTMLDivElement | null;
  content?: DocumentContentModelType;
  documentScrollX?: number;
  documentScrollY?: number;
  readOnly?: boolean;
}
export const AnnotationLayer = observer(function AnnotationLayer({
  canvasElement, content, documentScrollX, documentScrollY, readOnly
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
  const divRef = useRef<Element|null>(null);
  const ui = useUIStore();
  const tileApiInterface = useContext(TileApiInterfaceContext);

  // Clear a partially completed annotation when the mode changes
  useEffect(() => {
    setSourceTileId("");
    setSourceObjectId("");
    setSourceObjectType(undefined);
  }, [ui.annotationMode]);

  // Force rerenders when the layer's size changes
  useResizeObserver({ ref: divRef, box: "border-box" });

  function getRowElement(rowId?: string) {
    if (rowId === undefined) return undefined;
    const rowSelector = `[data-row-id='${rowId}']`;
    const rowElements = canvasElement?.querySelectorAll(rowSelector);
    if (rowElements && rowElements.length === 1) {
      return rowElements[0] as HTMLElement;
    }
  }

  const firstRow = content?.rowOrder.length && content.rowOrder.length > 0
    ? getRowElement(content?.getRowByIndex(0)?.id) : undefined;
  const documentWidth = firstRow?.offsetWidth ?? 0;
  const documentHeight = content?.height ?? 0;
  const documentLeft = 0;
  const documentRight = documentWidth;
  const documentBottom = documentHeight - (documentScrollY ?? 0);
  const documentTop = -(documentScrollY ?? 0);

  const handleMouseMove: MouseEventHandler<HTMLDivElement> = event => {
    if (divRef.current) {
      const bb = divRef.current.getBoundingClientRect();
      setMouseX(event.clientX - bb.left);
      setMouseY(event.clientY - bb.top);
    }
  };

  // Returns a function that will translate a point so it can be passed as a parameter to AnnotationButton
  function getTranslateTilePointToScreenPoint(rowId: string, tileId: string) {
    const tileBorder = 3;

    const rowElement = getRowElement(rowId);
    if (!rowElement) return undefined;

    const tileSelector = `[data-tool-id='${tileId}']`;
    const tileElements = canvasElement?.querySelectorAll(tileSelector);
    const tileElement = tileElements && tileElements.length === 1 ? tileElements[0] as HTMLElement : undefined;
    if (!tileElement) return undefined;

    return (point: Point): Point | undefined => {
      const [x, y] = point;
      const _x = rowElement.offsetLeft + tileElement.offsetLeft - tileElement.scrollLeft
        + x + tileBorder - (documentScrollX ?? 0);
      const _y = rowElement.offsetTop + tileElement.offsetTop - tileElement.scrollTop
        + y + tileBorder - (documentScrollY ?? 0);
      return [_x, _y];
    };
  }

  function getObjectBoundingBox(
    rowId: string, tileId: string, objectId: string, objectType?: string
  ) {
    const tileApi = tileApiInterface?.getTileApi(tileId);
    const objectBoundingBox = tileApi?.getObjectBoundingBox?.(objectId, objectType);
    if (!objectBoundingBox) return undefined;

    const translatePoint = getTranslateTilePointToScreenPoint(rowId, tileId);
    const point = translatePoint?.([objectBoundingBox.left, objectBoundingBox.top]);
    if (!point) return undefined;

    const [left, top] = point;
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
  function defaultOffset(tileId?: string, objectId?: string, objectType?: string) {
    return (tileId && objectId
      ? tileApiInterface?.getTileApi(tileId)?.getObjectDefaultOffsets?.(objectId, objectType)
      : undefined)
      ?? OffsetModel.create({});
  }
  const sourceOffset = defaultOffset(sourceTileId, sourceObjectId, sourceObjectType);

  const previewArrowSourceX = sourceBoundingBox && sourceOffset
    ? sourceBoundingBox.left + sourceBoundingBox.width / 2 + sourceOffset.dx
    : undefined;
  const previewArrowSourceY = sourceBoundingBox && sourceOffset
    ? sourceBoundingBox.top + sourceBoundingBox.height / 2 + sourceOffset.dy
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
      const targetOffset = defaultOffset(tileId, objectId, objectType);
      let textOffset;
      if (targetBoundingBox) {
        const sourceX = sourceBoundingBox.left + sourceBoundingBox.width / 2;
        const sourceY = sourceBoundingBox.top + sourceBoundingBox.height / 2;
        const targetX = targetBoundingBox.left + targetBoundingBox.width / 2;
        const targetY = targetBoundingBox.top + targetBoundingBox.height / 2;
        const textX = sourceX + (targetX - sourceX) / 2;
        const textY = sourceY + (targetY - sourceY) / 2;
        const { peakDx, peakDy } = getDefaultPeak(sourceX, sourceY, targetX, targetY);
        // Bound the text offset to the document
        const _peakDx = Math.max(documentLeft - textX, Math.min(documentRight - textX, peakDx));
        const _peakDy = Math.max(documentTop - textY, Math.min(documentBottom - textY, peakDy));
        textOffset = OffsetModel.create({ dx: _peakDx, dy: _peakDy });
      }
      const newArrow = ArrowAnnotation.create({ sourceObject, sourceOffset, targetObject, targetOffset, textOffset });
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

  const rowIds = content?.rowOrder || [];
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
                      translateTilePointToScreenPoint={getTranslateTilePointToScreenPoint(rowId, tileInfo.tileId)}
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
              deleteArrow={(arrowId: string) => content?.deleteAnnotation(arrowId)}
              documentBottom={documentBottom}
              documentLeft={documentLeft}
              documentRight={documentRight}
              documentTop={documentTop}
              getBoundingBox={getBoundingBox}
              key={key}
              readOnly={readOnly}
            />
          );
        })}
        <PreviewArrow
          documentHeight={documentHeight}
          documentWidth={documentWidth}
          sourceX={previewArrowSourceX}
          sourceY={previewArrowSourceY}
          targetX={mouseX}
          targetY={mouseY}
        />
      </svg>
    </div>
  );
});
