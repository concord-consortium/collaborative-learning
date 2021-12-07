import classNames from "classnames";
import React from "react";
import { observer, inject } from "mobx-react";
import { BaseComponent } from "../base";
import { TileLayoutModelType, TileRowModelType } from "../../models/document/tile-row";
import { isShowingTeacherContent } from "../../models/stores/stores";
import { getToolContentInfoById } from "../../models/tools/tool-content-info";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { SectionHeader } from "../tools/section-header";
import { ToolApiInterfaceContext } from "../tools/tool-api";
import { ToolTileComponent, dragTileSrcDocId } from "../tools/tool-tile";

import "./tile-row.sass";

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
  tileMap: any;
  readOnly?: boolean;
  dropHighlight?: string;
  onRequestTilesOfType: (tileType: string) => Array<{ id: string, title?: string }>;
  onRequestUniqueTitle: (tileId: string) => string | undefined;
}

interface IState {
  tileAcceptDrop?: string;
}

@inject("stores")
@observer
export class TileRowComponent extends BaseComponent<IProps, IState> {

  static contextType = ToolApiInterfaceContext;
  declare context: React.ContextType<typeof ToolApiInterfaceContext>;

  public state: IState = {};

  private tileRowDiv: HTMLElement | null;

  public render() {
    const { model, typeClass } = this.props;
    const { isSectionHeader, sectionId, tiles } = model;
    // ignore height setting for section header rows
    const height = !isSectionHeader
                      ? this.props.height || model.height || this.getContentHeight()
                      : undefined;
    const style = height ? { height } : undefined;
    const renderableTiles = tiles?.filter(tile => this.isTileRenderable(tile.tileId));
    const hasTeacherTiles = tiles.some(tile => this.getTile(tile.tileId)?.display === "teacher");
    const classes = classNames("tile-row", { "has-teacher-tiles": hasTeacherTiles });
    if (!isSectionHeader && !renderableTiles.length) return null;
    return (
      <div className={classes} data-row-id={model.id}
          style={style} ref={elt => this.tileRowDiv = elt}>
        { isSectionHeader && sectionId
          ? <SectionHeader type={sectionId} typeClass={typeClass}/>
          : this.renderTiles(renderableTiles, height)
        }
        {!this.props.readOnly && this.renderDragDropHandles()}
      </div>
    );
  }

  private getTile(tileId: string) {
    return this.props.tileMap.get(tileId) as ToolTileModelType | undefined;
  }

  private isTileRenderable(tileId: string) {
    const tile = this.getTile(tileId);
    return !!tile && (!tile.display || isShowingTeacherContent(this.stores));
  }

  private getTileWidth(tileId: string, tiles: TileLayoutModelType[]) {
    // for now, distribute tiles evenly
    return 100 / (tiles.length || 1);
  }

  private getContentHeight() {
    return this.props.model.getContentHeight((tileId: string) => {
      // if the tile has a specific content height, use it
      const toolApiInterface = this.context;
      const toolApi = toolApiInterface?.getToolApi(tileId);
      const contentHeight = toolApi?.getContentHeight?.();
      if (contentHeight) return contentHeight;
      // otherwise, use the default height for this type of tile
      const tile = this.getTile(tileId);
      const tileType = tile?.content.type;
      const contentInfo = tileType && getToolContentInfoById(tileType);
      if (contentInfo?.defaultHeight) return contentInfo.defaultHeight;
    });
  }

  private renderTiles(tiles: TileLayoutModelType[], rowHeight?: number) {
    const { model, tileMap, ...others } = this.props;

    return tiles.map((tileRef, index) => {
      const tileModel = this.getTile(tileRef.tileId);
      const tileWidthPct = this.getTileWidth(tileRef.tileId, tiles);
      return tileModel
              ? <ToolTileComponent key={tileModel.id} model={tileModel}
                                    widthPct={tileWidthPct} height={rowHeight}
                                    isUserResizable={model.isUserResizable}
                                    onResizeRow={this.handleStartResizeRow}
                                    onSetCanAcceptDrop={this.handleSetCanAcceptDrop}
                                    onRequestRowHeight={this.handleRequestRowHeight}
                                    {...others} />
              : null;
    });
  }

  private renderDragDropHandles() {
    const { model: { isUserResizable }, rowIndex, dropHighlight } = this.props;
    const highlight = this.state.tileAcceptDrop ? undefined : dropHighlight;
    const { isSectionHeader } = this.props.model;
    const showTopHighlight = (highlight === "top") && (!isSectionHeader || (rowIndex > 0));
    const showLeftHighlight = (highlight === "left") && !isSectionHeader;
    const showRightHighlight = (highlight === "right") && !isSectionHeader;
    const showBottomHighlight = (highlight === "bottom");
    return [
      <div key="top-drop-feedback"
          className={`drop-feedback ${showTopHighlight ? "show top" : ""}`} />,
      <div key="left-drop-feedback"
          className={`drop-feedback ${showLeftHighlight ? "show left" : ""}`} />,
      <div key="right-drop-feedback"
          className={`drop-feedback ${showRightHighlight ? "show right" : ""}`} />,
      <div key="bottom-drop-feedback"
          className={`drop-feedback ${showBottomHighlight ? "show bottom" : ""}`} />,
      <div key="bottom-resize-handle"
        className={`bottom-resize-handle ${isUserResizable ? "enable" : "disable"}`}
        draggable={isUserResizable}
        onDragStart={isUserResizable ? this.handleStartResizeRow : undefined} />
    ];
  }

  private handleSetCanAcceptDrop = (tileId?: string) => {
    this.setState({ tileAcceptDrop: tileId });
  };

  private handleRequestRowHeight = (tileId: string, height?: number, deltaHeight?: number) => {
    const { height: modelHeight, tileCount, setRowHeight } = this.props.model;
    const rowHeight = modelHeight;
    const newHeight = rowHeight != null && deltaHeight != null
                        ? rowHeight + deltaHeight
                        : height;
    // don't shrink the height of a multi-tile row based on a request from a single tile
    if ((tileCount > 1) && (rowHeight != null) && (newHeight != null) && (newHeight < rowHeight)) return;
    (newHeight != null) && setRowHeight(newHeight);
  };

  private handleStartResizeRow = (e: React.DragEvent<HTMLDivElement>) => {
    const { model, docId } = this.props;
    const { id } = model;
    e.dataTransfer.setData(dragTileSrcDocId(docId), docId);
    e.dataTransfer.setData(kDragResizeRowId, id);
    e.dataTransfer.setData(dragResizeRowId(id), id);
    e.dataTransfer.setData(dragResizeRowY(e.clientY), String(e.clientY));
    if (model.height) {
      e.dataTransfer.setData(dragResizeRowModelHeight(model.height), String(model.height));
    }
    if (this.tileRowDiv) {
      const boundingBox = this.tileRowDiv.getBoundingClientRect();
      e.dataTransfer.setData(dragResizeRowDomHeight(boundingBox.height), String(boundingBox.height));
    }
  };
}
