import React from "react";
import { inject, observer } from "mobx-react";
import { IReactionDisposer, reaction } from "mobx";
import { throttle } from "lodash";
import classNames from "classnames";
import { DocumentDndContext } from "./document-dnd-context";
import { BaseComponent, IBaseProps } from "../base";
import { kDragResizeRowId, extractDragResizeRowId, extractDragResizeY,
        extractDragResizeModelHeight, extractDragResizeDomHeight, TileRowHandle } from "../document/tile-row";
import { DocumentContentModelType } from "../../models/document/document-content";
import { IDragToolCreateInfo, IDragTilesData } from "../../models/document/document-content-types";
import { getDocumentIdentifier } from "../../models/document/document-utils";
import { IDropRowInfo } from "../../models/document/tile-row";
import { logDataTransfer } from "../../models/document/drag-tiles";
import { TileApiInterfaceContext } from "../tiles/tile-api";
import { dragTileSrcDocId, kDragTileCreate, kDragTiles } from "../tiles/tile-component";
import { safeJsonParse } from "../../utilities/js-utils";
import { RowListComponent } from "./row-list";
import { DropRowContext } from "./drop-row-context";
import { RowRefsContext } from "./row-refs-context";
import { ContainerContext } from "./container-context";

import "./document-content.scss";

interface IProps extends IBaseProps {
  content?: DocumentContentModelType;
  context: string;
  documentId?: string;
  onScroll?: (x: number, y: number) => void;
  readOnly?: boolean;
  scale?: number;
  selectedSectionId?: string | null;
  showPlaybackSpacer?: boolean;
  typeClass: string;
  viaTeacherDashboard?: boolean;
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

  static contextType = TileApiInterfaceContext;
  declare context: React.ContextType<typeof TileApiInterfaceContext>;

  public state: IState = {};

  private domElement: HTMLElement | null;
  private rowRefs: Array<TileRowHandle>;
  private mutationObserver: MutationObserver;
  private scrollDisposer: IReactionDisposer;

  constructor(props: IProps) {
    super(props);
    this.rowRefs = [];
    this.domElement = null;
  }

  private addRowRef = (ref: TileRowHandle) => {
    this.rowRefs.push(ref);
  };

  public componentDidMount() {
    if (this.domElement) {
      this.domElement.addEventListener("scroll", throttle(this.updateVisibleRows, 100));
      this.updateVisibleRows();
      this.scrollToSection(this.props.selectedSectionId);

      // We pass the domElement to our children, but it's undefined during the first render,
      // so we force an update to make sure we draw at least once after we have our domElement.
      this.forceUpdate();

      // TODO: scrollTo would be better if it was set on something specific to the document
      // since it is global all DocumentContentComponents are listening to this same global
      // property. So when there are lots of thumbnails then each of them will react to a
      // change of this global. It could be a volatile prop on the document model. Or the ui
      // store could have a scrollToMap with keys of the docId and values of the tileId
      this.scrollDisposer = reaction(
        () => {
          const docId = this.stores.ui.scrollTo?.docId;
          return getDocumentIdentifier(this.props.content) === docId
            ? this.stores.ui.scrollTo?.tileId
            : undefined;
        },
        (scrollToTileId: string | undefined) => {
          if (scrollToTileId) {
            this.rowRefs.forEach((row: TileRowHandle | null) => {
              if (row?.tileRowDiv && row.hasTile(scrollToTileId)) {
                // Javascript struggles to scroll multiple elements at the same time,
                // so we delay scrolling any document on the left and only animate the left document
                setTimeout(() => {
                  row?.tileRowDiv?.scrollIntoView({
                    behavior: this.props.readOnly ? "smooth" : "auto",
                    block: "nearest",
                    inline: "nearest"
                  });
                }, this.props.readOnly ? 100 : 1);
              }
            });
          }
        }
      );
    }
  }

  public componentWillUnmount() {
    this.scrollDisposer?.();
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
    const { viaTeacherDashboard } = this.props;
    const { ui, persistentUI, user } = this.stores;
    const isChatEnabled = user.isTeacherOrResearcher;
    const documentSelectedForComment = isChatEnabled && persistentUI.showChatPanel && ui.selectedTileIds.length === 0
                                          && persistentUI.focusDocument;
    const documentClass = classNames(
      "document-content",
      {"document-content-smooth-scroll" : viaTeacherDashboard, "comment-select" : documentSelectedForComment},
      this.props.readOnly ? "read-only" : "read-write"
    );

    // Reset rowRefs array before rendering
    this.rowRefs = [];

    // We can highlight either the drop location for the current drag/drop operation (in state),
    // or the one set by the toolbar (in the content model).
    const dropRow = this.state.dropRowInfo || this.getDropRowInfoForPendingDropLocation();

    return (
      <DocumentDndContext>
        <DropRowContext.Provider value={dropRow}>
          <ContainerContext.Provider value={{ model: undefined, isLocked: false }}>
            <RowRefsContext.Provider value={{ addRowRef: this.addRowRef }}>
              <div className={documentClass}
                data-testid="document-content"
                data-document-key={this.props.documentId}
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
            </RowRefsContext.Provider>
          </ContainerContext.Provider>
        </DropRowContext.Provider>
      </DocumentDndContext>
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

    // Find the list of top-level rows that are currently visible on the screen
    const visibleRowIds: string[] = [];
    this.rowRefs.forEach((ref) => {
      if (ref?.tileRowDiv && content.rowMap.get(ref.id)) {
        if (isElementInViewport(ref.tileRowDiv)) {
          visibleRowIds.push(ref.id);
        }
      }
    });
    content.setVisibleRows(visibleRowIds);
  };

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
    const { content } = this.props;
    if (!content) { return null; }
    return (
      <RowListComponent
        rowListModel={content}
        documentContent={this.domElement}
        context={this.props.context}
        documentId={this.props.documentId}
        docId={content.contentId}
        typeClass={this.props.typeClass}
        scale={this.props.scale}
        readOnly={this.props.readOnly}
      />
    );
  }

  private renderSpacer = () => {
    const spacerClass = classNames({"spacer" : !this.props.readOnly, "playback-spacer": this.props.showPlaybackSpacer});
    return <div className={spacerClass} onClick={this.handleClick} />;
  };

  private handleScroll = throttle((e: React.UIEvent<HTMLDivElement>) => {
    const tileApiInterface = this.context;
    const xScroll = this.domElement?.scrollLeft || 0;
    const yScroll = this.domElement?.scrollTop || 0;
    tileApiInterface?.forEach(api => api.handleDocumentScroll?.(xScroll, yScroll));
    this.props.onScroll?.(xScroll, yScroll);
  }, 50);

  private getTileTitle(id: string) {
    const tile = this.props.content?.getTile(id);
    return tile?.computedTitle;
  }

  private handleRequestUniqueTitle = (tileId: string) => {
    const { content } = this.props;
    const tileType = content?.getTile(tileId)?.content.type;
    return tileType && content?.getUniqueTitleForType(tileType);
  };

  private handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const { ui } = this.stores;
    // deselect tiles on click on document background
    // click must be on DocumentContent itself, not bubble up from child
    if (e.target === e.currentTarget) {
      ui.setSelectedTile();
    }
  };

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
  };

  private handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    this.clearDropRowInfo();
  };

  private isPointInRect(x: number, y: number, rect: ClientRect | DOMRect) {
    if ((x == null) || !isFinite(x) || (y == null) || !isFinite(y)) return false;
    return ((x >= rect.left) && (x <= rect.right) && (y >= rect.top) && (y <= rect.bottom));
  }

  // Given the index of an HTML .tile-row on the page, return the info for the row content object
  private getDropInfoForGlobalRowIndex(globalRowIndex: number): IDropRowInfo {
    const { content } = this.props;
    const row = content?.allRows[globalRowIndex];
    const rowList = row && content?.getRowListForRow(row.id);
    const rowIndex = row && rowList?.getRowIndex(row.id);
    if (!row || rowIndex === undefined || rowIndex === -1) return { rowInsertIndex: 0 };
    return { rowDropId: row.id, rowInsertIndex: rowIndex };
  }

  // Determine whether the drag event is over a drop zone, and if so, which one
  private getDropRowInfo = (e: React.DragEvent<HTMLDivElement>) => {
    const { content } = this.props;
    if (!this.domElement || !content) {
      return { rowInsertIndex: content ? content.rowOrder.length : 0 };
    }

    let dropInfo: IDropRowInfo = { rowInsertIndex: 0 };
    // This includes both "main" rows and rows nested inside question tiles
    const rowElements = this.domElement.getElementsByClassName("tile-row");

    // Find the last "main" row
    let lastRowIndex = -1, lastRowBottom = 0;
    for (let i = 0; i < rowElements.length; ++i) {
      const rowElt = rowElements[i];
      const rowBounds = rowElt.getBoundingClientRect();
      if (rowBounds.bottom > lastRowBottom) {
        lastRowIndex = i;
        lastRowBottom = rowBounds.bottom;
      }
    }

    for (let i = 0; i < rowElements.length; ++i) {
      const rowElt = rowElements[i];
      const rowBounds = rowElt.getBoundingClientRect();
      if (this.isPointInRect(e.clientX, e.clientY, rowBounds) ||
          // below the last row - pretend we are in the last row
          ((i === lastRowIndex) && (e.clientY > rowBounds.bottom))) {
        dropInfo = this.getDropInfoForGlobalRowIndex(i);
        if (!dropInfo.rowDropId) return;
        const row = content?.getRowRecursive(dropInfo.rowDropId);
        if (row?.isFixedPositionRow(content?.tileMap)) {
          // Cannot drop alongside or above a fixed position row
          dropInfo.rowDropLocation = "bottom";
          dropInfo.rowInsertIndex = i + 1;
        } else {
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
            dropInfo.rowInsertIndex = i + 1;
          }
        }
      }
    }
    dropInfo.updateTimestamp = new Date().getTime();
    return dropInfo;
  };

  private clearDropRowInfo() {
    if (this.state.dropRowInfo) {
      this.setState({ dropRowInfo: undefined });
    }
  }

  private handleRowResizeDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const { content } = this.props;
    const dragResizeRow = this.getDragResizeRowInfo(e);
    if (content && dragResizeRow?.id && dragResizeRow.newHeight != null) {
      const row = content.getRowRecursive(dragResizeRow.id);
      row?.setRowHeight(dragResizeRow.newHeight);
      this.setState({ dragResizeRow: undefined });
    }
  };

  private handleMoveTilesDrop = (e: React.DragEvent<HTMLDivElement>, dragTilesData: IDragTilesData) => {
    const dropRowInfo = this.getDropRowInfo(e);
    const content = this.props.content;
    if (!dropRowInfo || !content) return;
    content.userMoveTiles(content.removeEmbeddedTilesFromDragTiles(dragTilesData.tiles), dropRowInfo);
  };

  private handleCopyTilesDrop = (e: React.DragEvent<HTMLDivElement>, dragTiles: IDragTilesData) => {
    const dropRowInfo = this.getDropRowInfo(e);
    if (!dropRowInfo) return;
    this.props.content?.handleDragCopyTiles(dragTiles, dropRowInfo);
  };

  private handleInsertNewTile = (e: React.DragEvent<HTMLDivElement>) => {
    const { content } = this.props;
    const { ui } = this.stores;

    const createTileInfoStr = e.dataTransfer.getData(kDragTileCreate);
    const createTileInfo = safeJsonParse<IDragToolCreateInfo>(createTileInfoStr);
    if (!content || !createTileInfo) return;

    const { toolId, title } = createTileInfo;
    const insertRowInfo = this.getDropRowInfo(e);
    const rowTile = content.userAddTile(toolId, {title, insertRowInfo});

    if (rowTile?.tileId) {
      ui.setSelectedTileId(rowTile.tileId);
    }
  };

  private handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const { content, readOnly } = this.props;
    content?.showPendingInsertHighlight(false);

    if (!e.dataTransfer || !content || readOnly) return;

    logDataTransfer(e.dataTransfer);

    if (this.hasDragType(e.dataTransfer, kDragResizeRowId)) {
      this.handleRowResizeDrop(e);
      return;
    }

    e.preventDefault();

    const dragTilesJson = e.dataTransfer.getData(kDragTiles);
    if (dragTilesJson) {
      try {
        const dragTiles: IDragTilesData = JSON.parse(dragTilesJson);
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
  };

  private getDropRowInfoForPendingDropLocation(): IDropRowInfo | undefined {
    const { content } = this.props;
    const rowId = content?.highlightPendingDropLocation;
    if (!rowId) return;
    const rowIndex = content.getRowListForRow(rowId)?.getRowIndex(rowId);
    if (rowIndex < 0) return;
    return {
      rowDropId: rowId,
      rowDropLocation: "bottom",
      rowInsertIndex: rowIndex + 1
    };
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
