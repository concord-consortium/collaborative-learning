import classNames from "classnames";
import React, { useContext, useRef, useState, forwardRef, useCallback, useImperativeHandle, useEffect } from "react";
import { getParentOfType } from "mobx-state-tree";
import { observer } from "mobx-react";
import { TileLayoutModelType, TileRowModelType } from "../../models/document/tile-row";
import { getTileContentInfo } from "../../models/tiles/tile-content-info";
import { ITileModel } from "../../models/tiles/tile-model";
import { SectionHeader } from "../tiles/section-header";
import { TileApiInterfaceContext } from "../tiles/tile-api";
import { TileComponent, dragTileSrcDocId } from "../tiles/tile-component";
import { useStores } from "../../hooks/use-stores";
import { DocumentContentModel } from "../../models/document/document-content";

import resizeDragIcon from "../../assets/resize-drag-icon.png";

import "./tile-row.scss";

export const kDragResizeRowId = "org.concord.clue.row-resize.id";
// allows source compatibility to be checked in dragOver
export const dragResizeRowId = (id: string) => `org.concord.clue.row-resize.id.${id}`;
export const dragResizeRowY =
              (y: number) => `org.concord.clue.row-resize.event-y.${y}`;
export const dragResizeRowModelHeight =
              (modelHeight: number) => `org.concord.clue.row-resize.model-height.${modelHeight}`;
export const dragResizeRowDomHeight =
              (domHeight: number) => `org.concord.clue.row-resize.dom-height.${domHeight}`;

export function extractDragResizeRowId(dataTransfer: DataTransfer) {
  // get the actual rowId from contents if possible (e.g. on drop)
  const dragRowId = dataTransfer.getData(kDragResizeRowId);
  if (dragRowId) return dragRowId;

  // if not, extract the toLowerCase() version from the key (e.g. on over)
  for (const type of dataTransfer.types) {
    const result = /org\.concord\.clue\.row-resize\.id\.(.*)$/.exec(type);
    if (result) return result[1];
  }
}

export function extractDragResizeY(dataTransfer: DataTransfer) {
  for (const type of dataTransfer.types) {
    const result = /org\.concord\.clue\.row-resize\.event-y\.(.*)$/.exec(type);
    if (result) return +result[1];
  }
}

export function extractDragResizeModelHeight(dataTransfer: DataTransfer) {
  for (const type of dataTransfer.types) {
    const result = /org\.concord\.clue\.row-resize\.model-height\.(.*)$/.exec(type);
    if (result) return +result[1];
  }
}

export function extractDragResizeDomHeight(dataTransfer: DataTransfer) {
  for (const type of dataTransfer.types) {
    const result = /org\.concord\.clue\.row-resize\.dom-height\.(.*)$/.exec(type);
    if (result) return +result[1];
  }
}

interface IProps {
  context: string;
  documentId?: string;  // permanent id (key) of the containing document
  docId: string;  // ephemeral contentId for the DocumentContent
  documentContent: HTMLElement | null;
  typeClass?: string;
  scale?: number;
  model: TileRowModelType;
  rowIndex: number;
  height?: number;
  readOnly?: boolean;
  dropHighlight?: string;
}

interface IState {
  tileAcceptDrop?: string;
}

export interface TileRowHandle {
  id: string;
  tileRowDiv: HTMLDivElement | null;
  hasTile: (tileId?: string) => boolean;
}

const TileRowComponent = forwardRef<TileRowHandle, IProps>((props, ref) => {
  const { model, typeClass, height: propHeight, readOnly, dropHighlight } = props;
  const stores = useStores();
  const [state, setState] = useState<IState>({});
  const tileRowDiv = useRef<HTMLDivElement | null>(null);
  const tileApiInterface = useContext(TileApiInterfaceContext);
  const isSectionHeader = model.isSectionHeader;

  const documentContentModel = getParentOfType(model, DocumentContentModel);
  const tileMap = documentContentModel?.tileMap;

  // Image to use as the image dragged when user operates the resize handle.
  // Note we used to use a transparent pixel, but in the Chromebook browser
  // this resulted in an immediate dragEnd when the image was set.
  const dragImage = useRef<HTMLImageElement>(document.createElement("img"));
  useEffect(() => {
    dragImage.current.src = resizeDragIcon;
  }, []);

  if (!tileMap) {
    throw new Error("Tile map not found");
  }

  // Expose the required methods and properties to the parent component
  useImperativeHandle(ref, () => ({
    id: model.id,
    get tileRowDiv() {
      return tileRowDiv.current;
    },
    hasTile(tileId?: string) {
      return tileId ? model.hasTile(tileId) : false;
    }
  }), [model]);

  const getTile = useCallback((tileId: string) => {
    return tileMap.get(tileId) as ITileModel | undefined;
  }, [tileMap]);

  const isTileRenderable = useCallback((tileId: string) => {
    const tile = getTile(tileId);
    return !!tile && (!tile.display || stores.isShowingTeacherContent);
  }, [getTile, stores.isShowingTeacherContent]);

  const getTileWidth = useCallback((tileId: string, tiles: TileLayoutModelType[]) => {
    return 100 / (tiles.length || 1);
  }, []);

  const getContentHeight = useCallback(() => {
    return model.getContentHeight((tileId: string) => {
      const tileApi = tileApiInterface?.getTileApi(tileId);
      const contentHeight = tileApi?.getContentHeight?.();
      if (contentHeight) return contentHeight;
      // otherwise, use the default height for this type of tile
      const tile = getTile(tileId);
      const tileType = tile?.content.type;
      const contentInfo = getTileContentInfo(tileType);
      if (contentInfo?.defaultHeight) return contentInfo.defaultHeight;
    });
  }, [model, tileApiInterface, getTile]);

  const handleSetCanAcceptDrop = useCallback((tileId?: string) => {
    setState({ tileAcceptDrop: tileId });
  }, []);

  const handleRequestRowHeight = useCallback((tileId: string, ht?: number, deltaHeight?: number) => {
    const { height, tileCount, setRowHeightWithoutUndo } = model;
    const newHeight = ht != null && deltaHeight != null
                        ? ht + deltaHeight
                        : ht;
    // don't shrink the height of a multi-tile row based on a request from a single tile
    if ((tileCount > 1) && (height != null) && (newHeight != null) && (newHeight < height)) return;
    (newHeight != null) && setRowHeightWithoutUndo(newHeight);
  }, [model]);

  const handleStartResizeRow = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    const { docId } = props;
    const { id } = model;

    e.dataTransfer.setDragImage(dragImage.current, 0, 0);
    e.dataTransfer.setData(dragTileSrcDocId(docId), docId);
    e.dataTransfer.setData(kDragResizeRowId, id);
    e.dataTransfer.setData(dragResizeRowId(id), id);
    e.dataTransfer.setData(dragResizeRowY(e.clientY), String(e.clientY));
    if (model.height) {
      e.dataTransfer.setData(dragResizeRowModelHeight(model.height), String(model.height));
    }
    if (tileRowDiv.current) {
      const boundingBox = tileRowDiv.current.getBoundingClientRect();
      e.dataTransfer.setData(dragResizeRowDomHeight(boundingBox.height), String(boundingBox.height));
    }
  }, [props, model, dragImage]);

  const renderTiles = useCallback((tileRefs: TileLayoutModelType[], tileHeight?: number) => {
    const { docId, documentContent, scale, documentId } = props;
    return tileRefs.map((tileRef, index) => {
      const tileModel = getTile(tileRef.tileId);
      const tileWidthPct = getTileWidth(tileRef.tileId, tileRefs);
      return tileModel
        ? <TileComponent
            key={tileModel.id}
            indexInRow={index}
            model={tileModel}
            widthPct={tileWidthPct}
            height={tileHeight}
            isUserResizable={!readOnly && model.isUserResizable}
            onResizeRow={handleStartResizeRow}
            onSetCanAcceptDrop={handleSetCanAcceptDrop}
            onRequestRowHeight={handleRequestRowHeight}
            documentId={documentId}
            docId={docId}
            documentContent={documentContent}
            scale={scale}
            readOnly={readOnly}
            context={props.context}
        />
        : null;
    });
  }, [props, getTile, getTileWidth, readOnly, model.isUserResizable,
    handleStartResizeRow, handleSetCanAcceptDrop, handleRequestRowHeight]);

  const renderDragDropHandles = useCallback(() => {
    const { isUserResizable } = model;
    const { rowIndex } = props;
    const highlight = state.tileAcceptDrop ? undefined : dropHighlight;
    const showTopHighlight = (highlight === "top") && (!isSectionHeader || (rowIndex > 0));
    const showLeftHighlight = (highlight === "left") && !isSectionHeader;
    const showRightHighlight = (highlight === "right") && !isSectionHeader;
    const showBottomHighlight = (highlight === "bottom");

    return [
      <div key="top-drop-feedback"
          className={`drop-feedback top ${showTopHighlight ? "show" : ""}`} />,
      <div key="left-drop-feedback"
          className={`drop-feedback left ${showLeftHighlight ? "show" : ""}`} />,
      <div key="right-drop-feedback"
          className={`drop-feedback right ${showRightHighlight ? "show" : ""}`} />,
      <div key="bottom-drop-feedback"
          className={`drop-feedback bottom ${showBottomHighlight ? "show" : ""}`} />,
      <div key="bottom-resize-handle"
        className={`bottom-resize-handle ${isUserResizable ? "enable" : "disable"}`}
        draggable={isUserResizable}
        onDragStart={isUserResizable ? handleStartResizeRow : undefined} />
    ];
  }, [model, props, state.tileAcceptDrop, dropHighlight, isSectionHeader, handleStartResizeRow]);

  const { sectionId, tiles: modelTiles } = model;
  const rowHeight = !isSectionHeader
                    ? propHeight || model.height || getContentHeight()
                    : undefined;
  const style = rowHeight ? { height: rowHeight } : undefined;
  const renderableTiles = modelTiles?.filter(tile => isTileRenderable(tile.tileId));
  const hasTeacherTiles = modelTiles.some(tile => getTile(tile.tileId)?.display === "teacher");
  const classes = classNames("tile-row", { "has-teacher-tiles": hasTeacherTiles });
  if (!isSectionHeader && !renderableTiles.length) return null;

  return (
    <div className={classes} data-row-id={model.id}
        style={style} ref={tileRowDiv}>
      { isSectionHeader && sectionId
        ? <SectionHeader type={sectionId} typeClass={typeClass}/>
        : renderTiles(renderableTiles, rowHeight)
      }
      {!readOnly && renderDragDropHandles()}
    </div>
  );
});

TileRowComponent.displayName = "TileRowComponent";

export default observer(TileRowComponent);
