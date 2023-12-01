import React from "react";
import { BaseComponent } from "../../base";
import { getSectionPlaceholder } from "../../../models/curriculum/section";
import { PlaceholderContentModelType } from "../../../models/tiles/placeholder/placeholder-content";
import { ITileProps } from "../tile-component";

import "./placeholder-tile.scss";

export default class PlaceholderTileComponent extends BaseComponent<ITileProps> {
  public render() {
    return (
      <div className="placeholder-tool" onMouseDown={this.handleMouseDown} >
        {this.renderPlaceholderText()}
      </div>
    );
  }

  private renderPlaceholderText() {
    const content = this.props.model.content as PlaceholderContentModelType;
    const { sectionId } = content;
    const placeholder = getSectionPlaceholder(sectionId);
    const placeholderLines = placeholder.split("\n");
    return (
      <div>
        {placeholderLines.map((line, index) => {
          return (
            <div key={index}>{line}</div>
          );
        })}
      </div>
    );
  }

  private handleMouseDown = (e: React.MouseEvent) => {
    this.stores.persistentUI.setSelectedTile();
  };
}
