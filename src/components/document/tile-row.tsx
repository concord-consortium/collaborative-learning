import * as React from "react";
import { observer, inject } from "mobx-react";
import { TileRowModelType } from "../../models/document/tile-row";
import { BaseComponent } from "../base";
import { ToolTileComponent, dragTileSrcDocId } from "../canvas-tools/tool-tile";
import { ToolTileModelType } from "../../models/tools/tool-tile";
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
  docId: string;
  scale?: number;
  model: TileRowModelType;
  tabIndex?: number;
  height?: number;
  tileMap: any;
  readOnly?: boolean;
  dropHighlight?: string;
}

@inject("stores")
@observer
export class TileRowComponent extends BaseComponent<IProps, {}> {

  private tileRowDiv: HTMLElement | null;

  public render() {
    const { model } = this.props;
    const height = this.props.height || model.height;
    const style = height ? { height } : undefined;
    return (
      <div className={`tile-row`} data-row-id={model.id}
          style={style} ref={elt => this.tileRowDiv = elt}>
        {this.renderTiles(height)}
        {!this.props.readOnly && this.renderDragDropHandles()}
      </div>
    );
  }

  private renderTiles(rowHeight?: number) {
    const { model, tileMap, tabIndex, ...others } = this.props;
    const { tiles } = model;
    if (!tiles) { return null; }

    return tiles.map((tileRef, index) => {
      const tileModel: ToolTileModelType = tileMap.get(tileRef.tileId);
      const tileWidthPct = model.renderWidth(tileRef.tileId);
      const _tabIndex = tabIndex ? tabIndex + index : tabIndex;
      return tileModel
              ? <ToolTileComponent key={tileModel.id} model={tileModel} tabIndex={_tabIndex}
                                    widthPct={tileWidthPct} height={rowHeight} {...others} />
              : null;
    });
  }

  private renderDragDropHandles() {
    const { model: { isUserResizable }, dropHighlight } = this.props;
    return [
      <div key="top-drop-feedback"
          className={`top-drop-feedback ${dropHighlight === "top" ? "show-feedback" : ""}`} />,
      <div key="left-drop-feedback"
          className={`left-drop-feedback ${dropHighlight === "left" ? "show-feedback" : ""}`} />,
      <div key="right-drop-feedback"
          className={`right-drop-feedback ${dropHighlight === "right" ? "show-feedback" : ""}`} />,
      <div key="bottom-resize-handle"
          className={`bottom-resize-handle ${dropHighlight === "bottom" ? "show-feedback" : ""}`}
          draggable={isUserResizable}
          onDragStart={isUserResizable ? this.handleStartResizeRow : undefined} />
    ];
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
