import { inject, observer } from "mobx-react";
import React from "react";

import { BaseComponent, IBaseProps } from "./base";
import { DocumentModelType, DocumentTool } from "../models/document/document";
import { IDocumentContentAddTileOptions, IDragToolCreateInfo } from "../models/document/document-content";
import { getToolContentInfoByTool, IToolContentInfo } from "../models/tools/tool-content-info";
import { DeleteButton } from "./delete-button";
import { IToolButtonConfig, IToolButtonProps, ToolButtonComponent } from "./tool-button";
import { EditableToolApiInterfaceRefContext } from "./tools/tool-api";
import { kDragTileCreate  } from "./tools/tool-tile";

import "./toolbar.sass";

export type ToolbarConfig = IToolButtonConfig[];

interface IProps extends IBaseProps {
  document: DocumentModelType;
  config: ToolbarConfig;
}

interface IState {
  defaultTool: string;
  activeTool: string;
}

@inject("stores")
@observer
export class ToolbarComponent extends BaseComponent<IProps, IState> {

  static contextType = EditableToolApiInterfaceRefContext;
  declare context: React.ContextType<typeof EditableToolApiInterfaceRefContext>;

  private showDeleteTilesConfirmationAlert?: () => void;

  state = {
    defaultTool: "",
    activeTool: ""
  }

  public componentDidMount() {
    const defaultTool = this.props.config.find(item => item.isDefault);
    if (defaultTool) {
      this.setState({ defaultTool: defaultTool.name, activeTool: defaultTool.name });
    }
  }

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
    const handleSetActiveTool = (tool: DocumentTool, isActive: boolean) => {
      const { defaultTool } = this.state;
      this.setState({ activeTool: isActive && (tool !== defaultTool) ? tool : defaultTool });
    };
    const handleDragTool = (e: React.DragEvent<HTMLDivElement>, tool: DocumentTool) => {
      this.handleDragNewToolTile(tool, e);
    };
    const renderToolButtons = (toolbarConfig: ToolbarConfig) => {
      const { ui: { selectedTileIds } } = this.stores;
      return toolbarConfig.map(config => {
        const buttonProps: IToolButtonProps = {
          config,
          ToolIcon: config.icon,
          isActive: config.name === this.state.activeTool,
          isDisabled: config.name === "delete" && !selectedTileIds.length,
          onSetToolActive: handleSetActiveTool,
          onClick: handleClickTool,
          onDragStart: handleDragTool,
          onShowDropHighlight: this.showDropRowHighlight,
          onHideDropHighlight: this.removeDropRowHighlight
        };
        return config.name !== "delete"
                ? <ToolButtonComponent key={config.name} {...buttonProps} />
                : <DeleteButton key={config.name}
                                onSetShowDeleteTilesConfirmationAlert={this.setShowDeleteTilesConfirmationAlert}
                                onDeleteSelectedTiles={this.handleDeleteSelectedTiles}
                                {...buttonProps} />;
      });
    };
    return (
      <div className="toolbar" data-testid="toolbar">
        {renderToolButtons(this.props.config)}
      </div>
    );
  }

  private showDropRowHighlight = () => {
    const { document } = this.props;
    document.content?.showPendingInsertHighlight(true);
  }

  private removeDropRowHighlight = () => {
    const { document } = this.props;
    document.content?.showPendingInsertHighlight(false);
  }

  private getUniqueTitle(toolContentInfo: IToolContentInfo) {
    const toolApiInterface = this.context?.current;
    if (!toolApiInterface) return;
    const { document } = this.props;
    const { id, titleBase } = toolContentInfo;
    const getTileTitle = (tileId: string) => toolApiInterface?.getToolApi(tileId)?.getTitle?.();
    return titleBase && document.getUniqueTitle(id, titleBase, getTileTitle);
  }

  private handleAddToolTile(tool: DocumentTool) {
    const { document } = this.props;
    const { ui } = this.stores;
    const toolContentInfo = getToolContentInfoByTool(tool);
    const newTileOptions: IDocumentContentAddTileOptions = {
            title: this.getUniqueTitle(toolContentInfo),
            addSidecarNotes: !!toolContentInfo?.addSidecarNotes,
            insertRowInfo: { rowInsertIndex: document.content?.defaultInsertRow ?? 0 }
          };
    const rowTile = document.addTile(tool, newTileOptions);
    if (rowTile && rowTile.tileId) {
      ui.setSelectedTileId(rowTile.tileId);
      this.setState(state => ({ activeTool: state.defaultTool }));
    }
  }

  private handleSelect() {
    // nothing to do
  }

  private handleDelete() {
    const toolApiInterface = this.context?.current;
    if (!toolApiInterface) return;
    let didDeleteInteriorSelection = false;
    const { ui } = this.stores;
    ui.selectedTileIds.forEach(tileId => {
      const toolApi = toolApiInterface?.getToolApi(tileId);
      // if there is selected content inside the selected tile, delete it first
      if (toolApi?.hasSelection?.()) {
        toolApi.deleteSelection?.();
        didDeleteInteriorSelection = true;
      }
    });
    if (!didDeleteInteriorSelection) {
      this.showDeleteTilesConfirmationAlert?.();
    }
    this.setState(state => ({ activeTool: state.defaultTool }));
  }

  private setShowDeleteTilesConfirmationAlert = (showAlert: () => void) => {
    this.showDeleteTilesConfirmationAlert = showAlert;
  }

  private handleDeleteSelectedTiles = () => {
    const { ui } = this.stores;
    const { document } = this.props;
    ui.selectedTileIds.forEach(tileId => {
      ui.removeTileIdFromSelection(tileId);
      document.deleteTile(tileId);
    });
  }

  private handleDragNewToolTile = (tool: DocumentTool, e: React.DragEvent<HTMLDivElement>) => {
    // remove hover-insert highlight when we start a tile drag
    this.removeDropRowHighlight();

    const toolContentInfo = getToolContentInfoByTool(tool);
    const dragInfo: IDragToolCreateInfo = { tool, title: this.getUniqueTitle(toolContentInfo) };
    e.dataTransfer.setData(kDragTileCreate, JSON.stringify(dragInfo));
  }
}
