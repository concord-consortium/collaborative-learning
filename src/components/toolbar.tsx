import { observer } from "mobx-react";
import React, { useEffect, useRef, useState } from "react";
import { useRovingTabindex } from "../hooks/use-roving-tabindex";
import { DocumentModelType } from "../models/document/document";
import { IToolbarModel } from "../models/stores/problem-configuration";
import { IToolbarButtonModel } from "../models/tiles/toolbar-button";
import { getTileContentInfo, ITileContentInfo } from "../models/tiles/tile-content-info";
import { IDocumentContentAddTileOptions, IDragToolCreateInfo } from "../models/document/document-content-types";
import { DeleteButton } from "./delete-button";
import { ReadAloudButton } from "./toolbar/read-aloud-button";
import { useAriaLabels } from "../hooks/use-aria-labels";
import { useStores } from "../hooks/use-stores";
import { IToolbarButtonProps, ToolbarButtonComponent } from "./toolbar-button";
import { kDragTileCreate  } from "./tiles/tile-component";
import { SectionModelType } from "../models/curriculum/section";
import { IDropTileItem } from "../models/tiles/tile-model";
import { logHistoryEvent } from "../models/history/log-history-event";
import { LogEventName } from "../lib/logger-types";
import { IToolbarEventProps, logToolbarEvent } from "../models/tiles/log/log-toolbar-event";

import "./toolbar.scss";

// Buttons with these IDs are no longer displayed in this toolbar.
// They are legal in the config for historical reasons but will be ignored here.
// (See `annotation-toolbar.tsx`)
const ignoredButtons = [ "sparrow", "hide-annotations" ];

export type OnToolClickedHandler = (tool: IToolbarButtonModel) => boolean|void;

// This toolbar works with both the document and section models.
// Since many of the tools are shared between the two, each model is
// passed as an optional prop instead of using two separate components.
interface IProps {
  ariaLabel?: string;
  document?: DocumentModelType;
  section?: SectionModelType;
  pane?: "left" | "right";
  toolbarModel: IToolbarModel;
  disabledToolIds?: string[];
  onToolClicked?: OnToolClickedHandler;
}

export const ToolbarComponent = observer(function ToolbarComponent(props: IProps) {
  const { ariaLabel, document, section, pane: _pane, toolbarModel, disabledToolIds, onToolClicked } = props;
  const pane = _pane ?? (section ? "left" : "right");
  const stores = useStores();
  const ariaLabels = useAriaLabels();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const { handleKeyDown: handleToolbarKeyDown } = useRovingTabindex(toolbarRef);

  const [defaultTool, setDefaultTool] = useState<IToolbarButtonModel | undefined>();
  const [activeTool, setActiveTool] = useState<IToolbarButtonModel | undefined>();
  const showDeleteTilesConfirmationAlertRef = useRef<(() => void) | undefined>();

  useEffect(() => {
    const tool = toolbarModel.find(item => item.isDefault);
    if (tool) {
      setDefaultTool(tool);
      setActiveTool(tool);
    }
  }, [toolbarModel]);

  const getUniqueTitle = (tileContentInfo: ITileContentInfo) => {
    const { type } = tileContentInfo;
    return document?.getUniqueTitleForType(type);
  };

  const removeDropRowHighlight = () => {
    document?.content?.showPendingInsertHighlight(false);
  };

  const showDefaultDropRowHighlight = () => {
    document?.content?.showPendingInsertHighlight(true);
  };

  const showDropRowHighlightAfterSelectedTiles = () => {
    if (!document?.content) return;
    const { ui: { selectedTileIds } } = stores;
    const tilePositions = document.content.getTilePositions(Array.from(selectedTileIds)) || [];
    const rowId = document.content.getLastRowForTiles(tilePositions);
    document.content.showPendingInsertHighlight(true, rowId);
  };

  const getShowDropRowHighlight = (toolButton: IToolbarButtonModel) => {
    return ["duplicate"].includes(toolButton.id)
      ? showDropRowHighlightAfterSelectedTiles
      : showDefaultDropRowHighlight;
  };

  const getSelectedTileIdsInDocument = () => {
    const { ui: { selectedTileIds } } = stores;
    const content = document?.content ?? section?.content;
    return selectedTileIds.reduce((acc, tileId) => {
      if (content?.getTile(tileId)) {
        acc.push(tileId);
      }
      return acc;
    }, [] as string[]);
  };

  const selectedTilesIncludeTeacher = () => {
    const { ui } = stores;
    const documentContent = document?.content;
    if (documentContent) {
      return ui.selectedTileIds.some(tileId => {
        const tile = documentContent.getTile(tileId);
        return tile?.display === "teacher";
      });
    }
    return false;
  };

  const logDocumentOrSectionEvent = (
    event: LogEventName, otherParams: Record<string, any> = {}, targetDocument?: DocumentModelType
  ) => {
    const eventProps: IToolbarEventProps = { document, section, targetDocument };
    logToolbarEvent(event, eventProps, otherParams);
  };

  const selectCopiedTiles = (copiedTiles: IDropTileItem[]) => {
    const { ui } = stores;
    const copiedTileIds = copiedTiles.map(tile => tile.newTileId);
    ui.selectAllTiles(copiedTileIds);
  };

  const isButtonActive = (toolButton: IToolbarButtonModel) => {
    if (toolButton.id === "solution") {
      return selectedTilesIncludeTeacher();
    } else {
      return toolButton === activeTool;
    }
  };

  const isButtonPrimary = (toolButton: IToolbarButtonModel) => {
    return !!toolButton.isPrimary;
  };

  const isButtonDisabled = (toolButton: IToolbarButtonModel) => {
    const {
      appConfig: { settings },
      persistentUI: {problemWorkspace: { primaryDocumentKey } }
    } = stores;

    const selectedTileIds = getSelectedTileIdsInDocument();

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
      // "Diagram" → "diagram", "IframeInteractive" → "iframeinteractive"
      const lowerCaseId = toolButton.id.toLowerCase();
      // "IframeInteractive" → "iframeInteractive" (works for multi-word types where settings use camelCase keys)
      const camelCaseId = toolButton.id.charAt(0).toLowerCase() + toolButton.id.slice(1);
      const tileSettings = (settings[lowerCaseId] || settings[camelCaseId]) as Record<string, any>;
      const maxTilesOfType = tileSettings ? tileSettings.maxTiles : undefined;
      if (maxTilesOfType && tilesOfTypeCount >= maxTilesOfType) return true;
    }

    if (disabledToolIds?.includes(toolButton.id)) {
      return true;
    }

    return false;
  };

  const handleSelect = () => {
    stores.ui.setAnnotationMode();
  };

  const handleUndo = () => {
    document?.undoLastAction();
  };

  const handleRedo = () => {
    document?.redoLastAction();
  };

  const handleDelete = () => {
    showDeleteTilesConfirmationAlertRef.current?.();
    setActiveTool(defaultTool);
  };

  const handleDuplicate = () => {
    const { ui } = stores;
    const selectedTileIds = ui.selectedTileIds;
    if (!document?.content) return;

    // Sort the selected tile ids in top->bottom, left->right order so they duplicate in the correct formation
    const tilePositions = document.content.getTilePositions(Array.from(selectedTileIds)) || [];
    const selectedDragTileItems = document.content.getDragTileItems(tilePositions.map(info => info.tileId)) || [];
    const dragTileItems = document.content.addEmbeddedTilesToDragTiles(selectedDragTileItems);

    document.content.duplicateTiles(dragTileItems);
    ui.clearSelectedTiles();
    removeDropRowHighlight();
  };

  const setShowDeleteTilesConfirmationAlert = (showAlert: () => void) => {
    showDeleteTilesConfirmationAlertRef.current = showAlert;
  };

  const handleDeleteSelectedTiles = () => {
    const { ui } = stores;
    ui.selectedTileIds.forEach(tileId => {
      ui.removeTileIdFromSelection(tileId);
      document?.deleteTile(tileId);
    });
  };

  const handleToggleSelectedTilesSolution = () => {
    const { ui } = stores;
    const documentContent = document?.content;
    if (documentContent) {
      const display = selectedTilesIncludeTeacher() ? undefined : "teacher";
      ui.selectedTileIds.forEach(tileId => {
        documentContent.getTile(tileId)?.setDisplay(display);
      });
    }
  };

  const handleAddTile = (tool: IToolbarButtonModel) => {
    const { ui } = stores;
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
      setActiveTool(defaultTool);
      // Scroll to the new tile once it has been added to the correct location
      // We need to use a timeout because tiles are added in one spot, then moved elsewhere
      // TODO When tiles are created in the right place, the timeout here should be removed
      setTimeout(() => ui.setScrollTo(rowTile.tileId, document.key));
    }
  };

  const handleEdit = () => {
    if (document) {
      stores.persistentUI.problemWorkspace.setPrimaryDocument(document);
      logDocumentOrSectionEvent(LogEventName.TOOLBAR_EDIT_TOOL);
    }
  };

  const handleSelectAll = () => {
    const { ui, isShowingTeacherContent } = stores;

    const content = document?.content ?? section?.content;
    if (content) {
      const allTileIds = content.getAllTileIds(isShowingTeacherContent);
      const selectedTileIds = getSelectedTileIdsInDocument();

      // If there are no selected tiles, or the number of selected tiles is not equal to the number of all tiles,
      // then select all tiles. Otherwise, clear the selection.
      const selectAllTiles = selectedTileIds.length === 0 || selectedTileIds.length !== allTileIds.length;
      if (selectAllTiles) {
        ui.selectAllTiles(allTileIds);
      } else {
        ui.selectAllTiles([]);
      }

      logDocumentOrSectionEvent(LogEventName.TOOLBAR_SELECT_ALL_TOOL, {selectAllTiles});
    }
  };

  const handleToggleHistoryView = () => {
    stores.persistentUI.toggleHistoryView();
  };

  const handleTogglePlayback = () => {
    if (document) {
      const prevShowPlaybackControls = document.showPlaybackControls;
      logHistoryEvent({documentId: document.key || '',
        action: prevShowPlaybackControls ? "hideControls" : "showControls"});
      document.toggleShowPlaybackControls();

      logDocumentOrSectionEvent(LogEventName.TOOLBAR_PLAYBACK_TOOL, {
        showPlaybackControls: document.showPlaybackControls
      });
    }
  };

  const handleCopyToWorkspace = () => {
    const { documents, ui, persistentUI: { problemWorkspace: { primaryDocumentKey } } } = stores;
    const content = document?.content ?? section?.content;
    const primaryDocument = documents.getDocument(primaryDocumentKey ?? "");

    if (content && primaryDocument?.content && (document?.key !== primaryDocument.key)) {
      const sectionId = document ? undefined : section?.type;
      const copySpec = content.getCopySpec(ui.selectedTileIds, sectionId);
      const copiedTiles = primaryDocument.content.applyCopySpec(copySpec, true);

      logDocumentOrSectionEvent(LogEventName.TOOLBAR_COPY_TO_WORKSPACE, {}, primaryDocument);
      selectCopiedTiles(copiedTiles);
    }
  };

  const handleCopyToDocument = () => {
    const { ui, documents } = stores;
    const content = document?.content ?? section?.content;

    if (content) {
      ui.getCopyToDocumentKey(document?.key ?? "")
        .then(copyToDocumentKey => {
          const copyToDocument = documents.getDocument(copyToDocumentKey);
          if (copyToDocument?.content) {
            const sectionId = document ? undefined : section?.type;
            const copySpec = content.getCopySpec(ui.selectedTileIds, sectionId);
            const copiedTiles = copyToDocument.content.applyCopySpec(copySpec, true);

            logDocumentOrSectionEvent(LogEventName.TOOLBAR_COPY_TO_DOCUMENT, {}, copyToDocument);
            selectCopiedTiles(copiedTiles);
          }
        });
    }
  };

  const handleDragTool = (e: React.DragEvent<HTMLButtonElement>, tool: IToolbarButtonModel) => {
    // remove hover-insert highlight when we start a tile drag
    removeDropRowHighlight();

    const tileContentInfo = getTileContentInfo(tool.id);
    if (tileContentInfo) {
      const dragInfo: IDragToolCreateInfo =
        { toolId: tool.id, title: getUniqueTitle(tileContentInfo) };
      e.dataTransfer.setData(kDragTileCreate, JSON.stringify(dragInfo));
    }
  };

  const handleClickTool = (_e: React.MouseEvent<HTMLButtonElement>, tool: IToolbarButtonModel) => {
    // this allows the parent component to handle the click event
    // if it returns true, the default action is prevented
    if (onToolClicked?.(tool)) {
      return;
    }

    switch (tool.id) {
      case "select":
        handleSelect();
        break;
      case "undo":
        handleUndo();
        break;
      case "redo":
        handleRedo();
        break;
      case "delete":
        handleDelete();
        break;
      case "duplicate":
        handleDuplicate();
        break;
      case "solution":
        handleToggleSelectedTilesSolution();
        break;
      case "edit":
        handleEdit();
        break;
      case "selectAll":
        handleSelectAll();
        break;
      case "togglePlayback":
        handleTogglePlayback();
        break;
      case "copyToWorkspace":
        handleCopyToWorkspace();
        break;
      case "copyToDocument":
        handleCopyToDocument();
        break;
      case "historyView":
        handleToggleHistoryView();
        break;
      case "readAloud":
        // NOTE: this is handled by ReadAloudButton which derives active state from the
        // read aloud service, hides when unsupported, adds ARIA attributes,
        // and allows stop-while-disabled.
        break;
      default:
        handleAddTile(tool);
        break;
    }
  };

  const handleSetActiveTool = (tool: IToolbarButtonModel, isActive: boolean) => {
    setActiveTool(isActive ? tool : defaultTool);
  };

  const renderToolButtons = (buttons: IToolbarModel) => {
    return buttons.map(toolButton => {
      if (ignoredButtons.includes(toolButton.id)) return null;
      const buttonProps: IToolbarButtonProps = {
        toolButton,
        isActive: isButtonActive(toolButton),
        isDisabled: isButtonDisabled(toolButton),
        isPrimary: isButtonPrimary(toolButton),
        height: toolButton.height,
        onSetToolActive: handleSetActiveTool,
        onClick: handleClickTool,
        onDragStart: handleDragTool,
        onShowDropHighlight: getShowDropRowHighlight(toolButton),
        onHideDropHighlight: removeDropRowHighlight
      };
      toolButton.initialize();
      switch (toolButton.id) {
        case "delete":
          return <DeleteButton key={toolButton.id}
                               onSetShowDeleteTilesConfirmationAlert={setShowDeleteTilesConfirmationAlert}
                               onDeleteSelectedTiles={handleDeleteSelectedTiles}
                               {...buttonProps} />;
        case "readAloud":
          // ReadAloudButton uses Firestore comment hooks that require fully initialized
          // stores. In the doc-editor (authoring) context, Firestore is disabled, so we
          // skip the ReadAloudButton entirely to avoid crashes.
          if ((window as any).DISABLE_FIREBASE_SYNC) return null;
          return <ReadAloudButton key={toolButton.id}
                                  pane={pane}
                                  document={document}
                                  section={section}
                                  {...buttonProps} />;
        default:
          return <ToolbarButtonComponent key={toolButton.id} {...buttonProps} />;
      }
    });
  };

  const upperButtons = toolbarModel.filter(button => !button.isBottom) as IToolbarModel;
  const lowerButtons = toolbarModel.filter(button => button.isBottom) as IToolbarModel;

  return (
    <div
      aria-label={ariaLabel}
      aria-orientation="vertical"
      className="toolbar"
      data-testid="toolbar"
      onKeyDown={handleToolbarKeyDown}
      ref={toolbarRef}
      role="toolbar"
    >
      <div className="toolbar-upper" role="group" aria-label={ariaLabels.toolbarUpper}>
        {renderToolButtons(upperButtons)}
      </div>
      <div className="toolbar-lower" role="group" aria-label={ariaLabels.toolbarLower}>
        {renderToolButtons(lowerButtons)}
      </div>
    </div>
  );
});
