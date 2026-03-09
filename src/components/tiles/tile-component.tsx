import React from "react";
import classNames from "classnames";
import { debounce } from "lodash";
import { observer, inject } from "mobx-react";
import { isAlive } from "mobx-state-tree";
import ResizeObserver from "resize-observer-polyfill";
import { transformCurriculumImageUrl } from "../../models/tiles/image/image-import-export";
import { getTileComponentInfo } from "../../models/tiles/tile-component-info";
import { getTileContentInfo } from "../../models/tiles/tile-content-info";
import { ITileModel } from "../../models/tiles/tile-model";
import { isQuestionModel } from "../../models/tiles/question/question-content";
import { BaseComponent } from "../base";
import PlaceholderTileComponent from "./placeholder/placeholder-tile";
import {
  ITileApi, TileResizeEntry, TileApiInterfaceContext, TileModelContext, RegisterToolbarContext
} from "./tile-api";
import { HotKeys } from "../../utilities/hot-keys";
import { TileCommentsComponent } from "./tile-comments";
import { LinkIndicatorComponent } from "./link-indicator";
import { hasSelectionModifier } from "../../utilities/event-utils";
import { getDocumentContentFromNode } from "../../utilities/mst-utils";
import { userSelectTile } from "../../models/stores/ui";
import { IContainerContextType, useContainerContext } from "../document/container-context";
import "../../utilities/dom-utils";

import TileDragHandle from "../../assets/icons/drag-tile/move.svg";
import TileResizeHandle from "../../assets/icons/resize-tile/expand-handle.svg";
import dragPlaceholderImage from "../../assets/image_drag.png";
import QuestionBadge from "../../assets/icons/question-badge.svg";

import "./tile-component.scss";

export const kDragTiles = "org.concord.clue.drag-tiles";

export const kDragRowHeight = "org.concord.clue.row.height";
export const kDragTileSource = "org.concord.clue.tile.src";
export const kDragTileId = "org.concord.clue.tile.id";
export const kDragTileContent = "org.concord.clue.tile.content";
export const kDragTileCreate = "org.concord.clue.tile.create";
// allows source compatibility to be checked in dragOver
export const dragTileSrcDocId = (id: string) => `org.concord.clue.src.${id.toLowerCase()}`;
export const dragTileType = (type: string) => `org.concord.clue.tile.type.${type}`;
const kDefaultDragImageWidth = 80;

export function extractDragTileSrcDocId(dataTransfer: DataTransfer) {
  for (const type of dataTransfer.types) {
    const result = /org\.concord\.clue\.src\.(.*)$/.exec(type);
    if (result) return result[1];
  }
}

export function extractDragTileType(dataTransfer: DataTransfer) {
  if (dataTransfer && dataTransfer.types) {
    for (const type of dataTransfer.types) {
      const result = /org\.concord\.clue\.tile\.type\.(.*)$/.exec(type);
      if (result) return result[1];
    }
  }
}

/**
 * These props are used both by the TileComponent and the components provided by the
 * individual tools.
 */
interface ITileBaseProps {
  context: string;
  documentId?: string;  // permanent id (key) of the containing document
  docId: string;  // ephemeral contentId for the DocumentContent
  documentContent: HTMLElement | null;
  isUserResizable: boolean;
  scale?: number;
  widthPct?: number;
  height?: number;
  indexInRow?: number;
  model: ITileModel;
  readOnly?: boolean;
  onResizeRow: (e: React.DragEvent<HTMLDivElement>) => void;
  onSetCanAcceptDrop: (tileId?: string) => void;
  onRequestRowHeight: (tileId: string, height?: number, deltaHeight?: number) => void;
}

export interface IRegisterTileApiProps {
  onRegisterTileApi: (tileApi: ITileApi, facet?: string) => void;
  onUnregisterTileApi: (facet?: string) => void;
}

export interface ITileProps extends ITileBaseProps, IRegisterTileApiProps {
  tileElt: HTMLElement | null;
  navigatorAllowed?: boolean;
  hovered?: boolean;
}

interface IProps extends ITileBaseProps {
  containerContext?: IContainerContextType;
}

interface IDragTileButtonProps {
  divRef: (instance: HTMLDivElement | null) => void;
  hovered: boolean;
  selected: boolean;
  selectTileHandler: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleTileDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  triggerResizeHandler: () => void;
}
const DragTileButton = (
    { divRef, hovered, selected,
      handleTileDragStart, triggerResizeHandler, selectTileHandler }: IDragTileButtonProps) => {
  const classes = classNames("tool-tile-drag-handle", { hovered, selected });
  return (
    <div className={`tool-tile-drag-handle-wrapper`}
      ref={divRef}
      onDragStart={handleTileDragStart}
      onDragEnd={triggerResizeHandler}
      onClick={selectTileHandler}
      draggable={true}
      data-testid="tool-tile-drag-handle"
      aria-label="Drag to move tile"
    >
      <TileDragHandle className={classes} />
    </div>
  );
};

interface IResizeTileButtonProps {
  divRef: (instance: HTMLDivElement | null) => void;
  hovered: boolean;
  selected: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
}

const ResizeTileButton =
  ({ divRef, hovered, selected, onDragStart }: IResizeTileButtonProps) => {
  const classes = classNames("tool-tile-resize-handle", { hovered, selected });
  return (
    <div className={`tool-tile-resize-handle-wrapper`}
      ref={divRef}
      draggable={true}
      onDragStart={onDragStart}
      aria-label="Drag to resize tile"
    >
      <TileResizeHandle className={classes} />
    </div>
  );
};

interface IState {
  hoverTile: boolean;
}

const defaultDragImage = document.createElement("img");
defaultDragImage.src = dragPlaceholderImage;

@inject("stores")
@observer
class InternalTileComponent extends BaseComponent<IProps, IState> {

  static contextType = TileApiInterfaceContext;
  declare context: React.ContextType<typeof TileApiInterfaceContext>;
  private modelId: string;
  private domElement: HTMLDivElement | null;
  private resizeObserver: ResizeObserver;
  private hotKeys: HotKeys = new HotKeys();
  private toolbarElement: HTMLElement | null = null;
  // Live region element for screen reader announcements (managed via direct DOM to avoid re-renders)
  private liveRegion: HTMLSpanElement | null = null;
  private liveRegionTimer: ReturnType<typeof setTimeout> | null = null;
  private dragElement: HTMLDivElement | null;
  private resizeElement: HTMLDivElement | null;
  private wasSelected = false;

  state = {
    hoverTile: false,
  };

  constructor(props: IProps) {
    super(props);

    const { appConfig } = this.stores;
    const { model } = props;
    const { content: { type } } = model;
    this.modelId = model.id;
    model.setDisabledFeatures(appConfig.getDisabledFeaturesOfTile(type));

    this.hotKeys.register({
      "cmd-option-e": this.handleCopyImportJsonToClipboard,
      "cmd-shift-c": this.handleCopyModelJson
    });
  }

  public componentDidMount() {
    const options = { capture: true, passive: true };
    this.domElement?.addEventListener("touchstart", this.handlePointerDown, options);
    this.domElement?.addEventListener("mousedown", this.handlePointerDown, options);
    // Native capture-phase listener for Tab — React 17's delegated events fire too late
    // to prevent the browser's default Tab focus movement from descendant elements.
    this.domElement?.addEventListener("keydown", this.handleTabKeyDown, true);
    this.domElement?.addEventListener("toolbar-escape", this.handleToolbarEscape);
  }

  public componentDidUpdate(prevProps: IProps) {
    // Scroll the tile into view when it becomes selected.
    const { model } = this.props;
    const isNowSelected = this.stores.ui.isSelectedTile(model);
    if (isNowSelected && !this.wasSelected) {
      this.domElement?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
    this.wasSelected = isNowSelected;

    if (this.domElement && !this.resizeObserver) {
      this.resizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]) => {
        for (const entry of entries) {
          if (entry.target === this.domElement) {
            this.handleResizeDebounced(entry);
          }
        }
      });
      this.resizeObserver.observe(this.domElement);
    }
  }

  public componentWillUnmount() {
    this.resizeObserver?.disconnect();
    this.handleResizeDebounced.cancel();
    if (this.liveRegionTimer) {
      clearTimeout(this.liveRegionTimer);
    }
    const options = { capture: true, passive: true };
    this.domElement?.removeEventListener("mousedown", this.handlePointerDown, options);
    this.domElement?.removeEventListener("touchstart", this.handlePointerDown, options);
    this.domElement?.removeEventListener("keydown", this.handleTabKeyDown, true);
    this.domElement?.removeEventListener("toolbar-escape", this.handleToolbarEscape);
  }

  public render() {
    const { model, readOnly, isUserResizable, widthPct } = this.props;
    const { hoverTile } = this.state;
    const { appConfig, ui, persistentUI } = this.stores;
    const { Component, tileEltClass } = getTileComponentInfo(model.content.type) || {};
    const isPlaceholderTile = Component === PlaceholderTileComponent;
    const isTileSelected = ui.isSelectedTile(model);
    const tileSelectedForComment = isTileSelected && persistentUI.showChatPanel;
    const classes = classNames("tool-tile", model.display, tileEltClass, {
      placeholder: isPlaceholderTile,
      readonly: readOnly,
      fixed: model.isFixedPosition,
      hovered: this.state.hoverTile,
      selected: isTileSelected,
      annotatable: ui.annotationMode !== undefined && model.content.annotatableObjects.length > 0,
      "selected-for-comment": tileSelectedForComment
    });
    const tileTypeName = getTileContentInfo(model.content.type)?.displayName || model.content.type;
    const tileTitle = model.computedTitle;
    const tileAriaLabel = tileTitle ? `${tileTypeName} tile: ${tileTitle}` : `${tileTypeName} tile`;

    const isDraggable = !isPlaceholderTile && !model.isFixedPosition && !appConfig.disableTileDrags;
    const dragTileButton = isDraggable &&
                            <DragTileButton
                              divRef={elt => this.dragElement = elt}
                              hovered={hoverTile}
                              selected={isTileSelected}
                              selectTileHandler={this.selectTileHandler}
                              handleTileDragStart={this.handleTileDragStart}
                              triggerResizeHandler={this.triggerResizeHandler}
                              />;
    const resizeTileButton = isUserResizable &&
                              <ResizeTileButton divRef={elt => this.resizeElement = elt}
                                hovered={hoverTile}
                                selected={isTileSelected}
                                onDragStart={e => this.props.onResizeRow(e)} />;

    const style: React.CSSProperties = {};
    if (widthPct) {
      style.width = `${widthPct}%`;
    }
    return (
      <TileModelContext.Provider value={model}>
        <RegisterToolbarContext.Provider value={this.handleRegisterToolbar}>
          {this.renderQuestionIndicator()}
          <div
            className={classes} data-testid="tool-tile"
            ref={elt => this.domElement = elt}
            data-tool-id={model.id}
            role="group"
            aria-label={tileAriaLabel}
            style={style}
            tabIndex={0}
            onFocus={this.handleFocus}
            onMouseEnter={isDraggable ? e => this.setState({ hoverTile: true }) : undefined}
            onMouseLeave={isDraggable ? e => this.setState({ hoverTile: false }) : undefined}
            onKeyDown={this.handleKeyDown}
          >
            {this.renderLinkIndicators()}
            {dragTileButton}
            {resizeTileButton}
            {this.renderTile(Component)}
            {this.renderTileComments()}
            <span
              ref={el => this.liveRegion = el}
              className="visually-hidden"
              role="status"
              aria-live="polite"
            />
          </div>
        </RegisterToolbarContext.Provider>
      </TileModelContext.Provider>
    );
  }

  private renderTile(Component?: React.ComponentType<ITileProps>) {
    const tileId = this.props.model.id;
    return Component != null
            ? <Component
                key={`tile-component-${tileId}`}
                tileElt={this.domElement}
                hovered={this.state.hoverTile}
                {...this.props}
                readOnly={this.props.readOnly}
                onRegisterTileApi={this.handleRegisterTileApi}
                onUnregisterTileApi={this.handleUnregisterTileApi} />
            : null;
  }

  private renderLinkIndicators() {
    const { model } = this.props;
    const tileApiInterface = this.context;
    const tileApi = tileApiInterface?.getTileApi(model.id);
    const clientTileLinks = tileApi?.getLinkedTiles?.();
    // There are cases where the link ids are empty strings, so we skip those
    const filteredLinks = clientTileLinks?.filter(id => !!id);
    return filteredLinks
            ? filteredLinks.map((id, index) => {
                return <LinkIndicatorComponent key={`linked-tile-${id}`} id={id} index={index} />;
              })
            : null; // tables don't use the original link indicator any more
  }

  private renderTileComments() {
    const tileId = this.props.model.id;
    const { documents } = this.stores;
    const documentContent = documents.findDocumentOfTile(tileId);
    if (documentContent) {
      const commentsModel = documentContent.comments.get(tileId);
      if (commentsModel) {
        return <TileCommentsComponent model={commentsModel} docKey={documentContent.key} />;
      }
    }
  }

  private renderQuestionIndicator() {
    const { model, widthPct, indexInRow } = this.props;
    if (!isQuestionModel(model.content)) return null;

    const style: React.CSSProperties = {};
    if (widthPct && (indexInRow !== undefined)) {
      style.left =`${widthPct * indexInRow}%`;
    }
    return (
      <>
        <div className="question-border" />
        <div style={style} className="question-badge">
          <QuestionBadge />
        </div>
      </>
    );
  }

  private getTileResizeHandler = () => {
    const { model } = this.props;
    // Because this is debounced and can also fire from a browser event, it
    // can happen after the tile has been removed from the document.
    if (!isAlive(model)) return;

    const tileApiInterface = this.context;
    return tileApiInterface?.getTileApi(`${model.id}[layout]`)?.handleTileResize ||
            tileApiInterface?.getTileApi(model.id)?.handleTileResize;
  };

  private handleRegisterTileApi = (tileApi: ITileApi, facet?: string) => {
    const id = facet ? `${this.modelId}[${facet}]` : this.modelId;
    const tileApiInterface = this.context;
    tileApiInterface?.register(id, tileApi);
    // trigger initial render
    this.forceUpdate();
  };

  private handleUnregisterTileApi = (facet?: string) => {
    const id = facet ? `${this.modelId}[${facet}]` : this.modelId;
    const tileApiInterface = this.context;
    tileApiInterface?.unregister(id);
  };

  private handleResizeDebounced = debounce((entry: ResizeObserverEntry) => {
    this.getTileResizeHandler()?.(entry);
  }, 100);

  // Screen reader announcement via visually-hidden aria-live region.
  // Uses direct DOM manipulation to avoid triggering React re-renders.
  private srAnnounce(message: string) {
    if (!this.liveRegion) return;
    if (this.liveRegionTimer) {
      clearTimeout(this.liveRegionTimer);
    }
    this.liveRegion.textContent = message;
    this.liveRegionTimer = setTimeout(() => {
      if (this.liveRegion) this.liveRegion.textContent = "";
      this.liveRegionTimer = null;
    }, 2000);
  }

  private handleRegisterToolbar = (el: HTMLElement | null) => {
    this.toolbarElement = el;
  };

  // toolbar-escape: user pressed Escape from the toolbar (which is in FloatingPortal).
  // Deselects the tile (hides toolbar) and announces exit. The toolbar's own Escape
  // handler focuses the tile container; this handler handles the deselect + SR announcement.
  private handleToolbarEscape = () => {
    const { ui } = this.stores;
    const { model } = this.props;
    ui.removeTileIdFromSelection(model.id);
    this.srAnnounce("Exited tile. Tab to next tile, Shift+Tab to previous.");
  };

  // Returns the focusable elements for this tile's focus trap.
  private getFocusTrapElements() {
    const toolbar = this.toolbarElement;
    const activeToolbarButton = (
      toolbar?.querySelector('button:not([tabindex="-1"])') || toolbar?.querySelector('button')
    ) as HTMLElement | null;

    const tileId = this.props.model.id;
    const tileApiInterface = this.context;
    const tileApi = tileApiInterface?.getTileApi(tileId);
    const focusable = tileApi?.getFocusableElements?.();

    return {
      titleElement: focusable?.titleElement || null,
      activeToolbarButton,
      contentElement: focusable?.contentElement || null,
      focusContent: focusable?.focusContent || null,
    };
  }

  // Tries to focus elements in order, returning true on the first that actually receives focus.
  // Handles elements that exist in the DOM but aren't focusable (e.g., a plain div without tabindex).
  private focusFirstAvailable(...elements: (HTMLElement | null)[]): boolean {
    for (const el of elements) {
      if (el) {
        el.focus();
        if (document.activeElement === el) return true;
      }
    }
    return false;
  }

  // Focuses the content element, preferring the tile's custom focusContent method if available.
  // Some editors (e.g., Slate) require their own focus API to properly initialize cursor/selection.
  private focusContent(contentElement: HTMLElement | null, focusContentFn: (() => boolean) | null): boolean {
    if (focusContentFn) {
      return focusContentFn();
    }
    if (contentElement) {
      contentElement.focus();
      return document.activeElement === contentElement;
    }
    return false;
  }

  // Enters the focus trap, focusing the first (or last if reverse) element.
  // Returns true if focus was moved, false if no focusable elements exist.
  private enterFocusTrap(
    e: { preventDefault: () => void; stopPropagation: () => void },
    reverse = false
  ): boolean {
    const { titleElement, activeToolbarButton, contentElement, focusContent } = this.getFocusTrapElements();

    let focused: boolean;
    if (reverse) {
      focused = this.focusContent(contentElement, focusContent)
        || this.focusFirstAvailable(activeToolbarButton, titleElement);
    } else {
      focused = this.focusFirstAvailable(titleElement, activeToolbarButton)
        || this.focusContent(contentElement, focusContent);
    }

    if (focused) {
      this.srAnnounce("Editing tile. Press Escape to exit.");
      e.preventDefault();
      e.stopPropagation();
      return true;
    }
    return false;
  }

  // Navigate to an adjacent sibling tile. Returns true if a sibling was found.
  // The destination tile receives focus (focus ring via :focus-visible) but is NOT selected.
  // NOTE: Uses DOM selectors (.document-content, .tool-tile[data-tool-id]) to find
  // siblings — if those CSS classes change, keyboard nav will silently break.
  // A model-based approach using getTilesInDocumentOrder() was tried but produced
  // incorrect tab ordering in practice, so DOM queries remain the reliable method.
  private navigateToSiblingTile(e: KeyboardEvent, reverse: boolean): boolean {
    const documentContent = this.domElement?.closest('.document-content');
    const tiles = Array.from(
      documentContent?.querySelectorAll('.tool-tile[data-tool-id]') ?? []
    ) as HTMLElement[];
    const currentIndex = tiles.indexOf(this.domElement!);
    const nextTile = reverse ? tiles[currentIndex - 1] : tiles[currentIndex + 1];
    if (nextTile) {
      nextTile.focus();
      e.preventDefault();
      e.stopPropagation();
      return true;
    }
    return false;
  }

  private handleTabKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;

    const activeElement = document.activeElement as HTMLElement;
    const isTileFocused = activeElement === this.domElement;
    const isInsideTile = this.domElement?.contains(activeElement) && !isTileFocused;

    if (isTileFocused) {
      const { ui } = this.stores;
      if (ui.isSelectedTile(this.props.model)) {
        // Selected tile (via Enter or mouse click): enter focus trap.
        // Toolbar should be in the DOM from the prior render frame.
        if (this.enterFocusTrap(e, e.shiftKey)) return;
      }
      // Not selected (focus-ring-only), or enterFocusTrap failed: navigate to sibling.
      this.navigateToSiblingTile(e, e.shiftKey);
      // If no sibling, let browser handle Tab (moves out of tile area)
      return;
    }

    if (isInsideTile) {
      // Cycling within focus trap from elements inside the tile DOM.
      // (Toolbar handles its own Tab events since it's in FloatingPortal.)
      const { titleElement, activeToolbarButton, contentElement, focusContent } = this.getFocusTrapElements();
      const isOnContent = activeElement === contentElement || contentElement?.contains(activeElement);
      const isOnTitle = activeElement === titleElement;

      if (e.shiftKey) {
        // Shift+Tab: go backward
        if (isOnContent) {
          // Content → toolbar (or title, skipping non-focusable elements)
          this.focusFirstAvailable(activeToolbarButton, titleElement);
          e.preventDefault();
          e.stopPropagation();
          return;
        } else if (isOnTitle) {
          // Title → wrap to content (last element)
          this.focusContent(contentElement, focusContent);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      } else {
        // Tab: go forward
        if (isOnContent) {
          // Content → wrap to title (or toolbar, skipping non-focusable elements)
          this.focusFirstAvailable(titleElement, activeToolbarButton);
          e.preventDefault();
          e.stopPropagation();
          return;
        } else if (isOnTitle) {
          // Title → toolbar (or content, skipping non-focusable elements)
          if (!this.focusFirstAvailable(activeToolbarButton)) {
            this.focusContent(contentElement, focusContent);
          }
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // Catch-all: focus is inside the tile but no cycling conditions matched
      // (e.g., tile doesn't implement getFocusableElements). Deselect and exit
      // to the tile container to prevent a selected-but-unfocusable state.
      const { ui } = this.stores;
      const { model } = this.props;
      ui.removeTileIdFromSelection(model.id);
      this.srAnnounce("Exited tile. Tab to next tile, Shift+Tab to previous.");
      this.domElement?.focus();
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // When the tile container receives focus from outside the tile, announce for SR.
  // Does NOT select the tile or enter the focus trap — Enter is the sole entry mechanism.
  // Uses relatedTarget to distinguish external focus (Tab from toolbar/sibling) from internal
  // focus moves (Escape/ArrowUp exit to container, programmatic .focus() calls).
  private handleFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    // Only announce when focus arrives from outside the tile and its toolbar.
    // Skip when: relatedTarget is null (programmatic focus), inside the tile (Escape/ArrowUp exit),
    // or inside the toolbar (FloatingPortal — toolbar Escape has its own announcement).
    const prev = e.relatedTarget as HTMLElement | null;
    if (!prev || this.domElement?.contains(prev) || this.toolbarElement?.contains(prev)) return;
    // Respect tileHandlesOwnSelection: tiles like placeholders don't need this announcement.
    const { model } = this.props;
    if (getTileComponentInfo(model.content.type)?.tileHandlesOwnSelection) return;
    this.srAnnounce("Tile focused. Press Enter to edit.");
  };

  // React handler for Enter, Escape, ArrowUp exit, and hotkeys (Tab handled natively above)
  private handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const activeElement = document.activeElement as HTMLElement;
    const isTileFocused = activeElement === this.domElement;
    const isInsideTile = this.domElement?.contains(activeElement) && !isTileFocused;

    // Enter on tile container: select the tile unconditionally, then enter focus trap best-effort.
    // Toolbar renders via MobX observer gated on selectedTileIds — it won't be in the DOM yet
    // on this frame, so initial focus goes to content. Toolbar becomes reachable via Tab cycling.
    if (e.key === "Enter" && isTileFocused) {
      const { ui } = this.stores;
      const { model } = this.props;
      ui.setSelectedTileId(model.id, { append: false });
      if (!this.enterFocusTrap(e)) {
        // No content to focus (e.g., drawing tile) — tile is selected, toolbar appears next frame.
        this.srAnnounce("Tile selected. Press Tab to access toolbar, Escape to exit.");
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    const isSelectedOnContainer = isTileFocused && this.stores.ui.isSelectedTile(this.props.model);
    if (e.key === "Escape" && (isInsideTile || isSelectedOnContainer)) {
      // Exit focus trap: deselect the tile (hides toolbar) and return focus to the container.
      const { ui } = this.stores;
      const { model } = this.props;
      ui.removeTileIdFromSelection(model.id);
      this.srAnnounce("Exited tile. Tab to next tile, Shift+Tab to previous.");
      this.domElement?.focus();
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // ArrowUp from a non-editable element exits the focus trap.
    // Editable elements (input, textarea, contenteditable/Slate) keep normal ArrowUp behavior.
    if (e.key === "ArrowUp" && isInsideTile) {
      const isEditable = activeElement.tagName === "INPUT" ||
                         activeElement.tagName === "TEXTAREA" ||
                         activeElement.isContentEditable;
      if (!isEditable) {
        this.domElement?.focus();
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    // Tab is handled by native capture-phase listener (handleTabKeyDown)
    if (e.key === "Tab") return;

    this.hotKeys.dispatch(e);
  };

  private selectTileHandler = (e: React.PointerEvent<HTMLDivElement> | MouseEvent | TouchEvent) => {
    const { model, readOnly, containerContext } = this.props;
    const { ui } = this.stores;
    userSelectTile(ui, model,
      { readOnly, append: hasSelectionModifier(e),
        container: containerContext?.model });
  };

  private handlePointerDown = (e: MouseEvent | TouchEvent) => {
    const { model } = this.props;

    // ignore mousedown on drag element
    let targetElement: HTMLElement | null = e.target as HTMLElement;
    while ((targetElement !== null) && (targetElement !== this.dragElement)) {
      targetElement = targetElement.parentElement;
    }
    if (targetElement === this.dragElement) {
      return;
    }

    // Select the tile if the tool doesn't handle the selection itself
    if (!getTileComponentInfo(model.content.type)?.tileHandlesOwnSelection) {
      this.selectTileHandler(e);
    }
  };

  private handleCopyImportJsonToClipboard = () => {
    const { curriculumConfig, unit } = this.stores;
    const unitBasePath = curriculumConfig.getUnitBasePath(unit.code);
    const transformImageUrl = (url?: string, filename?: string) => {
      return transformCurriculumImageUrl(url, unitBasePath, filename);
    };
    let tileJsonString = this.props.model.exportJson({ transformImageUrl, includeId: true });
    if (tileJsonString) {
      // Put all exported content in a top-level object, under key: "content",
      // but _preserve_ existing formatting (which collapses some elements
      // into a single line; no: indent). But DO indent w.r.t. the new key.
      tileJsonString = (tileJsonString.slice(-1) === "\n")
        ? tileJsonString.slice(0, -1) // Remove trailing new line char.
        : tileJsonString;
    }
    tileJsonString && navigator.clipboard.writeText(tileJsonString);
    return true;
  };

  private handleCopyModelJson = () => {
    const { content } = this.props.model;
    const { clipboard } = this.stores;
    clipboard.clear();
    clipboard.addJsonTileContent(this.props.model.id, content, this.stores);
    return true;
  };

  private handleTileDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    // tile dragging can be disabled globally via appConfig
    if (this.stores.appConfig.disableTileDrags) {
      e.preventDefault();
      return;
    }

    // set the drag data
    const { model, docId } = this.props;

    const Component = getTileComponentInfo(model.content.type)?.Component;
    // can't drag placeholder tiles
    if (Component === PlaceholderTileComponent) {
      e.preventDefault();
      return;
    }
    if (!e.dataTransfer) return;

    const { ui } = this.stores;

    // dragging a tile selects it first
    ui.setSelectedTile(model, { append: hasSelectionModifier(e), dragging: true });

    const documentContent = getDocumentContentFromNode(model);
    if (!documentContent) {
      console.error("Tile model being dragged doesn't have a DocumentContentModel");
      return;
    }

    if (documentContent.contentId !== docId) {
      // TODO: maybe we don't need to pass the docId, then it wouldn't be possible to have a mis-match
      console.warn("The docId passed to TileComponent is different than the " +
        "documentContent.contentId of the model passed to TileComponent");
    }

    const nonFixedTiles = ui.selectedTileIds.filter(id => {
      const tileModel = documentContent.getTile(id);
      return tileModel && !tileModel.fixedPosition;
    });
    const dragTiles = documentContent.getDragTiles(nonFixedTiles);

    e.dataTransfer.setData(kDragTiles, JSON.stringify(dragTiles));

    // We have to set this as a transfer type because the kDragTiles contents are not available in drag over events
    // TODO: document why kDragTiles contents are not available.
    e.dataTransfer.setData(dragTileSrcDocId(docId), docId);

    // to support existing geometry and drawing layer drop logic set the single tile drag fields
    // if only 1 tile is selected
    if (dragTiles.tiles.length === 1) {
      const dragTile = dragTiles.tiles[0];
      e.dataTransfer.setData(kDragTileId, dragTile.tileId);
      e.dataTransfer.setData(kDragTileContent, dragTile.tileContent);
      e.dataTransfer.setData(dragTileType(model.content.type), dragTile.tileType);
    }

    // TODO: should we create an array of drag images here?

    // set the drag image
    const offsetX = kDefaultDragImageWidth;
    const offsetY = 0;
    e.dataTransfer.setDragImage(defaultDragImage, offsetX, offsetY);
  };

  private triggerResizeHandler = () => {
    const handler = this.getTileResizeHandler();
    if (this.domElement && handler) {
      const bounds = this.domElement.getBoundingClientRect();
      const kBorderSize = 4;
      const entry: TileResizeEntry = {
        target: this.domElement,
        contentRect: {
          x: 0,
          y: 0,
          width: bounds.width - kBorderSize,
          height: bounds.height - kBorderSize,
          top: 0,
          right: bounds.width - kBorderSize,
          bottom: bounds.height - kBorderSize,
          left: 0,
          toJSON: () => ""
        }
      };
      // calling the resize handler triggers a re-render
      handler(entry);
    }
  };
}

export const TileComponent = observer((props: IProps) => {
  const containerContext = useContainerContext();
  return <InternalTileComponent {...props} containerContext={containerContext} />;
});
