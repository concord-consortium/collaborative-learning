import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "./base";
import { DocumentContentModelType } from "../models/document-content";
import { TileRowComponent, kDragResizeRowId, extractDragResizeRowId, extractDragResizeY,
        extractDragResizeModelHeight, extractDragResizeDomHeight } from "./document/tile-row";
import { kDragTileSource, kDragTileId, kDragTileContent,
        dragTileSrcDocId, kDragRowHeight } from "./canvas-tools/tool-tile";

import "./document-content.sass";

interface IProps extends IBaseProps {
  context: string;
  content?: DocumentContentModelType;
  readOnly?: boolean;
}

interface IState {
  dragResizeRow?: {
    id: string;
    modelHeight?: number;
    domHeight?: number;
    deltaHeight: number;
  } | null;
  dragDropInfo?: IDropRowInfo;
}

// Interval in ms between recalculation for highlighting drag/drop zones
const kDragUpdateInterval = 200;

@inject("stores")
@observer
export class DocumentContentComponent extends BaseComponent<IProps, IState> {

  public state: IState = {};

  private domElement: HTMLElement | null;
  private mutationObserver: MutationObserver;

  public componentDidMount() {
    if (this.domElement && (window as any).MutationObserver) {
      this.mutationObserver = new MutationObserver(this.handleRowElementsChanged);
      this.mutationObserver.observe(this.domElement, { childList: true });
    }
  }

  public componentWillUnmount() {
    this.mutationObserver.disconnect();
  }

  public render() {
    return (
      <div className="document-content"
        onClick={this.handleClick}
        onDragOver={this.handleDragOver}
        onDragEnd={this.handleDragEnd}
        onDrop={this.handleDrop}
        ref={(elt) => this.domElement = elt}
      >
        {this.renderRows()}
        {this.props.children}
      </div>
    );
  }

  private getRowHeight(rowId: string) {
    const { content } = this.props;
    if (!content) return;
    const { rowMap } = content;
    const row = rowMap.get(rowId);
    const { dragResizeRow } = this.state;
    const dragResizeRowId = dragResizeRow && dragResizeRow.id;
    if (rowId !== dragResizeRowId) {
      return row && row.height;
    }
    const rowHeight = dragResizeRow && (dragResizeRow.domHeight || dragResizeRow.modelHeight);
    if (!dragResizeRow || !rowHeight) return;
    return rowHeight + dragResizeRow.deltaHeight;
  }

  private renderRows() {
    const { content, ...others } = this.props;
    const { dragDropInfo } = this.state;
    if (!content) { return null; }
    const { rowMap, rowOrder, tileMap } = content;
    let tabIndex = 1;
    return rowOrder.map(rowId => {
      const row = rowMap.get(rowId);
      const rowHeight = this.getRowHeight(rowId);
      const _tabIndex = tabIndex;
      tabIndex += row ? row.tiles.length : 0;
      return row
              ? <TileRowComponent key={row.id} docId={content.contentId} model={row}
                                  height={rowHeight} tileMap={tileMap} dragDropInfo={dragDropInfo}
                                  tabIndex={_tabIndex} {...others} />
              : null;
    });
  }

  private handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const { ui } = this.stores;
    // deselect tiles on click on document background
    // click must be on DocumentContent itself, not bubble up from child
    if (e.target === e.currentTarget) {
      ui.setSelectedTile();
    }
  }

  private handleRowElementsChanged = (mutationsList: MutationRecord[], mutationsObserver: MutationObserver) => {
    if (!this.domElement) return;

    for (const mutation of mutationsList) {
      if (mutation.type === "childList") {
        // auto-scroll to new tile rows
        if (mutation.addedNodes.length) {
          const newRow = mutation.addedNodes[mutation.addedNodes.length - 1] as Element;
          const newRowBounds = newRow.getBoundingClientRect();
          const contentBounds = this.domElement.getBoundingClientRect();
          const visibleContent = {
                  top: this.domElement.scrollTop,
                  bottom: this.domElement.scrollTop + contentBounds.height
                };
          const newRowInContent = {
                  top: newRowBounds.top - contentBounds.top + this.domElement.scrollTop,
                  bottom: newRowBounds.bottom - contentBounds.top + this.domElement.scrollTop
                };
          const kScrollTopMargin = 2;
          const kScrollBottomMargin = 10;
          if (newRowInContent.bottom > visibleContent.bottom) {
            this.domElement.scrollTop += newRowInContent.bottom + kScrollBottomMargin - visibleContent.bottom;
          }
          else if (newRowInContent.top < visibleContent.top) {
            this.domElement.scrollTop += newRowInContent.top - kScrollTopMargin - visibleContent.top;
          }
        }
      }
    }
  }

  private hasDragType(dataTransfer: DataTransfer, type: string) {
    return dataTransfer.types.findIndex(t => t === type) >= 0;
  }

  private getDragResizeRowInfo(e: React.DragEvent<HTMLDivElement>) {
    const rowId = extractDragResizeRowId(e.dataTransfer);
    const startY = extractDragResizeY(e.dataTransfer);
    const modelHeight = extractDragResizeModelHeight(e.dataTransfer);
    const domHeight = extractDragResizeDomHeight(e.dataTransfer);
    const deltaHeight = e.clientY - (startY || 0);
    if (rowId && (deltaHeight != null)) {
      const originalHeight = domHeight || modelHeight;
      const newHeight = originalHeight && originalHeight + deltaHeight;
      return { id: rowId, modelHeight, domHeight, deltaHeight, newHeight };
    }
  }

  private handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    const { content, readOnly } = this.props;
    const { dragDropInfo } = this.state;

    if (!content || readOnly) return;
    const withinDocument = this.hasDragType(e.dataTransfer, dragTileSrcDocId(content.contentId));
    if (this.hasDragType(e.dataTransfer, kDragTileContent)) {
      e.dataTransfer.dropEffect = withinDocument && !e.altKey ? "move" : "copy";
      // indicate where we'll accept the drop - throttle this update
      const now = new Date().getTime();
      if (!dragDropInfo || !dragDropInfo.lastUpdate || (now - dragDropInfo.lastUpdate > kDragUpdateInterval)) {
        const currentDragDropInfo = this.getDropRowInfo(e);
        this.setState({ dragDropInfo: currentDragDropInfo });
      }
      e.preventDefault();
    }
    else if (withinDocument && this.hasDragType(e.dataTransfer, kDragResizeRowId)) {
      const dragResizeRow = this.getDragResizeRowInfo(e);
      if (dragResizeRow && dragResizeRow.id && dragResizeRow.newHeight != null) {
        this.setState({ dragResizeRow });
      }
      // indicate we'll accept the drop
      e.dataTransfer.dropEffect = "move";
      e.preventDefault();
    }
  }
  private handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    this.setState({ dragDropInfo: undefined });
  }
  private isPointInRect(x: number, y: number, rect: ClientRect | DOMRect) {
    if ((x == null) || !isFinite(x) || (y == null) || !isFinite(y)) return false;
    return ((x >= rect.left) && (x <= rect.right) && (y >= rect.top) && (y <= rect.bottom));
  }

  private getDropRowInfo = (e: React.DragEvent<HTMLDivElement>) => {
    const { content } = this.props;
    if (!this.domElement) return { rowInsertIndex: content ? content.rowOrder.length : 0 };

    const dropInfo: IDropRowInfo = {
      rowInsertIndex: 0
    };
    const rowElements = this.domElement.getElementsByClassName("tile-row");
    const dropY = e.clientY;
    let dropDistance = Infinity;
    let dist;
    for (let i = 0; i < rowElements.length; ++i) {
      const rowElt = rowElements[i];
      const rowBounds = rowElt.getBoundingClientRect();
      if (i === 0) {
        dist = Math.abs(dropY - rowBounds.top);
        dropInfo.rowInsertIndex = i;
        dropDistance = dist;
      }
      dist = Math.abs(dropY - rowBounds.bottom);
      if (dist < dropDistance) {
        dropInfo.rowInsertIndex = i + 1;
        dropDistance = dist;
      }
      if (this.isPointInRect(e.clientX, e.clientY, rowBounds)) {
        dropInfo.rowDropIndex = i;
        dropInfo.dropOffsetLeft = Math.abs(e.clientX - rowBounds.left);
        dropInfo.dropOffsetTop = Math.abs(e.clientY - rowBounds.top);
        dropInfo.dropOffsetRight = Math.abs(rowBounds.right - e.clientX);
        dropInfo.dropOffsetBottom = Math.abs(rowBounds.bottom - e.clientY);
      }
    }
    dropInfo.lastUpdate = new Date().getTime();
    return dropInfo;
  }

  private handleRowResizeDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const { content } = this.props;
    const dragResizeRow = this.getDragResizeRowInfo(e);
    if (content && dragResizeRow && dragResizeRow.id && dragResizeRow.newHeight != null) {
      const row = content.rowMap.get(dragResizeRow.id);
      row && row.setRowHeight(dragResizeRow.newHeight);
      this.setState({ dragResizeRow: null, dragDropInfo: undefined });
    }
  }

  private handleMoveTileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const kSideDropThreshold = 20;
    const { content } = this.props;
    if (!content) return;
    const dragTileId = e.dataTransfer.getData(kDragTileId);
    const srcRowId = content.findRowContainingTile(dragTileId);
    if (!srcRowId) return;
    const srcRowIndex = content.rowOrder.findIndex(rowId => rowId === srcRowId);
    const dropRowInfo  = this.getDropRowInfo(e);
    const { rowInsertIndex, rowDropIndex, dropOffsetLeft, dropOffsetRight } = dropRowInfo;
    if ((rowDropIndex != null) &&
        (dropOffsetLeft != null) &&
        (dropOffsetLeft < kSideDropThreshold) &&
        (dropOffsetLeft < dropOffsetRight!)) {
      content.moveTileToRow(dragTileId, rowDropIndex, 0);
      return;
    }
    if ((rowDropIndex != null) &&
        (dropOffsetRight != null) &&
        (dropOffsetRight < kSideDropThreshold) &&
        (dropOffsetRight <= dropOffsetLeft!)) {
      content.moveTileToRow(dragTileId, rowDropIndex);
      return;
    }

    if ((srcRowIndex >= 0)) {
      if (content.numTilesInRow(srcRowId) === 1) {
        if (rowInsertIndex !== srcRowIndex) {
          content.moveRowToIndex(srcRowIndex, rowInsertIndex);
        }
      }
      else {
        content.moveTileToNewRow(dragTileId, rowInsertIndex);
      }
    }
  }

  private handleCopyTileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const { content } = this.props;
    const dragTileContent = e.dataTransfer.getData(kDragTileContent);
    if (!content || !dragTileContent) return;
    const dragTileId = e.dataTransfer.getData(kDragTileId);
    const { rowInsertIndex } = this.getDropRowInfo(e);
    let dragRowHeight;
    if (e.dataTransfer.getData(kDragRowHeight)) {
      dragRowHeight = +e.dataTransfer.getData(kDragRowHeight);
    }
    content.copyTileIntoRow(dragTileContent, dragTileId, rowInsertIndex, dragRowHeight);
  }

  private handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const { content, readOnly } = this.props;
    const dragSrc = e.dataTransfer.getData(kDragTileSource);
    const dragTileId = e.dataTransfer.getData(kDragTileId);
    const dragTileContent = e.dataTransfer.getData(kDragTileContent);
    this.setState({ dragDropInfo: undefined });

    if (!content || readOnly) return;

    if (this.hasDragType(e.dataTransfer, kDragResizeRowId)) {
      this.handleRowResizeDrop(e);
      return;
    }

    e.preventDefault();

    // handle drop within document - reorder tiles/rows
    if (dragTileId && (dragSrc === content.contentId) && !e.altKey) {
      this.handleMoveTileDrop(e);
      return;
    }

    // handle drop - copy contents to new row
    if (dragTileContent) {
      this.handleCopyTileDrop(e);
    }
  }

}

export interface IDropRowInfo {
  rowInsertIndex: number;
  rowDropIndex?: number;
  dropOffsetLeft?: number;
  dropOffsetTop?: number;
  dropOffsetRight?: number;
  dropOffsetBottom?: number;
  lastUpdate?: number;
}
