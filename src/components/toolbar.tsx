import { inject, observer } from "mobx-react";
import * as React from "react";

import { BaseComponent, IBaseProps } from "./base";
import { DocumentModelType, DocumentTool } from "../models/document/document";
import { IToolApiMap, kDragTileCreate  } from "./tools/tool-tile";
import { IToolButtonConfig, ToolbarConfig } from "../models/tools/tool-types";

import "./toolbar.sass";

interface IProps extends IBaseProps {
  document: DocumentModelType;
  toolbarConfig: ToolbarConfig;
  toolApiMap: IToolApiMap;
}

interface IButtonProps {
  config: IToolButtonConfig;
  onClick: (e: React.MouseEvent<HTMLDivElement>, name: string) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, name: string) => void;
  onShowDropHighlight: () => void;
  onHideDropHighlight: () => void;
}

const ToolButtonComponent = (props: IButtonProps) => {

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    return props.onClick && props.onClick(e, props.config.name);
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    return props.onDragStart && props.onDragStart(e, props.config.name);
  };

  return (
    <div className={`tool ${props.config.name}`} title={props.config.title || ""}
        key={props.config.name}
        onClick={handleClick}
        onDragStart={props.config.isTileTool ? handleDrag : undefined}
        draggable={props.config.isTileTool || false}
        onMouseEnter={props.config.isTileTool ? props.onShowDropHighlight : undefined}
        onMouseLeave={props.config.isTileTool ? props.onHideDropHighlight : undefined}>
      <svg className={`icon ${props.config.iconId}`}>
        <use xlinkHref={`#${props.config.iconId}`} />
      </svg>
    </div>
  );
};

@inject("stores")
@observer
export class ToolbarComponent extends BaseComponent<IProps, {}> {
  public render() {
    const handleClickTool = (e: React.MouseEvent<HTMLDivElement>, tool: DocumentTool) => {
      switch (tool) {
        case "select":
          this.handleSelect();
          break;
        case "delete":
          this.handleDelete();
          break;
        default:
          this.handleAddToolTile(tool);
          break;
      }
    };
    const handleDragTool = (e: React.DragEvent<HTMLDivElement>, tool: DocumentTool) => {
      this.handleDragNewToolTile(tool, e);
    };
    const renderToolButtons = (toolbarConfig: ToolbarConfig) => {
      return toolbarConfig.map(config => {
        const buttonProps: IButtonProps = {
          config,
          onClick: handleClickTool,
          onDragStart: handleDragTool,
          onShowDropHighlight: this.showDropRowHighlight,
          onHideDropHighlight: this.removeDropRowHighlight
        };
        return ToolButtonComponent(buttonProps);
      });
    };
    return (
      <div className="toolbar">
        {renderToolButtons(this.props.toolbarConfig)}
      </div>
    );
  }

  private showDropRowHighlight = () => {
    const { document } = this.props;
    document.content.highlightLastVisibleRow(true);
  }

  private removeDropRowHighlight = () => {
    const { document } = this.props;
    document.content.highlightLastVisibleRow(false);
  }

  private handleAddToolTile(tool: DocumentTool) {
    const { document } = this.props;
    const { ui } = this.stores;
    const rowTile = document.addTile(tool, tool === "geometry");
    if (rowTile && rowTile.tileId) {
      ui.setSelectedTileId(rowTile.tileId);
    }
  }

  private handleSelect() {
    // nothing to do
  }

  private handleDelete() {
    const { document } = this.props;
    const { ui: { selectedTileId } } = this.stores;
    if (selectedTileId) {
      const toolApi = this.props.toolApiMap[selectedTileId];
      // if there is selected content inside the selected tile, delete it first
      if (toolApi && toolApi.hasSelection()) {
        toolApi.deleteSelection();
      }
      else {
        document.deleteTile(selectedTileId);
      }
    }
  }

  private handleDragNewToolTile(tool: DocumentTool, e: React.DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData(kDragTileCreate, tool);
  }
}
