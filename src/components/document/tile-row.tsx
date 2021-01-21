import React from "react";
import { observer, inject } from "mobx-react";
import { TileRowModelType } from "../../models/document/tile-row";
import { BaseComponent } from "../base";
import { ToolTileComponent, dragTileSrcDocId, IToolApiInterface } from "../tools/tool-tile";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { SectionHeader } from "../tools/section-header";
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
  scale?: number;
  model: TileRowModelType;
  rowIndex: number;
  height?: number;
  tileMap: any;
  readOnly?: boolean;
  dropHighlight?: string;
  toolApiInterface?: IToolApiInterface;
  onRequestTilesOfType: (tileType: string) => Array<{ id: string, title?: string }>;
  onRequestUniqueTitle: (tileId: string) => string | undefined;
}

interface IState {
  tileAcceptDrop?: string;
}

@inject("stores")
@observer
export class TileRowComponent extends BaseComponent<IProps, IState> {

  public state: IState = {};

  private tileRowDiv: HTMLElement | null;

  public render() {
    const { model } = this.props;
    const { isSectionHeader, sectionId } = model;
    // ignore height setting for section header rows
    const height = !isSectionHeader
                      ? this.props.height || model.height
                      : undefined;
    const style = height ? { height } : undefined;
    return (
      <div className={`tile-row`} data-row-id={model.id}
          style={style} ref={elt => this.tileRowDiv = elt}>
        { isSectionHeader && sectionId
          ? <SectionHeader type={sectionId}/>
          : this.renderTiles(height)
        }
        {!this.props.readOnly && this.renderDragDropHandles()}
      </div>
    );
  }

  private renderTiles(rowHeight?: number) {
    const { model, tileMap, ...others } = this.props;
    const { tiles } = model;
    if (!tiles) { return null; }

    return tiles.map((tileRef, index) => {
      const tileModel: ToolTileModelType = tileMap.get(tileRef.tileId);
      const tileWidthPct = model.renderWidth(tileRef.tileId);
      return tileModel
              ? <ToolTileComponent key={tileModel.id} model={tileModel}
                                    widthPct={tileWidthPct} height={rowHeight}
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
  }

  private handleRequestRowHeight = (tileId: string, height?: number, deltaHeight?: number) => {
    const rowHeight = this.props.model.height;
    const newHeight = rowHeight != null && deltaHeight != null
                        ? rowHeight + deltaHeight
                        : height;
    (newHeight != null) && this.props.model.setRowHeight(newHeight);
  }

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
  }
}
