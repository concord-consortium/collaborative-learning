import * as React from "react";
import { observer, inject } from "mobx-react";
import { TileRowModelType } from "../../models/document/tile-row";
import { BaseComponent } from "../base";
import { ToolTileComponent, dragTileSrcDocId } from "../canvas-tools/tool-tile";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { IDropRowInfo } from "../document-content";
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

const dragDropHighlightClasses = {
  none: "tile-row",
  baseHighlight: "tile-row drag-highlight"
};

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
  dragDropInfo?: IDropRowInfo;
}
interface IState {
  isDragging?: boolean;
  rowClass?: string;
}
@inject("stores")
@observer
export class TileRowComponent extends BaseComponent<IProps, {}> {
  public static getDerivedStateFromProps: any = (nextProps: IProps, prevState: IState) => {
    if (!nextProps.dragDropInfo && prevState.rowClass !== dragDropHighlightClasses.none) {
      // Remove highlighting relating to dragging
      return { isDragging: false, rowClass: dragDropHighlightClasses.none };
    } else {
      return {};
    }
  }
  public state: IState = { rowClass: "tile-row" };

  private tileRowDiv: HTMLElement | null;

  public render() {
    const { model } = this.props;
    const { rowClass } = this.state;
    const height = this.props.height || model.height;
    const style = height ? { height } : undefined;

    return (
      <div className={rowClass} data-row-id={model.id}
        style={style}
        ref={elt => this.tileRowDiv = elt}
        onDragOver={this.handleDragOver}
        onDragExit={this.handleDragExit}
        onDragEnd={this.handleDragEnd}
      >
        {this.renderTiles(height)}
        {this.renderBottomResizeHandle()}
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

  private renderBottomResizeHandle() {
    const { model } = this.props;
    if (this.props.readOnly || !model.isUserResizable) return null;
    return <div className="bottom-resize-handle" draggable={true} onDragStart={this.handleStartResizeRow}/>;
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

  private handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    const { dragDropInfo } = this.props;
    if (!this.state.isDragging) {
      this.setState({ isDragging: true });
    } else {
      if (dragDropInfo) {
        const highlightList = [];
        if (dragDropInfo &&
          dragDropInfo.dropOffsetLeft && dragDropInfo.dropOffsetRight &&
          dragDropInfo.dropOffsetTop && dragDropInfo.dropOffsetBottom) {
          // Check left/right
          if (dragDropInfo.dropOffsetLeft < dragDropInfo.dropOffsetRight) {
            highlightList.push("left");
          } else {
            highlightList.push("right");
          }
          // Check top/bottom
          if (dragDropInfo.dropOffsetTop < dragDropInfo.dropOffsetBottom) {
            highlightList.push("top");
          } else {
            highlightList.push("bottom");
          }

          const highlights = this.buildHighlightClass(highlightList);
          if (this.state.rowClass !== highlights) {
            this.setState({ rowClass: highlights });
          }
        }
      } else {
        this.setState({ rowClass: dragDropHighlightClasses.none });
      }
    }
  }
  private handleDragExit = (e: React.DragEvent<HTMLDivElement>) => {
    this.clearDragHighlighting();
  }
  private handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    this.clearDragHighlighting();
  }
  private clearDragHighlighting = () => {
    this.setState({ isDragging: false, rowClass: dragDropHighlightClasses.none });
  }

  private buildHighlightClass = (highlightList: string[]) => {
    const highlights = highlightList.length > 0 ? highlightList : [];
    if (highlights.length > 0) {
      highlights.unshift(dragDropHighlightClasses.baseHighlight);
    }
    else {
      highlights.push(dragDropHighlightClasses.none);
    }
    return highlights.join(" ");
  }
}
