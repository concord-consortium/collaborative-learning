import * as React from "react";
import { observer, inject } from "mobx-react";
import { getSnapshot } from "mobx-state-tree";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { kGeometryToolID } from "../../models/tools/geometry/geometry-content";
import { kTextToolID } from "../../models/tools/text/text-content";
import { kImageToolID } from "../../models/tools/image/image-content";
import { BaseComponent } from "../base";
import GeometryToolComponent from "./geometry-tool";
import TextToolComponent from "./text-tool";
import ImageToolComponent from "./image-tool";
import { cloneDeep } from "lodash";
import "./tool-tile.sass";

interface IProps {
  context: string;
  scale?: number;
  model: ToolTileModelType;
  readOnly?: boolean;
}

const kToolComponentMap: any = {
        [kGeometryToolID]: GeometryToolComponent,
        [kImageToolID]: ImageToolComponent,
        [kTextToolID]: TextToolComponent
      };

@inject("stores")
@observer
export class ToolTileComponent extends BaseComponent<IProps, {}> {

  public render() {
    const { model } = this.props;
    const { ui } = this.stores;
    const selectedClass = ui.isSelectedTile(model) ? " selected" : "";
    const ToolComponent = kToolComponentMap[model.content.type];
    return (
      <div className={`tool-tile${selectedClass}`}
        onDragStart={this.handleToolDragStart}
        draggable={true}
      >
        {this.renderTile(ToolComponent)}
      </div>
    );
  }

  private renderTile(ToolComponent: any) {
    return ToolComponent != null
            ? <ToolComponent key={this.props.model.id} {...this.props} />
            : null;
  }

  private handleToolDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    // set the drag data
    const snapshot = cloneDeep(getSnapshot(this.props.model));
    delete snapshot.id;
    const dragData = JSON.stringify(snapshot);
    e.dataTransfer.setData("org.concord.clue.tile", dragData);

    // set the drag image
    const { model, scale } = this.props;
    const ToolComponent = kToolComponentMap[model.content.type];
    const dragElt = e.target as HTMLElement;
    // tool components can provide alternate dom node for drag image
    const dragImage = ToolComponent && ToolComponent.getDragImageNode
                        ? ToolComponent.getDragImageNode(dragElt)
                        : dragElt;
    const clientRect = dragElt.getBoundingClientRect();
    const offsetX = (e.clientX - clientRect.left) / (scale || 1);
    const offsetY = (e.clientY - clientRect.top) / (scale || 1);
    e.dataTransfer.setDragImage(dragImage, offsetX, offsetY);
  }

}
