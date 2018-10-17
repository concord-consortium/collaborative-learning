import { inject, observer } from "mobx-react";
import * as React from "react";

import { BaseComponent, IBaseProps } from "./base";
import { DocumentModelType, DocumentTool } from "../models/document";

import "./toolbar.sass";

interface IProps extends IBaseProps {
  document: DocumentModelType;
}

@inject("stores")
@observer
export class ToolbarComponent extends BaseComponent<IProps, {}> {
  public render() {
    const {document} = this.props;
    const handleClickTool = (tool: DocumentTool) => {
      const { ui } = this.stores;
      return (e: React.MouseEvent<HTMLDivElement>) => {
        switch (tool) {
          case "delete":
            if (ui.selectedTileId) {
              document.deleteTile(ui.selectedTileId);
            }
            break;
          default:
            const rowTile = document.addTile(tool, tool === "geometry");
            if (rowTile && rowTile.tileId) {
              ui.setSelectedTileId(rowTile.tileId);
            }
        }
      };
    };
    return (
      <div className="toolbar">
        <div className="tool select" title="Select" onClick={handleClickTool("select")}>↖</div>
        <div className="tool text" title="Text" onClick={handleClickTool("text")}>T</div>
        <div className="tool geometry" title="Geometry" onClick={handleClickTool("geometry")}/>
        <div className="tool image" title="Image" onClick={handleClickTool("image")}/>
        <div className="tool delete" title="Delete" onClick={handleClickTool("delete")}>{"\u274c"}</div>
      </div>
    );
  }
}
