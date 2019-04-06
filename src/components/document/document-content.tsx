import { inject, observer } from "mobx-react";
import * as React from "react";
import { findDOMNode } from "react-dom";
import { throttle } from "lodash";
import { BaseComponent, IBaseProps } from "../base";
import { DocumentContentModelType } from "../../models/document/document-content";
import { DocumentTool } from "../../models/document/document";
import { TileRowComponent, kDragResizeRowId, extractDragResizeRowId, extractDragResizeY,
        extractDragResizeModelHeight, extractDragResizeDomHeight } from "../document/tile-row";
import { kDragTileSource, kDragTileId, kDragTileContent,
        dragTileSrcDocId, kDragRowHeight, kDragTileCreate, IToolApiMap } from "../tools/tool-tile";

import "./document-content.sass";

interface IProps extends IBaseProps {
  context: string;
  content?: DocumentContentModelType;
  readOnly?: boolean;
  scale?: number;
  toolApiMap?: IToolApiMap;
}

interface IDragResizeRow {
  id: string;
  modelHeight?: number;
  domHeight?: number;
  deltaHeight: number;
}

export interface IDropRowInfo {
  rowInsertIndex: number;
  rowDropIndex?: number;
  rowDropLocation?: string;
  updateTimestamp?: number;
}

interface IState {
  dragResizeRow?: IDragResizeRow;
  dropRowInfo?: IDropRowInfo;
}
// Interval in ms between recalculation for highlighting drag/drop zones
const kDragUpdateInterval = 50;

@inject("stores")
@observer
export class DocumentContentComponent extends BaseComponent<IProps, IState> {

  public state: IState = {};

  private domElement: HTMLElement | null;
  private rowRefs: Array<TileRowComponent | null>;
  private mutationObserver: MutationObserver;

  public componentDidMount() {
    if (this.domElement) {
      this.domElement.addEventListener("scroll", throttle(this.updateVisibleRows, 100));
      this.updateVisibleRows();

      if ((window as any).MutationObserver) {
        this.mutationObserver = new MutationObserver(this.handleRowElementsChanged);
        this.mutationObserver.observe(this.domElement, { childList: true });
      }
    }
  }

  public componentWillUnmount() {
    this.mutationObserver.disconnect();
  }

  public componentDidUpdate() {
    // recalculate after render
    requestAnimationFrame(() => {
      this.updateVisibleRows();
    });
  }

  public render() {
    return (
      <div className="document-content"
        onClick={this.handleClick}
        onDragOver={this.handleDragOver}
        onDragLeave={this.handleDragLeave}
        onDrop={this.handleDrop}
        ref={(elt) => this.domElement = elt}
      >
        {this.renderRows()}
        {this.props.children}
        {this.renderSpacer()}
      </div>
    );
  }

  // updates the list of all row we can see the bottom of
  private updateVisibleRows = () => {
    const { content } = this.props;

    if (!this.domElement || !content) return;

    const contentBounds = this.domElement.getBoundingClientRect();
    function isElementInViewport(el: Element) {
      const rect = el.getBoundingClientRect();

      return (rect.bottom > contentBounds.top &&
              rect.bottom < contentBounds.bottom);
    }

    const visibleRowIds: string[] = [];
    this.rowRefs.forEach((ref) => {
      if (ref) {
        const rowNode = findDOMNode(ref);
        if (isElementInViewport(rowNode as Element)) {
          visibleRowIds.push(ref.props.model.id);
        }
      }
    });
    content.setVisibleRows(visibleRowIds);
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
    const { content, toolApiMap, ...others } = this.props;
    if (!content) { return null; }
    const { rowMap, rowOrder, tileMap, highlightPendingDropLocation } = content;
    const { dropRowInfo } = this.state;
    this.rowRefs = [];
    return rowOrder.map((rowId, index) => {
      const row = rowMap.get(rowId);
      const rowHeight = this.getRowHeight(rowId);
      let dropHighlight = dropRowInfo && (dropRowInfo.rowDropIndex != null) &&
                            (dropRowInfo.rowDropIndex === index) &&
                            dropRowInfo.rowDropLocation
                              ? dropRowInfo.rowDropLocation
                              : undefined;
      if (!dropHighlight && index === highlightPendingDropLocation) {
        dropHighlight = "bottom";
      }
      return row
              ? <TileRowComponent key={row.id} docId={content.contentId} model={row}
                                  height={rowHeight} tileMap={tileMap}
                                  dropHighlight={dropHighlight}
                                  toolApiMap={toolApiMap}
                                  ref={(elt) => this.rowRefs.push(elt)} {...others} />
              : null;
    });
  }

  private renderSpacer = () => {
    return this.props.readOnly ? null : <div className="spacer" />;
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
    const { scale } = this.props;
    const rowId = extractDragResizeRowId(e.dataTransfer);
    const startY = extractDragResizeY(e.dataTransfer);
    const modelHeight = extractDragResizeModelHeight(e.dataTransfer);
    const _domHeight = extractDragResizeDomHeight(e.dataTransfer);
    const domHeight = _domHeight && _domHeight / (scale || 1);
    const deltaHeight = (e.clientY - (startY || 0)) / (scale || 1);
    if (rowId && (deltaHeight != null)) {
      const originalHeight = domHeight || modelHeight;
      const newHeight = originalHeight && originalHeight + deltaHeight;
      return { id: rowId, modelHeight, domHeight, deltaHeight, newHeight };
    }
  }

  private handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    const { content, readOnly } = this.props;
    const { dropRowInfo } = this.state;
    if (!content || readOnly) return;

    const withinDocument = this.hasDragType(e.dataTransfer, dragTileSrcDocId(content.contentId));
    const hasContent = this.hasDragType(e.dataTransfer, kDragTileContent) ;
    const newTileCreation = this.hasDragType(e.dataTransfer, kDragTileCreate);
    if (hasContent || newTileCreation) {
      // Throttle calculation rate slightly to reduce load while dragging
      const lastUpdate = dropRowInfo && dropRowInfo.updateTimestamp ? dropRowInfo.updateTimestamp : 0;
      const now = new Date().getTime();
      if (now - lastUpdate > kDragUpdateInterval) {
        const nextDropRowInfo = this.getDropRowInfo(e);
        this.setState({ dropRowInfo: nextDropRowInfo });
      }
      // indicate we'll accept the drop
      e.dataTransfer.dropEffect = withinDocument && !e.altKey ? "move" : "copy";
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

  private handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (this.state.dropRowInfo) {
      this.setState({ dropRowInfo: undefined });
    }
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
      if (this.isPointInRect(e.clientX, e.clientY, rowBounds) ||
          // below the last row - highlight bottom of last row
          ((i === rowElements.length - 1) && (e.clientY > rowBounds.bottom))) {
        dropInfo.rowDropIndex = i;

        const dropOffsetLeft = Math.abs(e.clientX - rowBounds.left);
        const dropOffsetTop = Math.abs(e.clientY - rowBounds.top);
        const dropOffsetRight = Math.abs(rowBounds.right - e.clientX);
        const dropOffsetBottom = Math.abs(rowBounds.bottom - e.clientY);

        const kSideDropThreshold = rowBounds.width * 0.25;
        if ((dropOffsetLeft < kSideDropThreshold) &&
            (dropOffsetLeft < dropOffsetRight)) {
          dropInfo.rowDropLocation = "left";
        }
        else if ((dropOffsetRight < kSideDropThreshold) &&
                (dropOffsetRight <= dropOffsetLeft)) {
          dropInfo.rowDropLocation = "right";
        }
        else if (dropOffsetTop < dropOffsetBottom) {
          dropInfo.rowDropLocation = "top";
        }
        else {
          dropInfo.rowDropLocation = "bottom";
        }
      }
    }
    dropInfo.updateTimestamp = new Date().getTime();
    return dropInfo;
  }

  private handleRowResizeDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const { content } = this.props;
    const dragResizeRow = this.getDragResizeRowInfo(e);
    if (content && dragResizeRow && dragResizeRow.id && dragResizeRow.newHeight != null) {
      const row = content.rowMap.get(dragResizeRow.id);
      row && row.setRowHeight(dragResizeRow.newHeight);
      this.setState({ dragResizeRow: undefined });
    }
  }

  private handleMoveTileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const { content } = this.props;
    if (!content) return;
    const dragTileId = e.dataTransfer.getData(kDragTileId);
    const dropRowInfo  = this.getDropRowInfo(e);
    content.moveTile(dragTileId, dropRowInfo);
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

  private handleInsertNewTile = (e: React.DragEvent<HTMLDivElement>) => {
    const { content } = this.props;
    const { ui } = this.stores;

    const createTileType = e.dataTransfer.getData(kDragTileCreate) as DocumentTool;
    if (!content || !createTileType) return;

    const insertRowInfo = this.getDropRowInfo(e);

    const isInsertingInExistingRow = insertRowInfo && insertRowInfo.rowDropLocation &&
                                      (["left", "right"].indexOf(insertRowInfo.rowDropLocation) >= 0);
    const createSideCar = (createTileType === "geometry") && !isInsertingInExistingRow;
    const rowTile = content.addTile(createTileType, createSideCar, insertRowInfo);

    if (rowTile && rowTile.tileId) {
      ui.setSelectedTileId(rowTile.tileId);
    }
  }

  private handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const { content, readOnly } = this.props;
    if (!e.dataTransfer) return;
    const dragSrc = e.dataTransfer.getData(kDragTileSource);
    const dragTileId = e.dataTransfer.getData(kDragTileId);
    const dragTileContent = e.dataTransfer.getData(kDragTileContent);
    const dragCreateTileType = e.dataTransfer.getData(kDragTileCreate);

    if (!content || readOnly) return;

    if (this.hasDragType(e.dataTransfer, kDragResizeRowId)) {
      this.handleRowResizeDrop(e);
      return;
    }

    e.preventDefault();

    // handle drop within document - reorder tiles/rows
    if (dragTileId && (dragSrc === content.contentId) && !e.altKey) {
      this.handleMoveTileDrop(e);
    }

    // handle drop - copy contents to new row
    else if (dragTileContent) {
      this.handleCopyTileDrop(e);
    }

    // handle drop to create new tile
    else if (dragCreateTileType) {
      this.handleInsertNewTile(e);
    }

    if (this.state.dropRowInfo) {
      this.setState({ dropRowInfo: undefined });
    }
  }

}
