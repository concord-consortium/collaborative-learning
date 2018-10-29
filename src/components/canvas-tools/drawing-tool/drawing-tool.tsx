import * as React from "react";
import { observer, inject } from "mobx-react";
import { BaseComponent } from "../../base";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { TextContentModelType } from "../../../models/tools/text/text-content";
import { ToolbarView } from "./toolbar";
import { DrawingLayerView } from "./drawing-layer";
import { TOOLBAR_WIDTH, DrawingContentModelType } from "../../../models/tools/drawing/drawing-content";

import "./drawing-tool.scss";

interface IProps {
  model: ToolTileModelType;
  readOnly: boolean;
}

interface IState {
}
​
// @inject("stores")
// @observer
export default class DrawingToolComponent extends BaseComponent<IProps, IState> {

  private toolbarElement: HTMLDivElement;

  public componentWillMount() {
    (this.props.model.content as DrawingContentModelType).reset();
  }

  public render() {
    const { model, readOnly } = this.props;
    const editableClass = readOnly ? " read-only" : "";
    const className = `drawing-tool${editableClass}`;
    return (
      <div className={className}>
        <ToolbarView
            model={model}
            readOnly={!!readOnly}/>
        <div style={{left: TOOLBAR_WIDTH}}
            onMouseDown={this.handleMouseDown}>
          <DrawingLayerView
            model={model}
            readOnly={!!readOnly}
          />
        </div>
      </div>
    );
  }

  private handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    this.stores.ui.setSelectedTile(this.props.model);
  }
}
