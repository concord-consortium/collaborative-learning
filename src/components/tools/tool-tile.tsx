import * as React from "react";
import { observer, inject } from "mobx-react";
import { getSnapshot } from "mobx-state-tree";
import { getDisabledFeaturesOfTile } from "../../models/stores/stores";
import { ToolTileModelType } from "../../models/tools/tool-tile";
import { kDataflowToolID } from "../../dataflow/models/tools/dataflow/dataflow-content";
import { kGeometryToolID } from "../../models/tools/geometry/geometry-content";
import { kTableToolID } from "../../models/tools/table/table-content";
import { kTextToolID } from "../../models/tools/text/text-content";
import { kImageToolID } from "../../models/tools/image/image-content";
import { kDrawingToolID } from "../../models/tools/drawing/drawing-content";
import { kPlaceholderToolID } from "../../models/tools/placeholder/placeholder-content";
import { BaseComponent } from "../base";
import DataflowToolComponent from "../../dataflow/components/tools/dataflow-tool";
import GeometryToolComponent from "./geometry-tool/geometry-tool";
import TableToolComponent from "./table-tool/table-tool";
import TextToolComponent from "./text-tool";
import ImageToolComponent from "./image-tool";
import DrawingToolComponent from "./drawing-tool/drawing-tool";
import PlaceholderToolComponent from "./placeholder-tool/placeholder-tool";
import { HotKeys } from "../../utilities/hot-keys";
import { cloneDeep } from "lodash";
import { TileCommentsComponent } from "./tile-comments";
import "../../utilities/dom-utils";

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
        [kDataflowToolID]: DataflowToolComponent,
        [kPlaceholderToolID]: PlaceholderToolComponent,
        [kDrawingToolID]: DrawingToolComponent,
        [kGeometryToolID]: GeometryToolComponent,
        [kImageToolID]: ImageToolComponent,
        [kTableToolID]: TableToolComponent,
        [kTextToolID]: TextToolComponent
      };

@inject("stores")
@observer
export class ToolTileComponent extends BaseComponent<IProps, {}> {

  private domElement: HTMLDivElement | null;
  private hotKeys: HotKeys = new HotKeys();

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
        { ToolComponent !== PlaceholderToolComponent
          ? <div className="tool-tile-drag-handle tool select">
            <svg className={`icon icon-select-tool`}>
              <use xlinkHref={`#icon-select-tool`} />
            </svg>
          </div>
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

  private handleMouseDown = (e: Event) => {
    const { model } = this.props;
    const { ui } = this.stores;
    const ToolComponent = kToolComponentMap[model.content.type];
    if (ToolComponent && ToolComponent.tileHandlesSelection && !ui.isSelectedTile(model)) {
      ui.setSelectedTile(model);
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
    const snapshot = cloneDeep(getSnapshot(model));
    const id = snapshot.id;
    delete snapshot.id;
    const dragData = JSON.stringify(snapshot);
    if (!e.dataTransfer) return;
    e.dataTransfer.setData(kDragTileSource, docId);
    if (height) {
      e.dataTransfer.setData(kDragRowHeight, String(height));
    }
    e.dataTransfer.setData(kDragTileId, id);
    e.dataTransfer.setData(kDragTileContent, dragData);
    e.dataTransfer.setData(dragTileSrcDocId(docId), docId);
    e.dataTransfer.setData(dragTileType(model.content.type), model.content.type);

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
