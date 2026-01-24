import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent, IBaseProps } from "./base";
import { DocumentModelType } from "../models/document/document";
import { IToolbarModel } from "../models/stores/problem-configuration";
import { IToolbarButtonModel, ToolbarButtonModel } from "../models/tiles/toolbar-button";
import { getTileContentInfo, ITileContentInfo } from "../models/tiles/tile-content-info";
import { IDocumentContentAddTileOptions, IDragToolCreateInfo } from "../models/document/document-content-types";
import { DeleteButton } from "./delete-button";
import { IToolbarButtonProps, ToolbarButtonComponent } from "./toolbar-button";
import { EditableTileApiInterfaceRefContext } from "./tiles/tile-api";
import { kDragTileCreate  } from "./tiles/tile-component";
import { SectionModelType } from "../models/curriculum/section";
import { IDropTileItem } from "../models/tiles/tile-model";
import { logHistoryEvent } from "../models/history/log-history-event";
import { LogEventName } from "../lib/logger-types";
import { IToolbarEventProps, logToolbarEvent } from "../models/tiles/log/log-toolbar-event";
import { DEBUG_HISTORY_VIEW } from "../lib/debug";
import { appIcons } from "../clue/app-icons";

import "./toolbar.scss";

// Buttons with these IDs are no longer displayed in this toolbar.
// They are legal in the config for historical reasons but will be ignored here.
// (See `annotation-toolbar.tsx`)
const ignoredButtons = [ "sparrow", "hide-annotations" ];

export type OnToolClickedHandler = (tool: IToolbarButtonModel) => boolean|void;

// This toolbar works with both the document and section models.
// Since many of the tools are shared between the two, each model is
// passed as an optional prop instead of using two separate components.
interface IProps extends IBaseProps {
  document?: DocumentModelType;
  section?: SectionModelType;
  toolbarModel: IToolbarModel;
  disabledToolIds?: string[];
  defaultSectionId?: string;
  onToolClicked?: OnToolClickedHandler;
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
      // this allows the parent component to handle the click event
      // if it returns true, the default action is prevented
      if (this.props.onToolClicked?.(tool)) {
        return;
      }

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
        case "duplicate":
          this.handleDuplicate();
          break;
        case "solution":
          this.handleToggleSelectedTilesSolution();
          break;
        case "edit":
          this.handleEdit();
          break;
        case "selectAll":
          this.handleSelectAll();
          break;
        case "togglePlayback":
          this.handleTogglePlayback();
          break;
        case "copyToWorkspace":
          this.handleCopyToWorkspace();
          break;
        case "copyToDocument":
          this.handleCopyToDocument();
          break;
        case "historyView":
          this.handleToggleHistoryView();
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
    const updateToolButton = (toolButton: IToolbarButtonModel) => {
      // Currently no-op; no buttons need updates.
    };
    const renderToolButtons = (buttons: IToolbarModel) => {
      return buttons.map(toolButton => {
        if (ignoredButtons.includes(toolButton.id)) return null;
        updateToolButton(toolButton);
        const buttonProps: IToolbarButtonProps = {
          toolButton,
          isActive: this.isButtonActive(toolButton),
          isDisabled: this.isButtonDisabled(toolButton),
          isPrimary: this.isButtonPrimary(toolButton),
          height: toolButton.height,
          onSetToolActive: handleSetActiveTool,
          onClick: handleClickTool,
          onDragStart: handleDragTool,
          onShowDropHighlight: this.getShowDropRowHighlight(toolButton),
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
    const upperButtons = this.props.toolbarModel.filter(button => !button.isBottom) as IToolbarModel;
    const lowerButtons = this.props.toolbarModel.filter(button => button.isBottom) as IToolbarModel;
    if (DEBUG_HISTORY_VIEW) {
      console.log("ToolbarComponent.render: adding historyView button");
      lowerButtons.push(ToolbarButtonModel.create({
        id: "historyView",
        title: "View History",
        iconId: "icon-history-view-tool",
        isTileTool: false,
        isBottom: true
      }, { appIcons }))
    }

    return (
      <div className="toolbar" data-testid="toolbar">
        <div className="toolbar-upper">
          {renderToolButtons(upperButtons)}
        </div>
        <div className="toolbar-lower">
          {renderToolButtons(lowerButtons)}
        </div>
      </div>
    );
  }

  private getShowDropRowHighlight(toolButton: IToolbarButtonModel) {
    return ["duplicate"].includes(toolButton.id)
      ? this.showDropRowHighlightAfterSelectedTiles
      : this.showDefaultDropRowHighlight;
  }

  private showDefaultDropRowHighlight = () => {
    const { document } = this.props;
    document?.content?.showPendingInsertHighlight(true);
  };

  private showDropRowHighlightAfterSelectedTiles = () => {
    const { document } = this.props;
    if (!document?.content) return;
    const { ui: { selectedTileIds } } = this.stores;
    const tilePositions = document.content.getTilePositions(Array.from(selectedTileIds)) || [];
    const rowId = document.content.getLastRowForTiles(tilePositions);
    document.content.showPendingInsertHighlight(true, rowId);
  };

  private removeDropRowHighlight = () => {
    const { document } = this.props;
    document?.content?.showPendingInsertHighlight(false);
  };

  private getUniqueTitle(tileContentInfo: ITileContentInfo) {
    const { document } = this.props;
    const { type } = tileContentInfo;
    return document?.getUniqueTitleForType(type);
  }

  private isButtonActive(toolButton: IToolbarButtonModel) {
    if (toolButton.id === "solution") {
      return this.selectedTilesIncludeTeacher();
    } else {
      return toolButton === this.state.activeTool;
    }
  }

  private isButtonPrimary(toolButton: IToolbarButtonModel) {
    return !!toolButton.isPrimary;
  }

  private isButtonDisabled(toolButton: IToolbarButtonModel) {
    const { document } = this.props;
    const {
      appConfig: { settings },
      persistentUI: {problemWorkspace: { primaryDocumentKey } }
    } = this.stores;

    const selectedTileIds = this.getSelectedTileIdsInDocument();

    const undoManager = document?.treeManagerAPI?.undoManager;
    if (toolButton.id === "undo" && !undoManager?.canUndo) return true;
    if (toolButton.id === "redo" && !undoManager?.canRedo) return true;

    // If no tiles are selected, disable the tools that require selected tiles
    const needsSelectedTilesTools = ["delete", "duplicate", "solution", "copyToWorkspace", "copyToDocument"];
    if (needsSelectedTilesTools.includes(toolButton.id) && !selectedTileIds.length) {
      return true;
    }

    // don't allow the following tools when the document is the primary document
    const disallowedPrimaryDocumentTools = ["edit", "copyToWorkspace"];
    if (disallowedPrimaryDocumentTools.includes(toolButton.id) && document?.key === primaryDocumentKey) {
      return true;
    }

    if (toolButton.isTileTool && settings) {
      // If a limit on the number of tiles of a certain type has been specified in settings,
      // disable the related tile button when that limit is reached.
      const tilesOfTypeCount = document?.content?.getTilesOfType(toolButton.id).length || 0;
      const tileSettings = settings[toolButton.id.toLowerCase()] as Record<string, any>;
      const maxTilesOfType = tileSettings ? tileSettings.maxTiles : undefined;
      if (maxTilesOfType && tilesOfTypeCount >= maxTilesOfType) return true;
    }

    if (this.props.disabledToolIds?.includes(toolButton.id)) {
      return true;
    }

    return false;
  }

  private getSelectedTileIdsInDocument = () => {
    const { document, section } = this.props;
    const { ui: { selectedTileIds } } = this.stores;

    const content = document?.content ?? section?.content;
    return selectedTileIds.reduce((acc, tileId) => {
      if (content?.getTile(tileId)) {
        acc.push(tileId);
      }
      return acc;
    }, [] as string[]);
  };

  private handleAddTile(tool: IToolbarButtonModel) {
    const { document } = this.props;
    const { ui } = this.stores;
    const tileContentInfo = getTileContentInfo(tool.id);
    if (!tileContentInfo) return;

    if (ui.annotationMode !== undefined) {
      // If we're currently annotating the document, switch to normal edit mode
      ui.setAnnotationMode();
      return;
    }

    const newTileOptions: IDocumentContentAddTileOptions = {
            insertRowInfo: {
              rowDropId: document?.content?.defaultInsertRowId,
              rowInsertIndex: document?.content?.defaultInsertRowIndex || 0,
              rowDropLocation: "bottom"
            }
          };
    const rowTile = document?.addTile(tool.id, newTileOptions);
    if (document && rowTile && rowTile.tileId) {
      ui.setSelectedTileId(rowTile.tileId);
      this.setState(state => ({ activeTool: state.defaultTool }));
      // Scroll to the new tile once it has been added to the correct location
      // We need to use a timeout because tiles are added in one spot, then moved elsewhere
      // TODO When tiles are created in the right place, the timeout here should be removed
      setTimeout(() => ui.setScrollTo(rowTile.tileId, document.key));
    }
  }

  private handleSelect() {
    this.stores.ui.setAnnotationMode();
  }

  private handleUndo() {
    this.props.document?.undoLastAction();
  }

  private handleRedo() {
    this.props.document?.redoLastAction();
  }

  private handleDelete() {
    this.showDeleteTilesConfirmationAlert?.();
    this.setState(state => ({ activeTool: state.defaultTool }));
  }

  private handleDuplicate() {
    const { document } = this.props;
    const { ui } = this.stores;
    const selectedTileIds = ui.selectedTileIds;
    if (!document?.content) return;

    // Sort the selected tile ids in top->bottom, left->right order so they duplicate in the correct formation
    const tilePositions = document.content.getTilePositions(Array.from(selectedTileIds)) || [];
    const selectedDragTileItems = document.content.getDragTileItems(tilePositions.map(info => info.tileId)) || [];
    const dragTileItems = document.content.addEmbeddedTilesToDragTiles(selectedDragTileItems);

    document.content.duplicateTiles(dragTileItems);
    ui.clearSelectedTiles();
    this.removeDropRowHighlight();
  }

  private setShowDeleteTilesConfirmationAlert = (showAlert: () => void) => {
    this.showDeleteTilesConfirmationAlert = showAlert;
  };

  private handleDeleteSelectedTiles = () => {
    const { ui } = this.stores;
    const { document } = this.props;
    ui.selectedTileIds.forEach(tileId => {
      ui.removeTileIdFromSelection(tileId);
      document?.deleteTile(tileId);
    });
  };

  // Returns true if any of the selected tiles have display: "teacher"
  private selectedTilesIncludeTeacher = () => {
    const { ui } = this.stores;
    const { document } = this.props;
    const documentContent = document?.content;
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
    const documentContent = document?.content;
    if (documentContent) {
      const display = this.selectedTilesIncludeTeacher() ? undefined : "teacher";
      ui.selectedTileIds.forEach(tileId => {
        documentContent.getTile(tileId)?.setDisplay(display);
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

  private logDocumentOrSectionEvent = (
    event: LogEventName, otherParams: Record<string, any> = {}, targetDocument?: DocumentModelType
  ) => {
    const { document, section } = this.props;
    const eventProps: IToolbarEventProps = { document, section, targetDocument };
    logToolbarEvent(event, eventProps, otherParams);
  };

  private handleEdit = () => {
    const { document } = this.props;
    if (document) {
      this.stores.persistentUI.problemWorkspace.setPrimaryDocument(document);
      this.logDocumentOrSectionEvent(LogEventName.TOOLBAR_EDIT_TOOL);
    }
  };

  private handleSelectAll = () => {
    const { ui, isShowingTeacherContent } = this.stores;
    const { document, section } = this.props;

    const content = document?.content ?? section?.content;
    if (content) {
      const allTileIds = content.getAllTileIds(isShowingTeacherContent);
      const selectedTileIds = this.getSelectedTileIdsInDocument();

      // If there are no selected tiles, or the number of selected tiles is not equal to the number of all tiles,
      // then select all tiles. Otherwise, clear the selection.
      const selectAllTiles = selectedTileIds.length === 0 || selectedTileIds.length !== allTileIds.length;
      if (selectAllTiles) {
        ui.selectAllTiles(allTileIds);
      } else {
        ui.selectAllTiles([]);
      }

      this.logDocumentOrSectionEvent(LogEventName.TOOLBAR_SELECT_ALL_TOOL, {selectAllTiles});
    }
  };

  private handleToggleHistoryView = () => {
    this.stores.persistentUI.toggleHistoryView();
  };

  private handleTogglePlayback = () => {
    const { document } = this.props;
    if (document) {
      const prevShowPlaybackControls = document.showPlaybackControls;
      logHistoryEvent({documentId: document.key || '',
        action: prevShowPlaybackControls ? "hideControls" : "showControls"});
      document.toggleShowPlaybackControls();

      this.logDocumentOrSectionEvent(LogEventName.TOOLBAR_PLAYBACK_TOOL, {
        showPlaybackControls: document.showPlaybackControls
      });
    }
  };

  private handleCopyToWorkspace = () => {
    const { documents, ui, persistentUI: { problemWorkspace: { primaryDocumentKey } } } = this.stores;
    const { document, section } = this.props;
    const content = document?.content ?? section?.content;
    const primaryDocument = documents.getDocument(primaryDocumentKey ?? "");

    if (content && primaryDocument?.content && (document?.key !== primaryDocument.key)) {
      const sectionId = document ? undefined : section?.type;
      const copySpec = content.getCopySpec(ui.selectedTileIds, sectionId);
      const copiedTiles = primaryDocument.content.applyCopySpec(copySpec, true);

      this.logDocumentOrSectionEvent(LogEventName.TOOLBAR_COPY_TO_WORKSPACE, {}, primaryDocument);
      this.selectCopiedTiles(copiedTiles);
    }
  };

  private handleCopyToDocument = () => {
    const { ui, documents } = this.stores;
    const { document, section } = this.props;
    const content = document?.content ?? section?.content;

    if (content) {
      ui.getCopyToDocumentKey(document?.key ?? "")
        .then(copyToDocumentKey => {
          const copyToDocument = documents.getDocument(copyToDocumentKey);
          if (copyToDocument?.content) {
            const sectionId = document ? undefined : section?.type;
            const copySpec = content.getCopySpec(ui.selectedTileIds, sectionId);
            const copiedTiles = copyToDocument.content.applyCopySpec(copySpec, true);

            this.logDocumentOrSectionEvent(LogEventName.TOOLBAR_COPY_TO_DOCUMENT, {}, copyToDocument);
            this.selectCopiedTiles(copiedTiles);
          }
        });
    }
  };

  private selectCopiedTiles = (copiedTiles: IDropTileItem[]) => {
    const { ui } = this.stores;
    const copiedTileIds = copiedTiles.map(tile => tile.newTileId);
    ui.selectAllTiles(copiedTileIds);
  };
}
