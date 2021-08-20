import { inject, observer } from "mobx-react";
import React from "react";
import { findDOMNode } from "react-dom";
import { throttle } from "lodash";
import { BaseComponent, IBaseProps } from "../base";
import { TileRowComponent, kDragResizeRowId, extractDragResizeRowId, extractDragResizeY,
        extractDragResizeModelHeight, extractDragResizeDomHeight } from "../document/tile-row";
import { DocumentContentModelType, IDragToolCreateInfo, IDropRowInfo } from "../../models/document/document-content";
import { getToolContentInfoById } from "../../models/tools/tool-content-info";
import { IDragTiles } from "../../models/tools/tool-tile";
import { ToolApiInterfaceContext } from "../tools/tool-api";
import { dragTileSrcDocId, kDragTileCreate, kDragTiles } from "../tools/tool-tile";
import { safeJsonParse } from "../../utilities/js-utils";

import "./document-content.sass";
import classNames from "classnames";

interface IProps extends IBaseProps {
  context: string;
  documentId?: string;
  content?: DocumentContentModelType;
  readOnly?: boolean;
  scale?: number;
  selectedSectionId?: string | null;
  viaTeacherDashboard?: boolean;
  documentSelectedForComment?: boolean;
}

interface IDragResizeRow {
  id: string;
  modelHeight?: number;
  domHeight?: number;
  deltaHeight: number;
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

  static contextType = ToolApiInterfaceContext;
  declare context: React.ContextType<typeof ToolApiInterfaceContext>;

  public state: IState = {};

  private domElement: HTMLElement | null;
  private rowRefs: Array<TileRowComponent | null>;
  private mutationObserver: MutationObserver;

  public componentDidMount() {
    if (this.domElement) {
      this.domElement.addEventListener("scroll", throttle(this.updateVisibleRows, 100));
      this.updateVisibleRows();
      this.scrollToSection(this.props.selectedSectionId);

      if ((window as any).MutationObserver) {
        this.mutationObserver = new MutationObserver(this.handleRowElementsChanged);
        this.mutationObserver.observe(this.domElement, { childList: true });
      }
      // We pass the domElement to our children, but it's undefined during the first render,
      // so we force an update to make sure we draw at least once after we have our domElement.
      this.forceUpdate();
    }
  }

  public componentWillUnmount() {
    this.mutationObserver.disconnect();
  }

  public componentDidUpdate(prevProps: IProps) {
    // recalculate after render
    requestAnimationFrame(() => {
      this.updateVisibleRows();

      const domElement = this.domElement;
      if (!domElement) {
        return;
      }

      // scroll to selected section if it changed
      const {selectedSectionId} = this.props;
      if (selectedSectionId && (selectedSectionId !== prevProps.selectedSectionId)) {
        this.scrollToSection(selectedSectionId);
      }

      // move to current section or top of document when content switches in teacher dashboard
      requestAnimationFrame(() => {
        if (this.props.content !== prevProps.content) {
          if (!this.scrollToSection(this.props.selectedSectionId)) {
            domElement.scrollTo({top: 0});
          }
        }
      });
    });
  }

  public render() {
    const {viaTeacherDashboard, documentSelectedForComment} = this.props;
    const documentClass = classNames("document-content", viaTeacherDashboard ? "document-content-smooth-scroll" : "",
                                     documentSelectedForComment ? "comment-select" : "");
    return (
      <div className={documentClass}
        onScroll={this.handleScroll}
        onClick={this.handleClick}
        onDragOver={this.handleDragOver}
        onDragLeave={this.handleDragLeave}
        onDrop={this.handleDrop}
        ref={(elt) => this.domElement = elt}
      >
        {this.renderRows()}
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
        // eslint-disable-next-line react/no-find-dom-node
        const rowNode = findDOMNode(ref);
        if (rowNode && isElementInViewport(rowNode as Element)) {
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
    // must match lower-case for ids stored in DataTransfer key
    if (rowId.toLowerCase() !== dragResizeRow?.id) {
      return row?.height;
    }
    const rowHeight = dragResizeRow && (dragResizeRow.domHeight || dragResizeRow.modelHeight);
    if (!dragResizeRow || !rowHeight) return;
    return rowHeight + dragResizeRow.deltaHeight;
  }

  private renderRows() {
    const { content, ...others } = this.props;
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
      if (!dropHighlight) {
        if (index === highlightPendingDropLocation) {
          dropHighlight = "top";
        }
        else if ((index === rowOrder.length - 1) && (index + 1 === highlightPendingDropLocation)) {
          dropHighlight = "bottom";
        }
      }
      return row
              ? <TileRowComponent key={row.id} docId={content.contentId} model={row}
                                  documentContent={this.domElement}
                                  rowIndex={index} height={rowHeight} tileMap={tileMap}
                                  dropHighlight={dropHighlight}
                                  onRequestTilesOfType={this.handleRequestTilesOfType}
                                  onRequestUniqueTitle={this.handleRequestUniqueTitle}
                                  ref={(elt) => this.rowRefs.push(elt)} {...others} />
              : null;
    });
  }

  private renderSpacer = () => {
    return !this.props.readOnly &&
            <div className="spacer" onClick={this.handleClick} />;
  }

  private handleScroll = throttle((e: React.UIEvent<HTMLDivElement>) => {
    const toolApiInterface = this.context;
    const xScroll = this.domElement?.scrollLeft || 0;
    const yScroll = this.domElement?.scrollTop || 0;
    toolApiInterface?.forEach(api => api.handleDocumentScroll?.(xScroll, yScroll));
  }, 50)

  private handleRequestTilesOfType = (tileType: string) => {
    const { content } = this.props;
    const toolApiInterface = this.context;
    if (!content || !tileType || !toolApiInterface) return [];
    const tilesOfType = content.getTilesOfType(tileType);
    return tilesOfType.map(id => ({ id, title: toolApiInterface.getToolApi(id)?.getTitle?.() }));
  }

  private handleRequestUniqueTitle = (tileId: string) => {
    const { content } = this.props;
    const toolApiInterface = this.context;
    const tileType = content?.getTile(tileId)?.content.type;
    const titleBase = tileType && getToolContentInfoById(tileType)?.titleBase;
    const getTileTitle = (_tileId: string) => toolApiInterface?.getToolApi?.(_tileId)?.getTitle?.();
    return tileType && titleBase && content?.getUniqueTitle(tileType, titleBase, getTileTitle);
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
    const hasContent = this.hasDragType(e.dataTransfer, kDragTiles);
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
      if (dragResizeRow?.id && dragResizeRow.newHeight != null) {
        this.setState({ dragResizeRow });
      }
      // indicate we'll accept the drop
      e.dataTransfer.dropEffect = "move";
      e.preventDefault();
    }
  }

  private handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    this.clearDropRowInfo();
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

  private clearDropRowInfo() {
    if (this.state.dropRowInfo) {
      this.setState({ dropRowInfo: undefined });
    }
  }

  private handleRowResizeDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const { content } = this.props;
    const dragResizeRow = this.getDragResizeRowInfo(e);
    if (content && dragResizeRow?.id && dragResizeRow.newHeight != null) {
      const row = content.rowMap.get(dragResizeRow.id);
      row?.setRowHeight(dragResizeRow.newHeight);
      this.setState({ dragResizeRow: undefined });
    }
  }

  private handleMoveTilesDrop = (e: React.DragEvent<HTMLDivElement>, dragTiles: IDragTiles) => {
    this.props.content?.userMoveTiles(dragTiles.items, this.getDropRowInfo(e));
  }

  private handleCopyTilesDrop = (e: React.DragEvent<HTMLDivElement>, dragTiles: IDragTiles) => {
    this.props.content?.userCopyTiles(dragTiles.items, this.getDropRowInfo(e));
  }

  private handleInsertNewTile = (e: React.DragEvent<HTMLDivElement>) => {
    const { content } = this.props;
    const { ui } = this.stores;

    const createTileInfoStr = e.dataTransfer.getData(kDragTileCreate);
    const createTileInfo = safeJsonParse<IDragToolCreateInfo>(createTileInfoStr);
    if (!content || !createTileInfo) return;

    const { tool, title } = createTileInfo;
    const insertRowInfo = this.getDropRowInfo(e);
    const isInsertingInExistingRow = insertRowInfo?.rowDropLocation &&
                                      (["left", "right"].indexOf(insertRowInfo.rowDropLocation) >= 0);
    const addSidecarNotes = (tool === "geometry") && !isInsertingInExistingRow;
    const rowTile = content.userAddTile(tool, {title, addSidecarNotes, insertRowInfo});

    if (rowTile?.tileId) {
      ui.setSelectedTileId(rowTile.tileId);
    }
  }

  private handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const { content, readOnly } = this.props;
    content?.showPendingInsertHighlight(false);

    if (!e.dataTransfer || !content || readOnly) return;

    if (this.hasDragType(e.dataTransfer, kDragResizeRowId)) {
      this.handleRowResizeDrop(e);
      return;
    }

    e.preventDefault();

    const dragTilesJson = e.dataTransfer.getData(kDragTiles);
    if (dragTilesJson) {
      try {
        const dragTiles: IDragTiles = JSON.parse(dragTilesJson);
        if ((dragTiles.sourceDocId === content.contentId) && !e.altKey) {
          this.handleMoveTilesDrop(e, dragTiles);
        }
        else {
          this.handleCopyTilesDrop(e, dragTiles);
        }
      } catch (ex) {
        console.error(ex);
      }

      this.clearDropRowInfo();
      return;
    }

    const dragCreateTileType = e.dataTransfer.getData(kDragTileCreate);

    // handle drop to create new tile
    if (dragCreateTileType) {
      this.handleInsertNewTile(e);
    }

    this.clearDropRowInfo();
  }

  private scrollToSection(sectionId: string | null | undefined ) {
    if (!sectionId || !this.domElement) {
      return false;
    }

    const sectionElementTop = this.findSectionElementTop(this.domElement, sectionId);
    if (sectionElementTop !== undefined) {
      this.domElement.scrollTo({top: sectionElementTop});
      return true;
    }
    return false;
  }

  private findSectionElementTop(parent: HTMLElement, sectionId: string, top = 0): number | undefined {
    for (let i = 0; i < parent.childNodes.length; i++) {
      const child = parent.childNodes.item(i) as HTMLElement;
      if (child.nodeType === 1) { // 1 is element
        if (child.id === `section_${sectionId}`) {
          return top + child.offsetTop;
        }
        if (child.childNodes) {
          const sectionElementTop = this.findSectionElementTop(child, sectionId, top);
          if (sectionElementTop !== undefined) {
            return sectionElementTop;
          }
        }
        top += child.clientHeight;
      }
    }
  }

}
