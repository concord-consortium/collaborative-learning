import * as React from "react";
import { observer, inject } from "mobx-react";
import { BaseComponent } from "../base";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { TextContentModelType } from "../../models/tools/text/text-content";

import "./text-tool.sass";

interface IProps {
  model: ToolTileModelType;
  readOnly?: boolean;
}

interface IState {
}
​
// @inject("stores")
// @observer
export default class DrawingToolComponent extends BaseComponent<IProps, IState> {

  public render() {
    const { model, readOnly } = this.props;
    const editableClass = readOnly ? "read-only" : "editable";
    const classes = `text-tool ${editableClass}`;
    return (
      <div onMouseDown={this.handleMouseDown}
        style={{border: "1px solid black"}}
      />
    );
  }

  private handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    this.stores.ui.setSelectedTile(this.props.model);
  }
}
