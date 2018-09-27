import * as React from "react";
import { observer, inject } from "mobx-react";
import { getSnapshot } from "mobx-state-tree";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { kGeometryToolID } from "../../models/tools/geometry/geometry-content";
import { kTableToolID } from "../../models/tools/table/table-content";
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
    const snapshot = cloneDeep(getSnapshot(this.props.model));
    delete snapshot.id;
    const dragData = JSON.stringify(snapshot);
    e.dataTransfer.setData("org.concord.clue.tile", dragData);
  }

}
