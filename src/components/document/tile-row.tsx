import * as React from "react";
import { observer, inject } from "mobx-react";
import { TileRowModelType } from "../../models/document/tile-row";
import { BaseComponent } from "../base";
import { ToolTileComponent } from "../canvas-tools/tool-tile";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import "./tile-row.sass";

interface IProps {
  context: string;
  scale?: number;
  model: TileRowModelType;
  tileMap: any;
  readOnly?: boolean;
}

@inject("stores")
@observer
export class TileRowComponent extends BaseComponent<IProps, {}> {

  public render() {
    const { model: { height } } = this.props;
    const style = height ? { height } : undefined;
    return (
      <div className={`tile-row`} style={style}>
        {this.renderTiles()}
      </div>
    );
  }

  private renderTiles() {
    const { model, tileMap, ...others } = this.props;
    const { tiles } = model;
    if (!tiles) { return null; }

    return tiles.map(tileRef => {
      const tileModel: ToolTileModelType = tileMap.get(tileRef.tileId);
      return tileModel
              ? <ToolTileComponent key={tileModel.id} model={tileModel} {...others} />
              : null;
    });
  }
}
