import { observer } from "mobx-react";
import * as React from "react";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { kGeometryToolID } from "../../models/tools/geometry/geometry-content";
import { kTableToolID } from "../../models/tools/table/table-content";
import { kTextToolID } from "../../models/tools/text/text-content";
import GeometryToolComponent from "./geometry-tool";
import TextToolComponent from "./text-tool";

interface IProps {
  model: ToolTileModelType;
  readOnly?: boolean;
}

@observer
export class ToolTileComponent extends React.Component<IProps, {}> {

  public render() {
    const { model } = this.props;
    switch (model.content.type) {
      case kGeometryToolID: return this.renderGeometryTile();
      case kTableToolID: return this.renderTableTile();
      case kTextToolID: return this.renderTextTile();
    }
    return this.renderUnknownTile();
  }

  private renderGeometryTile() {
    return (
      <GeometryToolComponent key={this.props.model.id} {...this.props} />
    );
  }

  private renderTableTile() {
    // return <TableTile />
    return null;
  }

  private renderTextTile() {
    return (
      <TextToolComponent key={this.props.model.id} {...this.props} />
    );
  }

  private renderUnknownTile() {
    // return <UnknownTile />
    return null;
  }
}
