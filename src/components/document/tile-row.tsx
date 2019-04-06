import * as React from "react";
import { observer, inject } from "mobx-react";
import { TileRowModelType } from "../../models/document/tile-row";
import { BaseComponent } from "../base";
import { ToolTileComponent, dragTileSrcDocId, IToolApiMap } from "../tools/tool-tile";
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
  height?: number;
  tileMap: any;
  readOnly?: boolean;
  dropHighlight?: string;
  toolApiMap?: IToolApiMap;
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
    const { model, tileMap, toolApiMap, ...others } = this.props;
    const { tiles } = model;
    if (!tiles) { return null; }

    return tiles.map((tileRef, index) => {
      const tileModel: ToolTileModelType = tileMap.get(tileRef.tileId);
      const tileWidthPct = model.renderWidth(tileRef.tileId);
      return tileModel
              ? <ToolTileComponent key={tileModel.id} model={tileModel}
                                    widthPct={tileWidthPct} height={rowHeight}
                                    onSetCanAcceptDrop={this.handleSetCanAcceptDrop}
                                    toolApiMap={toolApiMap}
                                    {...others} />
              : null;
    });
  }

  private renderDragDropHandles() {
    const { model: { isUserResizable }, dropHighlight } = this.props;
    const highlight = this.state.tileAcceptDrop ? undefined : dropHighlight;
    return [
      <div key="top-drop-feedback"
          className={`drop-feedback ${highlight === "top" ? "show top" : ""}`} />,
      <div key="left-drop-feedback"
          className={`drop-feedback ${highlight === "left" ? "show left" : ""}`} />,
      <div key="right-drop-feedback"
          className={`drop-feedback ${highlight === "right" ? "show right" : ""}`} />,
      <div key="bottom-drop-feedback"
          className={`drop-feedback ${highlight === "bottom" ? "show bottom" : ""}`} />,
      <div key="bottom-resize-handle"
        className={`bottom-resize-handle ${isUserResizable ? "enable" : "disable"}`}
        draggable={isUserResizable}
        onDragStart={isUserResizable ? this.handleStartResizeRow : undefined} />
    ];
  }

  private handleSetCanAcceptDrop = (tileId?: string) => {
    this.setState({ tileAcceptDrop: tileId });
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
