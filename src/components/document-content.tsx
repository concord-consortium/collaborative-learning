import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "./base";
import { DocumentContentModelType } from "../models/document-content";
import { TileRowComponent } from "./document/tile-row";

import "./document-content.sass";

interface IProps extends IBaseProps {
  context: string;
  content?: DocumentContentModelType;
  readOnly?: boolean;
}

@inject("stores")
@observer
export class DocumentContentComponent extends BaseComponent<IProps, {}> {

  public render() {
    return (
      <div className="document-content"
        onClick={this.handleClick}
        onDragOver={this.handleDragOver}
        onDrop={this.handleDrop}
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
              ? <TileRowComponent key={row.id} model={row} tileMap={tileMap} {...others} />
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

  private handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!this.props.readOnly) {
      // indicate we'll accept the drop
      e.preventDefault();
    }
  }

  private handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const { content } = this.props;
    const dragData = e.dataTransfer.getData("org.concord.clue.tile");
    let snapshot;
    if (content && dragData) {
      try {
        snapshot = JSON.parse(dragData);
      }
      catch (e) {
        snapshot = null;
      }
      if (snapshot) {
        content.addTileInNewRow(snapshot);
      }
    }
  }

}
