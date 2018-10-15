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

export const kDragRowHeight = "org.concord.clue.row.height";
export const kDragTileSource = "org.concord.clue.tile.src";
export const kDragTileId = "org.concord.clue.tile.id";
export const kDragTileContent = "org.concord.clue.tile.content";
// allows source compatibility to be checked in dragOver
export const dragTileSrcDocId = (id: string) => `org.concord.clue.src.${id}`;

interface IProps {
  context: string;
  docId: string;
  scale?: number;
  widthPct?: number;
  height?: number;
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
    const { model, widthPct } = this.props;
    const { ui } = this.stores;
    const selectedClass = ui.isSelectedTile(model) ? " selected" : "";
    const ToolComponent = kToolComponentMap[model.content.type];
    const style: React.CSSProperties = {};
    if (widthPct) {
      style.width = `${Math.round(100 * widthPct / 100)}%`;
    }
    return (
      <div className={`tool-tile${selectedClass}`}
          style={style}
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
    const { model, docId, height, scale } = this.props;
    const snapshot = cloneDeep(getSnapshot(model));
    const id = snapshot.id;
    delete snapshot.id;
    const dragData = JSON.stringify(snapshot);
    e.dataTransfer.setData(kDragTileSource, docId);
    if (height) {
      e.dataTransfer.setData(kDragRowHeight, String(height));
    }
    e.dataTransfer.setData(kDragTileId, id);
    e.dataTransfer.setData(kDragTileContent, dragData);
    e.dataTransfer.setData(dragTileSrcDocId(docId), docId);

    // set the drag image
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
