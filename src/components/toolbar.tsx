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
        <div className="tool select" title="Select" onClick={handleClickTool("select")}>
          <svg className={`icon icon-select-tool`}>
            <use xlinkHref={`#icon-select-tool`} />
          </svg>
        </div>
        <div className="tool text" title="Text" onClick={handleClickTool("text")}>
          <svg className={`icon icon-text-tool`}>
            <use xlinkHref={`#icon-text-tool`} />
          </svg>
        </div>
        <div className="tool geometry" title="Geometry" onClick={handleClickTool("geometry")}>
          <svg className={`icon icon-geometry-tool`}>
            <use xlinkHref={`#icon-geometry-tool`} />
          </svg>
        </div>
        <div className="tool image" title="Image" onClick={handleClickTool("image")}>
        <svg className={`icon icon-image-tool`}>
            <use xlinkHref={`#icon-image-tool`} />
          </svg>
        </div>
        <div className="tool delete" title="Delete" onClick={handleClickTool("delete")}>
          <svg className={`icon icon-delete-tool`}>
            <use xlinkHref={`#icon-delete-tool`} />
          </svg>
        </div>
      </div>
    );
  }
}
