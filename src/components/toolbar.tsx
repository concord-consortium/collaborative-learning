import { inject, observer } from "mobx-react";
import React from "react";

import { BaseComponent, IBaseProps } from "./base";
import { DocumentModelType } from "../models/document/document";
import { IDocumentContentAddTileOptions, IDragToolCreateInfo } from "../models/document/document-content";
import { ToolbarModelType } from "../models/stores/problem-configuration";
import { ToolButtonModelType } from "../models/tools/tool-button";
import { getToolContentInfoById, IToolContentInfo } from "../models/tools/tool-content-info";
import { DeleteButton } from "./delete-button";
import { IToolButtonProps, ToolButtonComponent } from "./tool-button";
import { EditableToolApiInterfaceRefContext } from "./tools/tool-api";
import { kDragTileCreate  } from "./tools/tool-tile";

import "./toolbar.sass";

interface IProps extends IBaseProps {
  document: DocumentModelType;
  toolbarModel: ToolbarModelType;
}

interface IState {
  defaultTool?: ToolButtonModelType;
  activeTool?: ToolButtonModelType;
}

@inject("stores")
@observer
export class ToolbarComponent extends BaseComponent<IProps, IState> {

  static contextType = EditableToolApiInterfaceRefContext;
  declare context: React.ContextType<typeof EditableToolApiInterfaceRefContext>;

  private showDeleteTilesConfirmationAlert?: () => void;

  state: IState = {};

  public componentDidMount() {
    const defaultTool = this.props.toolbarModel.find(item => item.isDefault);
    if (defaultTool) {
      this.setState({ defaultTool, activeTool: defaultTool });
    }
  }

  public render() {
    const handleClickTool = (e: React.MouseEvent<HTMLDivElement>, tool: ToolButtonModelType) => {
      switch (tool.id) {
        case "select":
          this.handleSelect();
          break;
        case "undo":
          this.handleUndo();
          break;
        case "redo":
          this.handleRedo();
          break;
        case "delete":
          this.handleDelete();
          break;
        default:
          this.handleAddToolTile(tool);
          break;
      }
    };
    const handleSetActiveTool = (tool: ToolButtonModelType, isActive: boolean) => {
      const { defaultTool } = this.state;
      this.setState({ activeTool: isActive && (tool !== defaultTool) ? tool : defaultTool });
    };
    const handleDragTool = (e: React.DragEvent<HTMLDivElement>, tool: ToolButtonModelType) => {
      this.handleDragNewToolTile(tool, e);
    };
    const renderToolButtons = (toolbarModel: ToolbarModelType) => {
      const { ui: { selectedTileIds } } = this.stores;
      return toolbarModel.map(toolButton => {
        const buttonProps: IToolButtonProps = {
          toolButton,
          isActive: toolButton === this.state.activeTool,
          isDisabled: toolButton.id === "delete" && !selectedTileIds.length,
          onSetToolActive: handleSetActiveTool,
          onClick: handleClickTool,
          onDragStart: handleDragTool,
          onShowDropHighlight: this.showDropRowHighlight,
          onHideDropHighlight: this.removeDropRowHighlight
        };
        toolButton.initialize();
        return toolButton.id !== "delete"
                ? <ToolButtonComponent key={toolButton.id} {...buttonProps} />
                : <DeleteButton key={toolButton.id}
                                onSetShowDeleteTilesConfirmationAlert={this.setShowDeleteTilesConfirmationAlert}
                                onDeleteSelectedTiles={this.handleDeleteSelectedTiles}
                                {...buttonProps} />;
      });
    };
    return (
      <div className="toolbar" data-testid="toolbar">
        {renderToolButtons(this.props.toolbarModel)}
      </div>
    );
  }

  private showDropRowHighlight = () => {
    const { document } = this.props;
    document.content?.showPendingInsertHighlight(true);
  };

  private removeDropRowHighlight = () => {
    const { document } = this.props;
    document.content?.showPendingInsertHighlight(false);
  };

  private getUniqueTitle(toolContentInfo: IToolContentInfo) {
    const toolApiInterface = this.context?.current;
    if (!toolApiInterface) return;
    const { document } = this.props;
    const { id, titleBase } = toolContentInfo;
    const getTileTitle = (tileId: string) => toolApiInterface?.getToolApi(tileId)?.getTitle?.();
    return titleBase && document.getUniqueTitle(id, titleBase, getTileTitle);
  }

  private handleAddToolTile(tool: ToolButtonModelType) {
    const { document } = this.props;
    const { ui } = this.stores;
    const toolContentInfo = getToolContentInfoById(tool.id);
    if (!toolContentInfo) return;

    const newTileOptions: IDocumentContentAddTileOptions = {
            title: this.getUniqueTitle(toolContentInfo),
            addSidecarNotes: !!toolContentInfo?.addSidecarNotes,
            insertRowInfo: { rowInsertIndex: document.content?.defaultInsertRow ?? 0 }
          };
    const rowTile = document.addTile(tool.id, newTileOptions);
    if (rowTile && rowTile.tileId) {
      ui.setSelectedTileId(rowTile.tileId);
      this.setState(state => ({ activeTool: state.defaultTool }));
      // Scroll to the new tile once it has been added to MobX State Tree
      setTimeout(() => ui.setScrollToTileId(rowTile.tileId), 1);
    }
  }

  private handleSelect() {
    // nothing to do
  }

  private handleUndo() {
    this.props.document.undoLastAction();
  }

  private handleRedo() {
    this.props.document.redoLastAction();
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
  };

  private handleDeleteSelectedTiles = () => {
    const { ui } = this.stores;
    const { document } = this.props;
    ui.selectedTileIds.forEach(tileId => {
      ui.removeTileIdFromSelection(tileId);
      document.deleteTile(tileId);
    });
  };

  private handleDragNewToolTile = (tool: ToolButtonModelType, e: React.DragEvent<HTMLDivElement>) => {
    // remove hover-insert highlight when we start a tile drag
    this.removeDropRowHighlight();

    const toolContentInfo = getToolContentInfoById(tool.id);
    if (toolContentInfo) {
      const dragInfo: IDragToolCreateInfo =
        { toolId: tool.id, title: this.getUniqueTitle(toolContentInfo) };
      e.dataTransfer.setData(kDragTileCreate, JSON.stringify(dragInfo));
    }
  };
}
