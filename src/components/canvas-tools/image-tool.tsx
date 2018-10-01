import * as React from "react";
import { observer, inject } from "mobx-react";
import { BaseComponent } from "../base";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { ImageContentModelType } from "../../models/tools/image/image-content";
// import { UIModelType } from "../../models/ui";

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
    const { readOnly, model: { content } } = this.props;
    const imageContent = content as ImageContentModelType;
    const editableClass = readOnly ? "read-only" : "editable";
    const classes = `image-tool ${editableClass}`;
    // const ui = this.stores;
    const style_image = { position: 'relative'};
    const style_url = { position: 'absolute', top: 10, left: 10 } ;
    // const selected = ui.isSelectedTile(this.props.model);
    // console.log("selected?" + selected);
    return (
      <div className={classes} onMouseDown={this.handleMouseDown} >
        <img src={imageContent.url}
                  style={style_image}
                  />
        <input
          style={style_url}
          defaultValue={imageContent.url}
          onBlur={this.handleBlur}
        />
      </div>
    );
  }

  private handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    this.stores.ui.setSelectedTile(this.props.model);
  }

  private handleBlur = (e: React.MouseEvent<HTMLInputElement>) => {
    // console.log("on blur");
    const imageContent = this.props.model.content as ImageContentModelType;
    imageContent.setUrl(e.currentTarget.value);
  }
}
