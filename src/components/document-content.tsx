import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "./base";
import { DocumentContentModelType } from "../models/document-content";
import { TileRowComponent } from "./document/tile-row";
import { kDragTileSource, kDragTileId, kDragTileContent,
        dragTileSrcDocId, kDragRowHeight } from "./canvas-tools/tool-tile";
import { assign } from "lodash";

import "./document-content.sass";

interface IProps extends IBaseProps {
  context: string;
  content?: DocumentContentModelType;
  readOnly?: boolean;
}

@inject("stores")
@observer
export class DocumentContentComponent extends BaseComponent<IProps, {}> {

  private domElement: HTMLElement | null;

  public render() {
    return (
      <div className="document-content"
        onClick={this.handleClick}
        onDragOver={this.handleDragOver}
        onDrop={this.handleDrop}
        ref={(elt) => this.domElement = elt}
      >
        {this.renderRows()}
        {this.props.children}
      </div>
    );
  }

  private renderRows() {
    const { content, ...others } = this.props;
    if (!content) { return null; }
    const { rowMap, rowOrder, tileMap } = content;
    return rowOrder.map(rowId => {
      const row = rowMap.get(rowId);
      return row
              ? <TileRowComponent key={row.id} docId={content.contentId}
                                  model={row} tileMap={tileMap} {...others} />
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

  private hasDragType(dataTransfer: DataTransfer, type: string) {
    return dataTransfer.types.findIndex(t => t === type) >= 0;
  }

  private handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    const { content, readOnly } = this.props;
    if (content && !readOnly && this.hasDragType(e.dataTransfer, kDragTileContent)) {
      const withinDocument = this.hasDragType(e.dataTransfer, dragTileSrcDocId(content.contentId));
      e.dataTransfer.dropEffect = withinDocument && !e.altKey ? "move" : "copy";
      // indicate we'll accept the drop
      e.preventDefault();
    }
  }

  private getDropRowIndex = (e: React.DragEvent<HTMLDivElement>) => {
    const { content } = this.props;
    if (!this.domElement) return content ? content.rowOrder.length : 0;

    const rowElements = this.domElement.getElementsByClassName("tile-row");
    const dropY = e.clientY;
    let dropIndex = 0;
    let dropDistance = Infinity;
    let dist;
    for (let i = 0; i < rowElements.length; ++i) {
      const rowElt = rowElements[i];
      const rowBounds = rowElt.getBoundingClientRect();
      if (i === 0) {
        dist = Math.abs(dropY - rowBounds.top);
        dropIndex = i;
        dropDistance = dist;
      }
      dist = Math.abs(dropY - rowBounds.bottom);
      if (dist < dropDistance) {
        dropIndex = i + 1;
        dropDistance = dist;
      }
    }
    return dropIndex;
  }

  private handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const { content } = this.props;
    const dragSrc = e.dataTransfer.getData(kDragTileSource);
    const dragTileId = e.dataTransfer.getData(kDragTileId);
    const dragTileContent = e.dataTransfer.getData(kDragTileContent);

    if (!content || !dragTileId || !dragTileContent) return;

    e.preventDefault();

    const dropRowIndex = this.getDropRowIndex(e);

    // handle drop within document - reorder tiles/rows
    if ((dragSrc === content.contentId) && !e.altKey) {
      const srcRowId = content.findRowContainingTile(dragTileId);
      if (!srcRowId) return;
      const srcRowIndex = content.rowOrder.findIndex(rowId => rowId === srcRowId);

      if (dropRowIndex !== srcRowIndex) {
        content.moveRowToIndex(srcRowIndex, dropRowIndex);
      }
      return;
    }

    // handle drop - copy contents to new row
    let snapshot;
    if (content && dragTileContent) {
      try {
        snapshot = JSON.parse(dragTileContent);
      }
      catch (e) {
        snapshot = null;
      }
      if (snapshot) {
        const dragRowHeight = e.dataTransfer.getData(kDragRowHeight);
        const rowHeight = dragRowHeight ? { rowHeight: +dragRowHeight } : undefined;
        const newRowOptions = assign({ rowIndex: dropRowIndex }, rowHeight);
        content.addTileInNewRow(snapshot.content, newRowOptions);
      }
    }
  }

}
