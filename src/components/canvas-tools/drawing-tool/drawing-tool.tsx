import * as React from "react";
import { BaseComponent } from "../../base";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { ToolbarView } from "./drawing-toolbar";
import { DrawingLayerView } from "./drawing-layer";
import { TOOLBAR_WIDTH, DrawingContentModelType } from "../../../models/tools/drawing/drawing-content";

import "./drawing-tool.sass";

interface IProps {
  model: ToolTileModelType;
  readOnly: boolean;
  scale?: number;
}

interface IState {
}
​
export default class DrawingToolComponent extends BaseComponent<IProps, IState> {

  public componentDidMount() {
    if (!this.props.readOnly) {
      (this.props.model.content as DrawingContentModelType).reset();
    }
  }

  public render() {
    const { model, readOnly, scale } = this.props;
    const editableClass = readOnly ? " read-only" : "";
    const className = `drawing-tool${editableClass}`;
    return (
      <div className={className}>
        <ToolbarView model={model} readOnly={!!readOnly}/>
        <div style={{left: TOOLBAR_WIDTH}}
            onMouseDown={this.handleMouseDown}>
          <DrawingLayerView model={model} readOnly={!!readOnly} scale={scale} />
        </div>
      </div>
    );
  }

  private handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    this.stores.ui.setSelectedTile(this.props.model);
  }
}
