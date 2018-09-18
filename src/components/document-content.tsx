import { observer } from "mobx-react";
import * as React from "react";
import { IBaseProps } from "./base";
import { DocumentContentModelType } from "../models/document-content";
import { ToolTileComponent } from "./canvas-tools/tool-tile";

import "./document-content.sass";

interface IProps extends IBaseProps {
  content?: DocumentContentModelType;
  readOnly?: boolean;
}

@observer
export class DocumentContentComponent extends React.Component<IProps, {}> {

  public render() {
    const { content } = this.props;
    const tileModels = content && content.tiles;
    const tiles = tileModels
                    ? tileModels.map((tile, index) => {
                        return <ToolTileComponent key={index} readOnly={this.props.readOnly} model={tile} />;
                      })
                    : null;
    return (
      <div className="document-content">
        {tiles}
        {this.props.children}
      </div>
    );
  }
}
