import React from "react";
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
  onSetCanAcceptDrop: (tileId?: string) => void;
}

interface IState {
}
​
export default class DrawingToolComponent extends BaseComponent<IProps, IState> {

  public static tileHandlesSelection = true;

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
        <div style={{left: TOOLBAR_WIDTH}} >
          <DrawingLayerView {...this.props} />
        </div>
      </div>
    );
  }
}
