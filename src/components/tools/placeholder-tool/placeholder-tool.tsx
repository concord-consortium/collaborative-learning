import React from "react";
import { BaseComponent } from "../../base";
import { getSectionPlaceholder } from "../../../models/curriculum/section";
import { PlaceholderContentModelType } from "../../../models/tools/placeholder/placeholder-content";
import { IToolTileProps } from "../tool-tile";

import "./placeholder-tool.sass";

export default class PlaceholderToolComponent extends BaseComponent<IToolTileProps> {
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
    this.stores.ui.setSelectedTile();
  };
}
