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
  useKeyboardResize, FocusTrapController,
  type EscapeHandlerResult, type TabHandlerResult,
} from "@concord-consortium/accessibility-tools/hooks";
import { kDefaultTileHeight } from "../constants";
import {
  ITileApi, TileResizeEntry, TileApiInterfaceContext, TileModelContext, RegisterToolbarContext
} from "./tile-api";
import { HotKeys } from "../../utilities/hot-keys";
import { TileActivityBadges } from "./tile-activity-badges";
import { TileCommentsComponent } from "./tile-comments";
import { LinkIndicatorComponent } from "./link-indicator";
import { hasSelectionModifier } from "../../utilities/event-utils";
import { getDocumentContentFromNode } from "../../utilities/mst-utils";
import { userSelectTile } from "../../models/stores/ui";
import { IContainerContextType, useContainerContext } from "../document/container-context";
import { createClueTileStrategy } from "../../hooks/create-clue-tile-strategy";

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
  onResizeRow: (e: React.DragEvent<HTMLElement>) => void;
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
  isPickedUp: boolean;
  handleTileDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragEnd: () => void;
  onPickUpClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}
const DragTileButton = (
    { divRef, hovered, selected, isPickedUp,
      handleTileDragStart, handleDragEnd, onPickUpClick }: IDragTileButtonProps) => {
  const classes = classNames("tool-tile-drag-handle", { hovered, selected });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      if (isPickedUp) {
        // Let the event propagate to handlePickUpKeyDown for placement
        return;
      }
      e.preventDefault();
      onPickUpClick(e as unknown as React.MouseEvent<HTMLDivElement>);
    }
  };

  return (
    <div className={`tool-tile-drag-handle-wrapper`}
      ref={divRef}
      onDragStart={handleTileDragStart}
      onDragEnd={handleDragEnd}
      onClick={onPickUpClick}
      onKeyDown={handleKeyDown}
      draggable={true}
      tabIndex={-1}
      role="button"
      aria-label={isPickedUp ? "Cancel move" : "Move tile"}
      data-testid="tool-tile-drag-handle"
    >
      <TileDragHandle className={classes} />
    </div>
  );
};

interface IResizeTileButtonProps {
  buttonRef: (instance: HTMLButtonElement | null) => void;
  hovered: boolean;
  selected: boolean;
  height: number;
  onDragStart: (e: React.DragEvent<HTMLButtonElement>) => void;
  onResize: (newHeight: number) => void;
}

const ResizeTileButton =
  ({ buttonRef, hovered, selected, height, onDragStart, onResize }: IResizeTileButtonProps) => {
  const classes = classNames("tool-tile-resize-handle", { hovered, selected });

  const resize = useKeyboardResize({
    orientation: "vertical",
    value: height,
    step: 10,
    largeStep: 50,
    onResize,
    label: "Resize tile height",
  });

  // Destructure to omit role (button provides its own semantics).
  // Keep tabIndex from the hook but override to -1 so the button doesn't
  // appear in natural Tab order — the focus trap cycles to it explicitly.
  const { role: _role, ...keyboardProps } = resize?.resizeHandleProps ?? {};

  return (
    <button
      type="button"
      className="tool-tile-resize-handle-wrapper"
      ref={buttonRef}
      draggable={true}
      onDragStart={onDragStart}
      {...keyboardProps}
      tabIndex={-1}
    >
      <TileResizeHandle className={classes} />
    </button>
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
  private resizeElement: HTMLElement | null;
  private focusTrapController: FocusTrapController | null = null;
  private didDrag = false;
  private wasSelected = false;
  // Tracks whether the most recent pointerdown had a selection modifier (shift/cmd).
  // Used by onFocusEnter to honor multi-tile shift-click — focus events alone don't carry the modifier.
  private lastPointerDownHadModifier = false;

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
    // Record lastPointerDown* state at document-capture so it precedes React's
    // delegated capture handlers (which run at the React root). Without this,
    // useTileSelectionPointerEvents focuses the tile and triggers focusin →
    // strategy.onFocusEnter before lastPointerDown* gets recorded, and the
    // shift-click selection ends up with append:false (selection replaced).
    document.addEventListener("mousedown", this.recordPointerDownState, true);
    document.addEventListener("touchstart", this.recordPointerDownState, true);
    this.domElement?.addEventListener("toolbar-escape", this.handleToolbarEscape);

    // Create focus trap controller — handles Tab cycling, Enter/Escape, external elements.
    // Read-only tiles don't get a focus trap — Tab flows naturally through their children.
    if (this.domElement && !this.props.readOnly) {
      this.focusTrapController = new FocusTrapController(
        this.domElement,
        this.buildFocusTrapStrategy()
      );
      this.focusTrapController.setEnabled(
        this.stores.ui.isSelectedTile(this.props.model)
      );
    }
  }

  public componentDidUpdate(prevProps: IProps) {
    // Scroll the tile into view when it becomes selected.
    const { model } = this.props;
    const isNowSelected = this.stores.ui.isSelectedTile(model);
    const justSelected = isNowSelected && !this.wasSelected;
    if (justSelected) {
      this.domElement?.scrollIntoView?.({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
    this.wasSelected = isNowSelected;

    // Toggle focus trap based on selection state.
    // Only rebuild strategy when tile becomes selected (avoids churn on hover/scroll re-renders).
    this.focusTrapController?.setEnabled(isNowSelected);
    if (justSelected) {
      this.focusTrapController?.setStrategy(this.buildFocusTrapStrategy());
    }

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
    // If this component initiated a drag and is being unmounted before dragend fires
    // (e.g. tile moved to a different row), clean up the body class so tiles unshrink.
    if (this.didDrag) {
      this.didDrag = false;
      this.handleDragEnd();
    }
    this.resizeObserver?.disconnect();
    this.handleResizeDebounced.cancel();
    if (this.liveRegionTimer) {
      clearTimeout(this.liveRegionTimer);
    }
    const options = { capture: true, passive: true };
    this.domElement?.removeEventListener("mousedown", this.handlePointerDown, options);
    this.domElement?.removeEventListener("touchstart", this.handlePointerDown, options);
    document.removeEventListener("mousedown", this.recordPointerDownState, true);
    document.removeEventListener("touchstart", this.recordPointerDownState, true);
    this.domElement?.removeEventListener("toolbar-escape", this.handleToolbarEscape);
    this.focusTrapController?.destroy();
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
    const isPickedUp = ui.pickedUpTileId === model.id;
    const dragTileButton = isDraggable &&
                            <DragTileButton
                              divRef={elt => this.dragElement = elt}
                              hovered={hoverTile}
                              selected={isTileSelected}
                              isPickedUp={isPickedUp}
                              handleTileDragStart={this.handleTileDragStart}
                              handleDragEnd={this.handleDragEnd}
                              onPickUpClick={this.handlePickUpClick}
                              />;
    const tileHeight = this.props.height ?? kDefaultTileHeight;
    const resizeTileButton = isUserResizable &&
                              <ResizeTileButton buttonRef={elt => this.resizeElement = elt}
                                hovered={hoverTile}
                                selected={isTileSelected}
                                height={tileHeight}
                                onDragStart={e => this.props.onResizeRow(e)}
                                onResize={h => this.props.onRequestRowHeight(model.id, h)} />;
    const activityBadges = (
      <TileActivityBadges
        documentKey={this.props.documentId ?? ""}
        tileId={model.id}
        hovered={hoverTile}
        selected={isTileSelected}
      />
    );

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
            {activityBadges}
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

  // Returns the model that should be selected/deselected on behalf of this tile.
  // For read-only tiles inside a container (e.g. problem document with linked
  // workspace tiles), selection operates on the container model, not the inner
  // tile — matching userSelectTile / handlePointerDown behavior.
  private getEffectiveSelectionModel() {
    const { model, readOnly, containerContext } = this.props;
    return (readOnly && containerContext?.model) ? containerContext.model : model;
  }

  // Builds a FocusTrapStrategy from the current tile's elements.
  private buildFocusTrapStrategy() {
    const { model } = this.props;
    const trapElements = this.getFocusTrapElements();
    const tabWithinSlots = trapElements.tabWithinSlots;
    // Forward only the slot-handler keys the inner tile actually claims —
    // any present tabHandlers entry tells the trap "this slot manages its own
    // tabindex", which would silently break default within-slot Tab navigation
    // for slots the tile didn't opt in to. Handlers resolve dynamically so the
    // inner tile can update its map between strategy builds.
    const escapeHandlers: Record<string, (e: KeyboardEvent) => EscapeHandlerResult> = {};
    const tabHandlers: Record<string, (e: KeyboardEvent, reverse: boolean) => TabHandlerResult> = {};
    const innerEscape = trapElements.escapeHandlers;
    if (innerEscape) {
      for (const slot of Object.keys(innerEscape)) {
        escapeHandlers[slot] = (e) =>
          this.getFocusTrapElements().escapeHandlers?.[slot]?.(e) ?? "exit";
      }
    }
    const innerTab = trapElements.tabHandlers;
    if (innerTab) {
      for (const slot of Object.keys(innerTab)) {
        tabHandlers[slot] = (e, reverse) =>
          this.getFocusTrapElements().tabHandlers?.[slot]?.(e, reverse) ?? "exit";
      }
    }
    const strategy = createClueTileStrategy({
      onRegisterTileApi: () => {}, // Not used here — individual tiles handle registration
      onUnregisterTileApi: () => {},
      tileType: model.content.type,
      getContentElement: () => this.getFocusTrapElements().contentElement ?? undefined,
      getTitleElement: () => this.getFocusTrapElements().titleElement ?? undefined,
      getToolbarElement: () => this.toolbarElement ?? undefined,
      getTopbarElement: () => this.getFocusTrapElements().topbarElement ?? undefined,
      getPaletteElement: () => this.getFocusTrapElements().paletteElement ?? undefined,
      getDragHandleElement: () => this.dragElement ?? undefined,
      getResizeElement: () => this.resizeElement ?? undefined,
      focusContent: (context) => this.getFocusTrapElements().focusContent?.(context) ?? false,
      onTabWhenInactive: (e, reverse) => this.navigateToSiblingTile(e, reverse),
      tabWithinSlots,
      escapeHandlers: Object.keys(escapeHandlers).length ? escapeHandlers : undefined,
      tabHandlers: Object.keys(tabHandlers).length ? tabHandlers : undefined,
    });
    // Deselect the tile when the controller exits (Escape, setEnabled(false))
    strategy.onExit = () => {
      const { ui } = this.stores;
      ui.removeTileIdFromSelection(this.getEffectiveSelectionModel().id);
    };
    // Select the tile when focus enters via mouse click (handles tileHandlesOwnSelection tiles
    // where the title sits outside .tile-content and no tile-level handler runs — e.g. drawing).
    // Skip when the click landed inside .tile-content: the tile's own click handler will
    // select with the correct append behavior, and a fallback here races ahead and gets toggled
    // off by the later append:true call (canvas_test_spec shift-click scenario).
    // Use setSelectedTile directly (not the debounced userSelectTile) since focus entry is
    // a single committed user action, not a burst of rapid click events.
    strategy.onFocusEnter = () => {
      // Skip when focus landed inside .tile-content: the tile's own click handler
      // (e.g. useTileSelectionPointerEvents for geometry) will handle selection
      // with the correct append behavior. Use document.activeElement rather than
      // a pointerdown-recorded flag because React's delegated capture handlers
      // may run before our pointerdown listener — by the time onFocusEnter fires
      // (synchronously inside useTileSelectionPointerEvents.focus()), the focused
      // element is correct but the pointerdown bookkeeping may still be stale.
      const active = document.activeElement as HTMLElement | null;
      if (active && this.domElement?.contains(active) && active.closest('.tile-content')) {
        return;
      }
      const { ui } = this.stores;
      if (!ui.isSelectedTile(model)) {
        ui.setSelectedTile(this.getEffectiveSelectionModel(),
          { append: this.lastPointerDownHadModifier });
      }
    };
    return strategy;
  }

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
      topbarElement: focusable?.topbarElement || null,
      paletteElement: focusable?.paletteElement || null,
      tabWithinSlots: focusable?.tabWithinSlots,
      tabHandlers: focusable?.tabHandlers,
      escapeHandlers: focusable?.escapeHandlers,
      resizeHandle: this.resizeElement,
    };
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

  // When the tile container receives focus from outside the tile, announce for SR.
  // For editable tiles: does NOT select the tile — Enter is the sole entry mechanism.
  // For read-only tiles: selects the tile so readaloud knows which tile is current.
  // Uses relatedTarget to distinguish external focus (Tab from toolbar/sibling) from internal
  // focus moves (Escape/ArrowUp exit to container, programmatic .focus() calls).
  private handleFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    const prev = e.relatedTarget as HTMLElement | null;
    const fromOutside = prev && !this.domElement?.contains(prev);

    // For read-only tiles, select on focus so readaloud targets the
    // focused tile. Only select when focus arrives from outside the tile
    // (Tab navigation) and the tile is not already selected. Skip if
    // already selected to avoid disrupting multi-select drag operations.
    // Use getEffectiveSelectionModel() so container tiles (which select
    // the container model, not the inner tile) are checked correctly.
    const { ui } = this.stores;
    if (this.props.readOnly && fromOutside && !ui.isSelectedTile(this.getEffectiveSelectionModel())) {
      this.selectTile(false);
    }
    if (e.target !== e.currentTarget) return;
    // Only announce when focus arrives from outside the tile and its toolbar.
    // Skip when: relatedTarget is null (programmatic focus), inside the tile (Escape/ArrowUp exit),
    // or inside the toolbar (FloatingPortal — toolbar Escape has its own announcement).
    if (!prev || this.domElement?.contains(prev) || this.toolbarElement?.contains(prev)) return;
    // Respect tileHandlesOwnSelection: tiles like placeholders don't need this.
    const { model } = this.props;
    if (getTileComponentInfo(model.content.type)?.tileHandlesOwnSelection) return;
    this.srAnnounce(this.props.readOnly ? "Tile focused." : "Tile focused. Press Enter to edit.");
  };

  // React handler for Enter, Escape, ArrowUp exit, and hotkeys.
  // Tab cycling is handled by FocusTrapController (capture phase).
  private handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const activeElement = document.activeElement as HTMLElement;
    const isTileFocused = activeElement === this.domElement;
    const isInsideTile = this.domElement?.contains(activeElement) && !isTileFocused;

    // Enter on tile container: select the tile and enable the focus trap.
    // The controller handles Enter→enterTrap in its own capture-phase listener
    // once enabled. On the first Enter (tile not yet selected), we need to select
    // and enable before the controller can act — but the capture handler already
    // ran (and did nothing since enabled=false). So we call enterTrap() here.
    if (e.key === "Enter" && isTileFocused) {
      const { ui } = this.stores;
      const { model } = this.props;
      const wasAlreadySelected = ui.isSelectedTile(model);
      // Match userSelectTile / onFocusEnter: select the container model for read-only
      // tiles inside a container so all entry paths agree on which tile is selected.
      ui.setSelectedTileId(this.getEffectiveSelectionModel().id, { append: false });
      if (this.props.readOnly) {
        // Read-only tiles have no focus trap — Enter just selects and announces.
        if (!wasAlreadySelected) {
          this.srAnnounce("Tile selected. Press Tab to navigate contents.");
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      if (!wasAlreadySelected) {
        // First Enter: select + enable + enter trap
        this.focusTrapController?.setEnabled(true);
        this.focusTrapController?.setStrategy(this.buildFocusTrapStrategy());
        this.focusTrapController?.enterTrap();
        // Announce via the tile's live region. If enterTrap didn't move focus
        // (no slots available), use a fallback message.
        const focusMoved = document.activeElement !== this.domElement;
        this.srAnnounce(focusMoved
          ? "Editing tile. Press Escape to exit."
          : "Tile selected. Press Tab to access toolbar, Escape to exit.");
        e.preventDefault();
        e.stopPropagation();
      }
      // If already selected, the controller's capture handler already called enterTrap
      return;
    }

    // Escape is handled by FocusTrapController (capture phase).
    // The controller's exitTrap calls strategy.onExit which deselects the tile.

    // ArrowUp from a non-editable element is a "soft exit" — focus returns to the
    // tile container but the tile stays selected so Tab re-enters the trap.
    // Editable elements (input, textarea, contenteditable/Slate) keep normal ArrowUp behavior.
    // The resize handle uses ArrowUp/Down for resizing, so it's excluded.
    if (e.key === "ArrowUp" && isInsideTile) {
      const isOnResize = this.resizeElement?.contains(activeElement);
      const isEditable = activeElement.tagName === "INPUT" ||
                         activeElement.tagName === "TEXTAREA" ||
                         activeElement.isContentEditable;
      if (!isEditable && !isOnResize) {
        // Soft exit: don't call exitTrap() (which would deselect via onExit).
        // Just focus the container — controller stays enabled, so Tab re-enters.
        this.domElement?.focus();
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    // Tab is handled by FocusTrapController (capture phase)
    if (e.key === "Tab") return;

    this.hotKeys.dispatch(e);
  };

  private selectTile = (append = false) => {
    const { model, readOnly, containerContext } = this.props;
    const { ui } = this.stores;
    userSelectTile(ui, model,
      { readOnly, append,
        container: containerContext?.model });
  };

  private selectTileHandler = (e: React.PointerEvent<HTMLDivElement> | MouseEvent | TouchEvent) => {
    this.selectTile(hasSelectionModifier(e));
  };

  // Document-level capture handler: records lastPointerDownHadModifier before
  // React's delegated capture handlers (and any synchronous focusin → onFocusEnter
  // they trigger) can read it. Only updates when the event target is inside this
  // tile's domElement so siblings don't clobber each other.
  private recordPointerDownState = (e: MouseEvent | TouchEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target || !this.domElement?.contains(target)) return;
    this.lastPointerDownHadModifier = hasSelectionModifier(e);
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

    this.didDrag = true;

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

    // A real drag started — cancel any active click-to-pick
    if (ui.isTilePickedUp) {
      ui.clearPickedUpTile();
    }

    // Shrink all tiles to reveal drop zones (see tile-component.scss)
    document.body.classList.add("tile-dragging");

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

  private handleDragEnd = () => {
    // Note: didDrag is NOT cleared here — handlePickUpClick consumes the flag
    // to distinguish click-after-drag from a genuine pick-up click.
    // componentWillUnmount clears it on teardown.
    document.body.classList.remove("tile-dragging");
    this.triggerResizeHandler();
  };

  private handlePickUpClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Always select the tile on handle click
    this.selectTile(hasSelectionModifier(e));

    // If a real drag just happened, don't trigger pick-up
    if (this.didDrag) {
      this.didDrag = false;
      return;
    }

    const { model, docId } = this.props;
    const { ui } = this.stores;

    if (ui.pickedUpTileId === model.id) {
      // Re-clicking the same handle cancels pick-up
      ui.clearPickedUpTile();
    } else {
      ui.pickUpTile(model.id, docId, model.content.type, e.clientX, e.clientY);
    }

    // Prevent the click from bubbling to document-content's click handler,
    // which would immediately try to place the just-picked-up tile.
    e.stopPropagation();
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
