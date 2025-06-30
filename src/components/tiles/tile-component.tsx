import React from "react";
import classNames from "classnames";
import { debounce } from "lodash";
import { observer, inject } from "mobx-react";
import { isAlive } from "mobx-state-tree";
import ResizeObserver from "resize-observer-polyfill";
import { transformCurriculumImageUrl } from "../../models/tiles/image/image-import-export";
import { getTileComponentInfo } from "../../models/tiles/tile-component-info";
import { ITileModel } from "../../models/tiles/tile-model";
import { isQuestionModel } from "../../models/tiles/question/question-content";
import { BaseComponent } from "../base";
import PlaceholderTileComponent from "./placeholder/placeholder-tile";
import { ITileApi, TileResizeEntry, TileApiInterfaceContext, TileModelContext } from "./tile-api";
import { HotKeys } from "../../utilities/hot-keys";
import { TileCommentsComponent } from "./tile-comments";
import { LinkIndicatorComponent } from "./link-indicator";
import { hasSelectionModifier } from "../../utilities/event-utils";
import { getDocumentContentFromNode } from "../../utilities/mst-utils";
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
export class TileComponent extends BaseComponent<IProps, IState> {

  static contextType = TileApiInterfaceContext;
  declare context: React.ContextType<typeof TileApiInterfaceContext>;
  private modelId: string;
  private domElement: HTMLDivElement | null;
  private resizeObserver: ResizeObserver;
  private hotKeys: HotKeys = new HotKeys();
  private dragElement: HTMLDivElement | null;
  private resizeElement: HTMLDivElement | null;

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
  }

  public componentDidUpdate(prevProps: IProps) {
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
    const options = { capture: true, passive: true };
    this.domElement?.removeEventListener("mousedown", this.handlePointerDown, options);
    this.domElement?.removeEventListener("touchstart", this.handlePointerDown, options);
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
        {this.renderQuestionIndicator()}
        <div
          className={classes} data-testid="tool-tile"
          ref={elt => this.domElement = elt}
          data-tool-id={model.id}
          style={style}
          tabIndex={-1}
          onMouseEnter={isDraggable ? e => this.setState({ hoverTile: true }) : undefined}
          onMouseLeave={isDraggable ? e => this.setState({ hoverTile: false }) : undefined}
          onKeyDown={this.handleKeyDown}
        >
          {this.renderLinkIndicators()}
          {dragTileButton}
          {resizeTileButton}
          {this.renderTile(Component)}
          {this.renderTileComments()}
        </div>
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

  private handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    this.hotKeys.dispatch(e);
  };

  private selectTileHandler = (e: React.PointerEvent<HTMLDivElement>) => {
    const { model } = this.props;
    const { ui } = this.stores;
    ui.setSelectedTile(model, {append: hasSelectionModifier(e)});
  };

  private handlePointerDown = (e: MouseEvent | TouchEvent) => {
    const { model } = this.props;
    const { ui } = this.stores;

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
      ui.setSelectedTile(model, {append: hasSelectionModifier(e)});
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
