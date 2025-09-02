import classNames from "classnames";
import { ObservableMap } from "mobx";
import { observer } from "mobx-react";
import React, { MouseEvent, MouseEventHandler, useContext, useEffect, useRef, useState } from "react";
import useResizeObserver from "use-resize-observer";
import { useMemoOne } from "use-memo-one";
import { AnnotationButton } from "../annotations/annotation-button";
import { getParentWithTypeName } from "../../utilities/mst-utils";
import { getDefaultPeak, getParentOffsets, getRowOffsets, getTileOffsets,
  IParent } from "../annotations/annotation-utilities";
import { ArrowAnnotationComponent } from "../annotations/arrow-annotation";
import { PreviewArrow } from "../annotations/preview-arrow";
import { TileApiInterfaceContext } from "../tiles/tile-api";
import { useStores } from "../../hooks/use-stores";
import { ArrowAnnotation, ArrowShape, isArrowShape } from "../../models/annotations/arrow-annotation";
import { ClueObjectModel, IClueObject, IOffsetModel, ObjectBoundingBox, OffsetModel
} from "../../models/annotations/clue-object";
import { ITileModel } from "../../models/tiles/tile-model";
import { isRowListContainer } from "../../models/document/row-list";
import { DocumentContentModelType } from "../../models/document/document-content";
import { isFiniteNumber, midpoint, Point } from "../../utilities/math-utils";
import { hasSelectionModifier } from "../../utilities/event-utils";
import { HotKeys } from "../../utilities/hot-keys";
import { boundingBoxCenter } from "../../models/annotations/annotation-utils";
import { DrawingContentModelType } from "../../plugins/drawing/model/drawing-content";
import { calculateFitContent } from "../../plugins/drawing/model/drawing-utils";

import "./annotation-layer.scss";

interface IAnnotationLayerProps {
  canvasElement?: HTMLDivElement | null;
  content?: DocumentContentModelType;
  documentScrollX?: number;
  documentScrollY?: number;
  readOnly?: boolean;
  boundingBoxCache: ObservableMap<string, ObservableMap<string, ObjectBoundingBox>>;
}

export const AnnotationLayer = observer(function AnnotationLayer({
  canvasElement, content, documentScrollX, documentScrollY, readOnly, boundingBoxCache
}: IAnnotationLayerProps) {
  const [_initialized, setInitialized] = useState(false);
  useEffect(() => {
    // Forces the annotation layer to rerender after initial load, getting access to the locations of elements.
    setInitialized(true);
  }, []);
  const [sourceTileId, setSourceTileId] = useState("");
  const [sourceObjectId, setSourceObjectId] = useState("");
  const [sourceObjectType, setSourceObjectType] = useState<string | undefined>();
  const [sourcePoint, setSourcePoint] = useState<Point | undefined>();
  const [mouseX, setMouseX] = useState<number | undefined>();
  const [mouseY, setMouseY] = useState<number | undefined>();
  const [isBackgroundClick, setIsBackgroundClick] = useState(false);
  const divRef = useRef<Element|null>(null);
  const { ui, persistentUI } = useStores();
  const tileApiInterface = useContext(TileApiInterfaceContext);
  const hotKeys = useMemoOne(() => new HotKeys(), []);
  const shape: ArrowShape = isArrowShape(ui.annotationMode) ? ui.annotationMode : ArrowShape.curved;

  const editing = ui.annotationMode !== undefined;

  // Buttons are active unless a straight sparrow is being drawn from an object
  const showButtons = !(shape === ArrowShape.straight && sourceObjectId);
  // Drag handles are active while editing, unless any sort of sparrow is being drawn
  const showDragHandles = editing && !(sourceObjectId || sourcePoint);

  useEffect(() => {
    const deleteSelected = () => content?.deleteSelected();
    if (!readOnly) {
      hotKeys.register({
        "delete": () => deleteSelected(),
        "backspace": () => deleteSelected(),
        "escape": () => ui.setAnnotationMode()
      });
      // disposer, to deactivate these bindings in case we switch to read-only later.
      return () => {
        hotKeys.unregister(["delete", "backspace", "escape"]);
      };
    }
  }, [content, readOnly, hotKeys, ui]);

  function clearSource() {
    setSourceTileId("");
    setSourceObjectId("");
    setSourceObjectType(undefined);
    setSourcePoint(undefined);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    hotKeys.dispatch(event);
  }

  // Clicking to select annotations
  function handleArrowClick(arrowId: string, event: MouseEvent) {
    if (readOnly) return;
    event.stopPropagation();
    const annotation = content?.annotations.get(arrowId);
    if (annotation) {
      if (hasSelectionModifier(event)) {
        annotation.setSelected(!annotation.isSelected); // Toggle this one, leaving others as-is
      } else {
        content?.selectAnnotations([arrowId]); // Select only this one
      }
    }
  }

  // Clear selection and any partially completed annotation when the mode changes
  useEffect(() => {
    clearSource();
    content?.selectAnnotations([]);
  }, [ui.annotationMode, content]);

  // Force rerenders when the layer's size changes
  useResizeObserver({ref: divRef, box: "border-box"});

  function getDocumentScale(el?: HTMLElement | null) {
    if (!el) return 1;
    const s = el.getBoundingClientRect().width / el.offsetWidth;
    return isFiniteNumber(s) ? s : 1;
  }

  const scale = getDocumentScale(canvasElement);

  const documentWidth = canvasElement?.offsetWidth ?? 0;
  let documentHeight = 0;
  const rows = canvasElement?.getElementsByClassName("tile-row");
  if (rows) {
    Array.from(rows).forEach(row => {
      const boundingBox = row.getBoundingClientRect();
      documentHeight += (boundingBox.height / scale);
    });
  }
  const documentLeft = 0;
  const documentRight = documentWidth;
  const documentBottom = documentHeight - (documentScrollY ?? 0);
  const documentTop = -(documentScrollY ?? 0);

  const handleMouseDown: MouseEventHandler<HTMLDivElement> = event => {
    // We need to distinguish "real" clicks on the background (the annotation SVG).
    // If there is a mousedown on, say, a sparrow text label, followed by dragging it to a new position,
    // followed by a mouseup, a click event is sent to the AnnotationLayer. But we don't want to
    // consider that as a real background click & initiate drawing a sparrow.
    const isBackground = (event.target instanceof SVGElement) && event.target.classList.contains('annotation-svg');
    setIsBackgroundClick(isBackground);
  };

  const handleMouseMove = (event: { clientX: number, clientY: number }) => {
    if (divRef.current) {
      const bb = divRef.current.getBoundingClientRect();
      setMouseX(event.clientX - bb.left);
      setMouseY(event.clientY - bb.top);
    }
  };

  const handleBackgroundDoubleClick: MouseEventHandler<HTMLDivElement> = event => {
    // Make sure it's a click on the annotation-svg background, not bubbled up from a button
    if ((event.target as HTMLElement).classList.contains("annotation-svg")) {
      ui.setAnnotationMode();
    }
  };

  // Returns the x and y offset of the top left corner of a tile with respect to the document
  function getTileOffset (rowId: string, tileId: string, parent?: IParent): Point | undefined {
    if (!canvasElement) return;

    const kBorder = parent ? 4 : 2; // double the border if nested in question tile
    const kLeftBorder = parent ? 2 : 0; // question tiles have an extra 2 pixels of border on the left
    const scrollX = documentScrollX ?? 0;
    const scrollY = documentScrollY ?? 0;

    const rOffsets = getRowOffsets(canvasElement, rowId);
    const tOffsets = getTileOffsets(canvasElement, tileId);
    if (!rOffsets || !tOffsets) return;

    const pOffsets = parent ? getParentOffsets(canvasElement, parent.rowId, parent.tileId) : {left: 0, top: 0,};

    if (rOffsets && tOffsets) {
      const x = rOffsets.left + tOffsets.left + pOffsets.left - tOffsets.scrollLeft + kBorder + kLeftBorder - scrollX;
      const y = rOffsets.top + tOffsets.top + pOffsets.top - tOffsets.scrollTop + kBorder - scrollY;
      return [x, y];
    }
  }

  function getObjectNodeRadii(object?: IClueObject) {
    if (!object) return;
    const { tileId, objectId, objectType } = object;
    const tileApi = tileApiInterface?.getTileApi(tileId);
    return tileApi?.getObjectNodeRadii?.(objectId, objectType);
  }

  // Returns an object bounding box with respect to the containing tile
  function getObjectBoundingBox(tileId: string, objectId: string, objectType?: string) {
    // First check the cache.
    const cachedValue = boundingBoxCache.get(tileId)?.get(objectId);
    if (cachedValue) {
      return cachedValue;
    }
    const tileApi = tileApiInterface?.getTileApi(tileId);
    const objectBoundingBox = tileApi?.getObjectBoundingBox?.(objectId, objectType);
    return objectBoundingBox;
  }

  // Returns an object bounding box with respect to the containing document
  function getTileAdjustedBoundingBox(
    rowId: string, tileId: string, objectId: string, objectType?: string, parent?: IParent
  ) {
    const unadjustedBoundingBox = getObjectBoundingBox(tileId, objectId, objectType);
    if (!unadjustedBoundingBox) return;
    const tileOffset = getTileOffset(rowId, tileId, parent);
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

    const rowId = content.findRowIdContainingTile(tileId);
    if (!rowId) return undefined;

    // the tile might be nested inside of a question tile, so we need to find the parent tileId and rowId
    // to accurately calculate the bounding box and offsets
    let parentRowId = undefined;
    let parentTileId = undefined;

    const rowList = content.getRowListForRow(rowId);
    const parentQuestionTileModel = getParentWithTypeName(rowList, "TileModel");
    if (parentQuestionTileModel) {
      parentTileId = parentQuestionTileModel.id;
      parentRowId = content.findRowIdContainingTile(parentQuestionTileModel.id);
    }
    const parent = parentRowId && parentTileId ? { rowId: parentRowId, tileId: parentTileId } : undefined;
    return getTileAdjustedBoundingBox(rowId, tileId, objectId, objectType, parent);
  }

  let sourceBoundingBox: ObjectBoundingBox|undefined = undefined;
  if (sourceTileId && sourceObjectId) {
    sourceBoundingBox = getObjectBoundingBoxUnknownRow(sourceTileId, sourceObjectId, sourceObjectType);
  }
  if (sourcePoint) {
    sourceBoundingBox = { left: sourcePoint[0], top: sourcePoint[1], height: 0, width: 0 };
  }

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

  /**
   * Create an arrow annotation.
   * The source object is determined by the state variables.
   * The target object can be passed in as an argument, or if not provided,
   * it is the current mouse location.
   * @param targetObject
   */
  const createAnnotation = (targetObject?: IClueObject) => {
    // Determine source object/location based on state variables
    if (!sourceBoundingBox) return;
    const sourceCenter = boundingBoxCenter(sourceBoundingBox);
    const sourceObject = sourceObjectId
      ? ClueObjectModel.create({ tileId: sourceTileId, objectId: sourceObjectId, objectType: sourceObjectType })
      : undefined;

    // Determine target object/location based on input
    let targetCenter: Point, targetOffset: IOffsetModel;
    if (targetObject) {
      const targetBoundingBox = getObjectBoundingBoxUnknownRow(
        targetObject.tileId, targetObject.objectId, targetObject.objectType);
      if (!targetBoundingBox) return;
      targetCenter = boundingBoxCenter(targetBoundingBox);
      targetOffset = defaultOffset(targetObject.tileId, targetObject.objectId, targetObject.objectType);
    } else {
      // Target is the click location
      if (!mouseX || !mouseY) return;
      targetCenter = [mouseX, mouseY];
      // Since there is no target object, it is stored in the ArrowAnnotation as
      // an offset relative to the source location.
      targetOffset = OffsetModel.create(
        { dx: mouseX - sourceCenter[0], dy: mouseY - sourceCenter[1] });
    }

    // If the source object is not set, the source offset is relative to the target object.
    let _sourceOffset: IOffsetModel;
    if (sourceObject) {
      _sourceOffset = sourceOffset;
    } else {
      _sourceOffset = OffsetModel.create(
        { dx: sourceCenter[0] - targetCenter[0], dy: sourceCenter[1] - targetCenter[1] });
    }

    const { peakDx, peakDy } = getDefaultPeak(shape,
      sourceCenter[0], sourceCenter[1], targetCenter[0], targetCenter[1]);
    // Bound the text offset to the document
    const midPoint = midpoint(sourceCenter, targetCenter);
    const _peakDx = Math.max(documentLeft - midPoint[0], Math.min(documentRight - midPoint[0], peakDx));
    const _peakDy = Math.max(documentTop - midPoint[1], Math.min(documentBottom - midPoint[1], peakDy));
    const textOffset = OffsetModel.create({ dx: _peakDx, dy: _peakDy });

    const newArrow = ArrowAnnotation.create(
      { sourceObject, sourceOffset: _sourceOffset, targetObject, targetOffset, textOffset, shape });
    newArrow.setIsNew(true);
    content?.addArrow(newArrow);
  };

  const handleBackgroundClick: MouseEventHandler<HTMLDivElement> = event => {
    if (!isBackgroundClick) return;
    setIsBackgroundClick(false); // reset for next time.

    // Update the mouseX and mouseY state based on this new event
    handleMouseMove(event);

    if (shape === ArrowShape.straight) {
      if (sourceObjectId) {
        // Create an arrow from the source object to this X,Y location.
        createAnnotation();
        clearSource();

      } else if (sourcePoint) {
        // Source location is already selected; clear it.
        setSourcePoint(undefined);

      } else {
        // No source is selected. Store this as the source location.
        setSourcePoint([mouseX ?? 0, mouseY ?? 0]);
      }
    }

    // Clear any selected annotations.
    content?.selectAnnotations([]);
  };

  /**
   * Handle the case where a drag handle is clicked.
   * We treat a long-press or drag as an intention to move the handle,
   * but a quick click as an intention to create a new arrow.
   */
  const handleDragHandleNonDrag = (e: globalThis.MouseEvent,
      tileId?: string, objectId?: string, objectType?: string) => {
    // Verify that there is no source object
    if (sourceObjectId || sourcePoint) return;

    if (tileId && objectId) {
      // Set the source object to the clicked handle's object
      setSourceTileId(tileId);
      setSourceObjectId(objectId);
      setSourceObjectType(objectType);
    } else {
      if (shape === ArrowShape.straight) {
        // Must have clicked the free end of a straight arrow, which has no object.
        // Assuming we're in straight-arrow mode, start a new arrow with the free end here.
        handleMouseMove(e);
        setSourcePoint([mouseX ?? 0, mouseY ?? 0]);
      }
    }
  };

  const handleAnnotationButtonClick = (e: React.MouseEvent, tileId: string, objectId: string, objectType?: string) => {
    // If we are in straight arrow mode, and one object has already been
    // selected, then we ignore the object clicked on and create an arrow to this X,Y location.
    if (!showButtons) {
      createAnnotation();
      clearSource();
      return;
    }

    if (tileId === sourceTileId && objectId === sourceObjectId && objectType === sourceObjectType) {
      // This object is already selected as the source object, so deselect it
      clearSource();
      return;
    }

    if (!sourceBoundingBox) {
      // We don't have a source object yet, so make this one the source object
      setSourceTileId(tileId);
      setSourceObjectId(objectId);
      setSourceObjectType(objectType);

    } else {
      // Create an arrow from the source (object or location) to this object
      const targetObject = ClueObjectModel.create({ tileId, objectId, objectType });
      createAnnotation(targetObject);
      clearSource();
    }
  };

  const getBoundingBox = (object: IClueObject) => {
    return getObjectBoundingBoxUnknownRow(object.tileId, object.objectId, object.objectType);
  };

  const getTileViewTransform = (tileId: string) => {
    if (!content) return undefined;

    const rowId = content.findRowIdContainingTile(tileId);
    if (!rowId) return undefined;

    const row = content.getRowRecursive(rowId);
    if (!row) return undefined;

    const tile = content.tileMap?.get(tileId);
    if (!tile) return undefined;

    if (tile.content && "zoom" in tile.content && "offsetX" in tile.content && "offsetY" in tile.content) {
      let transform;

      if (readOnly) {
        const drawingContent = tile.content as DrawingContentModelType;
        const contentBoundingBox = drawingContent.objectsBoundingBox;
        const tileApi = tileApiInterface?.getTileApi(tileId);

        if (tileApi && tileApi.getTileDimensions && contentBoundingBox) {
          const { width: tileWidth, height: tileHeight } = tileApi.getTileDimensions();
          const canvasSize = { x: tileWidth, y: tileHeight }
          const fitContentOptions = {
            canvasSize,
            contentBoundingBox,
            minZoom: 0.1,
            maxZoom: 1,
            readOnly
          }
          const { offsetX, offsetY, zoom } = calculateFitContent(fitContentOptions);

          transform = {
            scale: zoom,
            offsetX: offsetX,
            offsetY: offsetY
          };
        } else {
          // Fallback to stored values if no bounding box
          transform = {
            scale: drawingContent.zoom,
            offsetX: drawingContent.offsetX,
            offsetY: drawingContent.offsetY
          };
        }
      } else {
        transform = {
          scale: (tile.content as any).zoom,
          offsetX: (tile.content as any).offsetX,
          offsetY: (tile.content as any).offsetY
        };
      }

      return transform;
    }

    return undefined;
  };

  const rowIds = content?.rowOrder || [];
  const hidden = !persistentUI.showAnnotations;
  const classes = classNames("annotation-layer",
    { editing, hidden, 'show-buttons': showButtons, 'show-handles': showDragHandles });

  const renderAnnotationButtons = (params: {
    tile: ITileModel;
    rowId: string;
    tileId: string;
    parentOffsetParams?: { rowId: string; tileId: string };
  }) => {
    const { tile, rowId, tileId, parentOffsetParams } = params;

    return tile.content.annotatableObjects.map(({ objectId, objectType }) => (
      <AnnotationButton
        key={`${tile.id}-${objectId}-button`}
        getObjectBoundingBox={getObjectBoundingBox}
        getTileOffset={() => getTileOffset(rowId, tileId, parentOffsetParams)}
        objectId={objectId}
        objectType={objectType}
        onClick={handleAnnotationButtonClick}
        sourceObjectId={sourceObjectId}
        sourceTileId={sourceTileId}
        tileId={tile.id}
      />
    ));
  };

  const collectButtonsForRow = (
    rowId: string,
    parentOffsetParams?: { rowId: string; tileId: string },
  ): JSX.Element[] => {

    const docContent = content;
    const row = docContent?.getRowRecursive(rowId);

    if (!row) return [];
    return row.tiles.flatMap((tileInfo) => {
      const tile = docContent?.tileMap?.get(tileInfo.tileId);
      if (!tile) return [];

      // Container tile: dive into its own rows
      if (isRowListContainer(tile.content)) {
        const newParentOffset = { rowId, tileId: tile.id };
        return tile.content.rowOrder.flatMap((nestedRowId) => {
          return collectButtonsForRow(nestedRowId, newParentOffset);
        });
      }

      // Regular tile: render buttons
      return renderAnnotationButtons({
        tile,
        rowId,
        tileId: tileInfo.tileId,
        parentOffsetParams
      });

    });
  };

  return (
    <div
      className={classes}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onClick={handleBackgroundClick}
      onDoubleClick={handleBackgroundDoubleClick}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      ref={element => {
        if (element) divRef.current = element;
      }}
    >
      <svg className="annotation-svg">
        { editing && !readOnly && rowIds.flatMap(rowId => collectButtonsForRow(rowId)) }
        { Array.from(content?.annotations.values() ?? []).map(arrow => {
          const key = `sparrow-${arrow.id}`;

          // Get view transformation for the source tile if it exists
          const sourceViewTransform = arrow.sourceObject?.tileId ?
            getTileViewTransform(arrow.sourceObject.tileId) : undefined;

          // Get view transformation for the target tile if it exists
          const targetViewTransform = arrow.targetObject?.tileId ?
            getTileViewTransform(arrow.targetObject.tileId) : undefined;

          // Use source view transform if available, otherwise use target
          const viewTransform = sourceViewTransform || targetViewTransform;

          return (
            <ArrowAnnotationComponent
              arrow={arrow}
              canEdit={!readOnly && editing}
              deleteArrow={(arrowId: string) => content?.deleteAnnotation(arrowId)}
              handleArrowClick={handleArrowClick}
              handleDragHandleNonDrag={handleDragHandleNonDrag}
              documentBottom={documentBottom}
              documentLeft={documentLeft}
              documentRight={documentRight}
              documentTop={documentTop}
              getBoundingBox={getBoundingBox}
              getObjectNodeRadii={getObjectNodeRadii}
              key={key}
              readOnly={readOnly}
              viewTransform={viewTransform}
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
          shape={shape}
        />
      </svg>
    </div>
  );
});
