import { inject, observer } from "mobx-react";
import React from "react";

import { BaseComponent, IBaseProps } from "./base";
import { DocumentModelType } from "../models/document/document";
import { IDocumentContentAddTileOptions, IDragToolCreateInfo } from "../models/document/document-content";
import { IToolbarModel } from "../models/stores/problem-configuration";
import { IToolbarButtonModel } from "../models/tiles/toolbar-button";
import { getTileContentInfo, ITileContentInfo } from "../models/tiles/tile-content-info";
import { DeleteButton } from "./delete-button";
import { IToolbarButtonProps, ToolbarButtonComponent } from "./toolbar-button";
import { EditableTileApiInterfaceRefContext } from "./tiles/tile-api";
import { kDragTileCreate  } from "./tiles/tile-component";

import "./toolbar.sass";

interface IProps extends IBaseProps {
  document: DocumentModelType;
  toolbarModel: IToolbarModel;
}

interface IState {
  defaultTool?: IToolbarButtonModel;
  activeTool?: IToolbarButtonModel;
}

@inject("stores")
@observer
export class ToolbarComponent extends BaseComponent<IProps, IState> {

  static contextType = EditableTileApiInterfaceRefContext;
  declare context: React.ContextType<typeof EditableTileApiInterfaceRefContext>;

  private showDeleteTilesConfirmationAlert?: () => void;

  state: IState = {};

  public componentDidMount() {
    const defaultTool = this.props.toolbarModel.find(item => item.isDefault);
    if (defaultTool) {
      this.setState({ defaultTool, activeTool: defaultTool });
    }
  }

  public render() {
    const handleClickTool = (e: React.MouseEvent<HTMLDivElement>, tool: IToolbarButtonModel) => {
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
        case "solution":
          this.handleToggleSelectedTilesSolution();
          break;
        default:
          this.handleAddTile(tool);
          break;
      }
    };
    const handleSetActiveTool = (tool: IToolbarButtonModel, isActive: boolean) => {
      const { defaultTool } = this.state;
      this.setState({ activeTool: isActive && (tool !== defaultTool) ? tool : defaultTool });
    };
    const handleDragTool = (e: React.DragEvent<HTMLDivElement>, tool: IToolbarButtonModel) => {
      this.handleDragNewTile(tool, e);
    };
    const renderToolButtons = (toolbarModel: IToolbarModel) => {
      return toolbarModel.map(toolButton => {
        const buttonProps: IToolbarButtonProps = {
          toolButton,
          isActive: toolButton.id === "solution"
            ? this.selectedTilesIncludeTeacher()
            : toolButton === this.state.activeTool,
          isDisabled: this.isButtonDisabled(toolButton),
          onSetToolActive: handleSetActiveTool,
          onClick: handleClickTool,
          onDragStart: handleDragTool,
          onShowDropHighlight: this.showDropRowHighlight,
          onHideDropHighlight: this.removeDropRowHighlight
        };
        toolButton.initialize();
        return toolButton.id !== "delete"
                ? <ToolbarButtonComponent key={toolButton.id} {...buttonProps} />
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

  private getUniqueTitle(tileContentInfo: ITileContentInfo) {
    const tileApiInterface = this.context?.current;
    if (!tileApiInterface) return;
    const { document } = this.props;
    const { type, titleBase } = tileContentInfo;
    const getTileTitle = (tileId: string) => tileApiInterface?.getTileApi(tileId)?.getTitle?.();
    return titleBase && document.getUniqueTitle(type, titleBase, getTileTitle);
  }

  private isButtonDisabled(toolButton: IToolbarButtonModel) {
    const { document: { content } } = this.props;
    const { appConfig: { settings }, ui: { selectedTileIds } } = this.stores;

    const undoManager = this.props.document.treeManagerAPI?.undoManager;
    if (toolButton.id === "undo" && !undoManager?.canUndo) return true;
    if (toolButton.id === "redo" && !undoManager?.canRedo) return true;

    // If no tiles are selected, disable the delete button.
    if (toolButton.id === "delete" && !selectedTileIds.length) return true;

    if (toolButton.isTileTool && settings) {
      // If a limit on the number of tiles of a certain type has been specified in settings,
      // disable the related tile button when that limit is reached.
      const tilesOfTypeCount = content?.getTilesOfType(toolButton.id).length || 0;
      const tileSettings = settings[toolButton.id.toLowerCase()] as Record<string, any>;
      const maxTilesOfType = tileSettings ? tileSettings.maxTiles : undefined;
      if (maxTilesOfType && tilesOfTypeCount >= maxTilesOfType) return true;
    }

    return false;
  }

  private handleAddTile(tool: IToolbarButtonModel) {
    const { document } = this.props;
    const { ui } = this.stores;
    const tileContentInfo = getTileContentInfo(tool.id);
    if (!tileContentInfo) return;

    const newTileOptions: IDocumentContentAddTileOptions = {
            title: this.getUniqueTitle(tileContentInfo),
            addSidecarNotes: !!tileContentInfo?.addSidecarNotes,
            insertRowInfo: { rowInsertIndex: document.content?.defaultInsertRow ?? 0 }
          };
    const rowTile = document.addTile(tool.id, newTileOptions);
    if (rowTile && rowTile.tileId) {
      ui.setSelectedTileId(rowTile.tileId);
      this.setState(state => ({ activeTool: state.defaultTool }));
      // Scroll to the new tile once it has been added to the correct location
      // We need to use a timeout because tiles are added in one spot, then moved elsewhere
      // TODO When tiles are created in the right place, the timeout here should be removed
      setTimeout(() => ui.setScrollTo(rowTile.tileId, document.key));
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
    const tileApiInterface = this.context?.current;
    if (!tileApiInterface) return;
    let didDeleteInteriorSelection = false;
    const { ui } = this.stores;
    ui.selectedTileIds.forEach(tileId => {
      const tileApi = tileApiInterface?.getTileApi(tileId);
      // if there is selected content inside the selected tile, delete it first
      if (tileApi?.hasSelection?.()) {
        tileApi.deleteSelection?.();
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

  // Returns true if any of the selected tiles have display: "teacher"
  private selectedTilesIncludeTeacher = () => {
    const { ui } = this.stores;
    const { document } = this.props;
    const documentContent = document.content;
    let includesTeacher = false;
    if (documentContent) {
      ui.selectedTileIds.forEach(tileId => {
        const tile = documentContent.getTile(tileId);
        if (tile?.display === "teacher") {
          includesTeacher = true;
        }
      });
    }
    return includesTeacher;
  };

  private handleToggleSelectedTilesSolution = () => {
    const { ui } = this.stores;
    const { document } = this.props;
    const documentContent = document.content;
    if (documentContent) {
      const includeTeacher = this.selectedTilesIncludeTeacher();
      ui.selectedTileIds.forEach(tileId => {
        documentContent.getTile(tileId)?.setDisplay(includeTeacher ? undefined : "teacher");
      });
    }
  };

  private handleDragNewTile = (tool: IToolbarButtonModel, e: React.DragEvent<HTMLDivElement>) => {
    // remove hover-insert highlight when we start a tile drag
    this.removeDropRowHighlight();

    const tileContentInfo = getTileContentInfo(tool.id);
    if (tileContentInfo) {
      const dragInfo: IDragToolCreateInfo =
        { toolId: tool.id, title: this.getUniqueTitle(tileContentInfo) };
      e.dataTransfer.setData(kDragTileCreate, JSON.stringify(dragInfo));
    }
  };
}
