import * as React from "react";
import { observer, inject } from "mobx-react";
import { BaseComponent } from "../base";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { ImageContentModelType } from "../../models/tools/image/image-content";

import "./image-tool.sass";

interface IProps {
  context: string;
  model: ToolTileModelType;
  readOnly?: boolean;
}

@inject("stores")
@observer
export default class ImageToolComponent extends BaseComponent<IProps, {}> {

  public render() {
    const { readOnly, model } = this.props;
    const { content } = model;
    const { ui } = this.stores;
    const imageContent = content as ImageContentModelType;
    const editableClass = readOnly ? "read-only" : "editable";
    const classes = `image-tool ${editableClass}`;
    return (
      <div className={classes}>
        <img
          src={imageContent.url}
          onMouseDown={this.handleMouseDown}
        />
      </div>
    );
  }

  private handleMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    this.stores.ui.setSelectedTile(this.props.model);
  }
}
