import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "./base";
import { DocumentContentModelType } from "../models/document-content";
import { ToolTileComponent } from "./canvas-tools/tool-tile";

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
    const { content, ...others } = this.props;
    const tileModels = content && content.tiles;
    const tiles = tileModels
                    ? tileModels.map((tile) => {
                        return <ToolTileComponent key={tile.id} model={tile} {...others} />;
                      })
                    : null;
    return (
      <div className="document-content"
        onClick={this.handleClick}
        onDragOver={this.handleDragOver}
        onDrop={this.handleDrop}
      >
        {tiles}
        {this.props.children}
      </div>
    );
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
        content.addTileSnapshot(snapshot);
      }
    }
  }

}
