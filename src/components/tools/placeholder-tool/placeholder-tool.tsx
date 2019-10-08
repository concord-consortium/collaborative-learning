import * as React from "react";
import { BaseComponent } from "../../base";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { PlaceholderContentModelType } from "../../../models/tools/placeholder/placeholder-content";

import "./placeholder-tool.sass";

interface IProps {
  model: ToolTileModelType;
}

export default class PlaceholderToolComponent extends BaseComponent<IProps, {}> {
  public render() {
    return (
      <div className="placeholder-tool">
        {this.renderPlaceholderText()}
      </div>
    );
  }

  private renderPlaceholderText = () => {
    const placeholderContent = this.props.model.content as PlaceholderContentModelType;
    const placeholderLines = placeholderContent.prompt.split("\n");
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
}
