import * as React from "react";
import { observer, inject } from "mobx-react";
import { BaseComponent } from "../../base";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { PlaceholderContentModelType } from "../../../models/tools/placeholder/placeholder-content";

import "./placeholder-tool.sass";

interface IProps {
  model: ToolTileModelType;
}

@inject("stores")
@observer
export default class PlaceholderToolComponent extends BaseComponent<IProps, {}> {
  public render() {
    const classes = `placeholder-tool`;
    return (
      <div>
        <div className={classes}>
          {this.renderPlaceholderText()}
        </div>
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
