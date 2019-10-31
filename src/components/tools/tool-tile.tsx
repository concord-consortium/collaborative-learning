import * as React from "react";
import { observer, inject } from "mobx-react";
import { getSnapshot } from "mobx-state-tree";
import { getDisabledFeaturesOfTile } from "../../models/stores/stores";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { kGeometryToolID } from "../../models/tools/geometry/geometry-content";
import { kTableToolID } from "../../models/tools/table/table-content";
import { kTextToolID } from "../../models/tools/text/text-content";
import { kImageToolID } from "../../models/tools/image/image-content";
import { kDrawingToolID } from "../../models/tools/drawing/drawing-content";
import { kPlaceholderToolID } from "../../models/tools/placeholder/placeholder-content";
import { BaseComponent } from "../base";
import GeometryToolComponent from "./geometry-tool/geometry-tool";
import TableToolComponent from "./table-tool/table-tool";
import TextToolComponent from "./text-tool";
import ImageToolComponent from "./image-tool";
import DrawingToolComponent from "./drawing-tool/drawing-tool";
import PlaceholderToolComponent from "./placeholder-tool/placeholder-tool";
import { HotKeys } from "../../utilities/hot-keys";
import { cloneDeep } from "lodash";
import { TileCommentsComponent } from "./tile-comments";
import { LinkIndicatorComponent } from "./link-indicator";
import { IconButton } from "../utilities/icon-button";
import "../../utilities/dom-utils";
import { hasSelectionModifier } from "../../utilities/event-utils";

import "./tool-tile.sass";

export interface IToolApi {
  hasSelection: () => boolean;
  deleteSelection: () => void;
  getSelectionInfo: () => string;
  setSelectionHighlight: (selectionInfo: string, isHighlighted: boolean) => void;
}

export interface IToolApiInterface {
  register: (id: string, toolApi: IToolApi) => void;
  unregister: (id: string) => void;
  getToolApi: (id: string) => IToolApi;
}

export interface IToolApiMap {
  [id: string]: IToolApi;
}

export const kDragTiles = "org.concord.clue.drag-tiles";

export const kDragRowHeight = "org.concord.clue.row.height";
export const kDragTileSource = "org.concord.clue.tile.src";
export const kDragTileId = "org.concord.clue.tile.id";
export const kDragTileContent = "org.concord.clue.tile.content";
export const kDragTileCreate = "org.concord.clue.tile.create";
// allows source compatibility to be checked in dragOver
export const dragTileSrcDocId = (id: string) => `org.concord.clue.src.${id}`;
export const dragTileType = (type: string) => `org.concord.clue.tile.type.${type}`;

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

export interface IDragTileItem {
  rowIndex: number;
  rowHeight: number;
  tileIndex: number;
  tileId: string;
  tileContent: string;
  tileType: string;
  // height?
}

export interface IDragTiles {
  sourceDocId: string;
  items: IDragTileItem[];
}

interface IProps {
  context: string;
  docId: string;
  scale?: number;
  widthPct?: number;
  height?: number;
  model: ToolTileModelType;
  readOnly?: boolean;
  toolApiInterface?: IToolApiInterface;
  onSetCanAcceptDrop: (tileId?: string) => void;
  onRequestRowHeight: (tileId: string, height: number) => void;
}

const kToolComponentMap: any = {
        [kPlaceholderToolID]: PlaceholderToolComponent,
        [kDrawingToolID]: DrawingToolComponent,
        [kGeometryToolID]: GeometryToolComponent,
        [kImageToolID]: ImageToolComponent,
        [kTableToolID]: TableToolComponent,
        [kTextToolID]: TextToolComponent
      };

const DragTileButton = () => {
  return (
    <IconButton icon="select-tool" key={`select-tool`} className={`tool-tile-drag-handle tool select`}
                innerClassName={`icon icon-select-tool`} />
  );
};

@inject("stores")
@observer
export class ToolTileComponent extends BaseComponent<IProps, {}> {

  private domElement: HTMLDivElement | null;
  private hotKeys: HotKeys = new HotKeys();
  private dragElement: HTMLDivElement | null;

  public componentDidMount() {
    const { model } = this.props;
    const { content: { type } } = model;
    model.setDisabledFeatures(getDisabledFeaturesOfTile(this.stores, type));

    const { appMode } = this.stores;
    if (appMode !== "authed") {
      this.hotKeys.register({
        "cmd-shift-c": this.handleCopyJson
      });
    }

    if (this.domElement) {
      this.domElement.addEventListener("mousedown", this.handleMouseDown, true);
    }
  }
  public componentWillUnmount() {
    if (this.domElement) {
      this.domElement.removeEventListener("mousedown", this.handleMouseDown, true);
    }
  }

  /*
  was:
           ? <div className="tool-tile-drag-handle tool select" ref={elt => this.dragElement = elt}>
            <svg className={`icon icon-select-tool`}>
              <use xlinkHref={`#icon-select-tool`} />
            </svg>
          </div>

  */

  public render() {
    const { model, widthPct } = this.props;
    const { ui } = this.stores;
    const selectedClass = ui.isSelectedTile(model) ? " selected" : "";
    const ToolComponent = kToolComponentMap[model.content.type];
    const style: React.CSSProperties = {};
    if (widthPct) {
      style.width = `${Math.round(100 * widthPct / 100)}%`;
    }
    return (
      <div className={`tool-tile${selectedClass}`}
          ref={elt => this.domElement = elt}
          data-tool-id={model.id}
          style={style}
          tabIndex={-1}
          onKeyDown={this.handleKeyDown}
          onDragStart={this.handleToolDragStart}
          draggable={true}
      >
        <LinkIndicatorComponent type={model.content.type} id={model.id} />
        { ToolComponent !== PlaceholderToolComponent
          ? <DragTileButton />
          : null
        }
        {this.renderTile(ToolComponent)}
        {this.renderTileComments()}
      </div>
    );
  }

  private renderTile(ToolComponent: any) {
    const tileId = this.props.model.id;
    return ToolComponent != null
            ? <ToolComponent key={tileId} {...this.props} />
            : null;
  }

  private renderTileComments() {
    const tileId = this.props.model.id;
    const { toolApiInterface } = this.props;
    const { documents } = this.stores;
    const documentContent = documents.findDocumentOfTile(tileId);
    if (documentContent) {
      const commentsModel = documentContent.comments.get(tileId);
      if (commentsModel) {
        return <TileCommentsComponent
                  model={commentsModel}
                  toolApiInterface={toolApiInterface}
                  docKey={documentContent.key}
                />;
      }
    }
  }

  private handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    this.hotKeys.dispatch(e);
  }

  private handleMouseDown = (e: MouseEvent) => {
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

    const ToolComponent = kToolComponentMap[model.content.type];
    if (ToolComponent && ToolComponent.tileHandlesSelection) {
      ui.setSelectedTile(model, {append: hasSelectionModifier(e)});
    }
  }

  private handleCopyJson = () => {
    const { content } = this.props.model;
    const json = JSON.stringify(content);
    const { clipboard } = this.stores;
    clipboard.clear();
    clipboard.addJsonTileContent(this.props.model.id, content, this.stores);
    return true;
  }

  private handleToolDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const target: HTMLElement | null = e.target as HTMLElement;
    if (!target || target.querySelector(".disable-tile-drag")) {
      e.preventDefault();
      return;
    }
    if (target && target.querySelector(".disable-tile-content-drag")) {
      const eltTarget = document.elementFromPoint(e.clientX, e.clientY);
      if (!eltTarget || !eltTarget.closest(".tool-tile-drag-handle")) {
        e.preventDefault();
        return;
      }
    }
    // set the drag data
    const { model, docId, height, scale } = this.props;
    const ToolComponent = kToolComponentMap[model.content.type];
    if (ToolComponent === PlaceholderToolComponent) {
      e.preventDefault();
      return;
    }
    if (!e.dataTransfer) return;

    // TODO: should this be moved to document-content.tsx since it is more than just the current tile?
    //       and also the drop handler is there

    const dragTiles: IDragTiles = {
      sourceDocId: docId,
      items: []
    };
    const { documents, ui: { selectedTileIds } } = this.stores;

    // create a sorted array of selected tiles
    selectedTileIds.forEach(selectedTileId => {
      const document = documents.findDocumentOfTile(selectedTileId);
      if (document) {
        const {content} = document;
        const tile = content.getTile(selectedTileId);
        if (tile) {
          const rowId = content.findRowContainingTile(tile.id);
          const rowIndex = rowId && content.getRowIndex(rowId);
          const row = rowId && content.getRow(rowId);
          const rowHeight = row && row.height;
          const tileIndex = row && row.tiles.findIndex(t => t.tileId === selectedTileId);
          const tileSnapshotWithoutId = cloneDeep(getSnapshot(tile));
          delete tileSnapshotWithoutId.id;
          dragTiles.items.push({
            rowIndex: rowIndex || 0,
            rowHeight: rowHeight || 0,
            tileIndex: tileIndex || 0,
            tileId: tile.id,
            tileContent: JSON.stringify(tileSnapshotWithoutId),
            tileType: tile.content.type
          });
        }
      }
    });
    dragTiles.items.sort((a, b) => {
      if (a.rowIndex < b.rowIndex) return -1;
      if (a.rowIndex > b.rowIndex) return 1;
      if (a.tileIndex < b.tileIndex) return -1;
      if (a.tileIndex > b.tileIndex) return 1;
      return 0;
    });
    e.dataTransfer.setData(kDragTiles, JSON.stringify(dragTiles));

    // we have to set this as a transfer type because the kDragTiles contents are not available in drag over events
    e.dataTransfer.setData(dragTileSrcDocId(docId), docId);

    // NEED TO UPDATE:
    // 1. geometry-content#handleTableTileDrop (uses kDragTileId)
    // 2. drawing-layer#handleDrop and geometry-content#handleDrop (uses kDragTileContent)
    // 3. drawing-layer#isAcceptableImageDrag and geometry-content#isAcceptableTileDrag (uses extractDragTileType)

    /*

    old single tile code:

    e.dataTransfer.setData(kDragTileSource, docId);
    if (height) {
      e.dataTransfer.setData(kDragRowHeight, String(height));
    }
    e.dataTransfer.setData(kDragTileId, id);
    e.dataTransfer.setData(kDragTileContent, dragData);
    e.dataTransfer.setData(dragTileSrcDocId(docId), docId);
    e.dataTransfer.setData(dragTileType(model.content.type), model.content.type);
    */

    // TODO: should we create an array of drag images here?

    // set the drag image
    const dragElt = e.target as HTMLElement;
    // tool components can provide alternate dom node for drag image
    const dragImage = ToolComponent && ToolComponent.getDragImageNode
                        ? ToolComponent.getDragImageNode(dragElt)
                        : dragElt;
    const clientRect = dragElt.getBoundingClientRect();
    const offsetX = (e.clientX - clientRect.left) / (scale || 1);
    const offsetY = (e.clientY - clientRect.top) / (scale || 1);
    e.dataTransfer.setDragImage(dragImage, offsetX, offsetY);
  }

}
