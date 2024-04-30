import classNames from "classnames";
import { observer } from "mobx-react";
import React, { MouseEvent, MouseEventHandler, useContext, useEffect, useRef, useState } from "react";
import useResizeObserver from "use-resize-observer";
import { AnnotationButton } from "../annotations/annotation-button";
import { getDefaultPeak } from "../annotations/annotation-utilities";
import { ArrowAnnotationComponent } from "../annotations/arrow-annotation";
import { PreviewArrow } from "../annotations/preview-arrow";
import { TileApiInterfaceContext } from "../tiles/tile-api";
import { usePersistentUIStore, useUIStore } from "../../hooks/use-stores";
import { ArrowAnnotation } from "../../models/annotations/arrow-annotation";
import { ClueObjectModel, IClueObject, OffsetModel } from "../../models/annotations/clue-object";
import { DocumentContentModelType } from "../../models/document/document-content";
import { Point } from "../../utilities/math-utils";
import { hasSelectionModifier } from "../../utilities/event-utils";
import { HotKeys } from "../../utilities/hot-keys";

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
  const persistentUI = usePersistentUIStore();
  const tileApiInterface = useContext(TileApiInterfaceContext);
  const hotKeys = useRef(new HotKeys());

  useEffect(() => {
    if (!readOnly) {
      hotKeys.current.register({
        "delete": () => content?.deleteSelected(),
        "backspace": () => content?.deleteSelected()
      });
    }
  }, [content, readOnly]);

  function handleKeyDown(event: React.KeyboardEvent) {
    hotKeys.current.dispatch(event);
  }

  // Clicking to select annotations
  function handleArrowClick(arrowId: string, event: MouseEvent) {
    if (readOnly) return;
    event.stopPropagation();
    const annotation = content?.annotations.get(arrowId);
    if (annotation) {
      if (annotation.isSelected) {
        annotation.setSelected(false); // Toggle off
      } else {
        if (hasSelectionModifier(event)) {
          annotation.setSelected(true); // Toggle on
        } else {
          content?.selectAnnotations([arrowId]); // Select only this one
        }
      }
    }
  }

  // Clear selection and any partially completed annotation when the mode changes
  useEffect(() => {
    setSourceTileId("");
    setSourceObjectId("");
    setSourceObjectType(undefined);
    content?.selectAnnotations([]);
  }, [ui.annotationMode, content]);

  // Force rerenders when the layer's size changes
  useResizeObserver({ref: divRef, box: "border-box"});

  function getRowElement(rowId?: string) {
    if (rowId === undefined) return undefined;
    const rowSelector = `[data-row-id='${rowId}']`;
    const rowElements = canvasElement?.querySelectorAll(rowSelector);
    if (rowElements && rowElements.length === 1) {
      return rowElements[0] as HTMLElement;
    }
  }

  const documentWidth = canvasElement?.offsetWidth ?? 0;
  let documentHeight = 0;
  const rows = canvasElement?.getElementsByClassName("tile-row");
  if (rows) {
    Array.from(rows).forEach(row => {
      const boundingBox = row.getBoundingClientRect();
      documentHeight += boundingBox.height;
    });
  }
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

  const handleBackgroundClick: MouseEventHandler<HTMLDivElement> = event => {
    content?.selectAnnotations([]);
  };

  // Returns the x and y offset of the top left corner of a tile with respect to the document
  function getTileOffset(rowId: string, tileId: string): Point | undefined {
    const tileBorder = 2;

    const rowElement = getRowElement(rowId);
    if (!rowElement) return;

    const tileSelector = `[data-tool-id='${tileId}']`;
    const tileElements = canvasElement?.querySelectorAll(tileSelector);
    const tileElement = tileElements && tileElements.length === 1 ? tileElements[0] as HTMLElement : undefined;
    if (!tileElement) return;

    const x = rowElement.offsetLeft + tileElement.offsetLeft - tileElement.scrollLeft
      + tileBorder - (documentScrollX ?? 0);
    const y = rowElement.offsetTop + tileElement.offsetTop - tileElement.scrollTop
      + tileBorder - (documentScrollY ?? 0);
    return [x, y];
  }

  function getObjectNodeRadii(object?: IClueObject) {
    if (!object) return;
    const { tileId, objectId, objectType } = object;
    const tileApi = tileApiInterface?.getTileApi(tileId);
    return tileApi?.getObjectNodeRadii?.(objectId, objectType);
  }

  // Returns an object bounding box with respect to the containing tile
  function getObjectBoundingBox(tileId: string, objectId: string, objectType?: string) {
    const tileApi = tileApiInterface?.getTileApi(tileId);
    const objectBoundingBox = tileApi?.getObjectBoundingBox?.(objectId, objectType);
    return objectBoundingBox;
  }

  // Returns an object bounding box with respect to the containing document
  function getTileAdjustedBoundingBox(
    rowId: string, tileId: string, objectId: string, objectType?: string
  ) {
    const unadjustedBoundingBox = getObjectBoundingBox(tileId, objectId, objectType);
    if (!unadjustedBoundingBox) return;
    const tileOffset = getTileOffset(rowId, tileId);
    if (!tileOffset) return;

    const [left, top] = [unadjustedBoundingBox.left + tileOffset[0], unadjustedBoundingBox.top + tileOffset[1]];
    const height = unadjustedBoundingBox.height;
    const width = unadjustedBoundingBox.width;
    return { left, top, height, width };
  }

  // Returns an object bounding box with respect to the containing document without knowledge of the tile's row
  function getObjectBoundingBoxUnknownRow(
    tileId: string, objectId: string, objectType?: string
  ) {
    if (!content) return undefined;

    const rowId = content.findRowContainingTile(tileId);
    return getTileAdjustedBoundingBox(rowId ?? "", tileId, objectId, objectType);
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
  const previewArrowNodeRadii = getObjectNodeRadii(
    { tileId: sourceTileId, objectId: sourceObjectId, objectType: sourceObjectType }
  );

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
  const hidden = !persistentUI.showAnnotations;
  const classes = classNames("annotation-layer", { editing, hidden });
  return (
    <div
      className={classes}
      onMouseMove={handleMouseMove}
      onClick={handleBackgroundClick}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      ref={element => {
        if (element) divRef.current = element;
      }}
    >
      <svg className="annotation-svg" xmlnsXlink="http://www.w3.org/1999/xlink">
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
                      getTileOffset={() => getTileOffset(rowId, tileInfo.tileId)}
                      key={`${tile.id}-${objectId}-button`}
                      objectId={objectId}
                      objectType={objectType}
                      onClick={handleAnnotationButtonClick}
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
              deleteArrow={(arrowId: string) => content?.deleteAnnotation(arrowId)}
              handleArrowClick={handleArrowClick}
              documentBottom={documentBottom}
              documentLeft={documentLeft}
              documentRight={documentRight}
              documentTop={documentTop}
              getBoundingBox={getBoundingBox}
              getObjectNodeRadii={getObjectNodeRadii}
              key={key}
              readOnly={readOnly}
            />
          );
        })}
        <PreviewArrow
          documentHeight={documentHeight}
          documentWidth={documentWidth}
          sourceCenterRadius={previewArrowNodeRadii?.centerRadius}
          sourceHighlightRadius={previewArrowNodeRadii?.highlightRadius}
          sourceX={previewArrowSourceX}
          sourceY={previewArrowSourceY}
          targetX={mouseX}
          targetY={mouseY}
        />
      </svg>
    </div>
  );
});
