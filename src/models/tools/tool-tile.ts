import { cloneDeep } from "lodash";
import { getParent, getSnapshot, getType, 
  Instance, SnapshotIn, SnapshotOut, types, ISerializedActionCall } from "mobx-state-tree";
import { GeometryContentModelType } from "./geometry/geometry-content";
import { isPlaceholderContent } from "./placeholder/placeholder-content";
import { ITileExportOptions } from "./tool-content-info";
import { findMetadata, ToolContentModelType, ToolContentUnion } from "./tool-types";
import { DisplayUserTypeEnum } from "../stores/user-types";
import { uniqueId } from "../../utilities/js-utils";
import { StringBuilder } from "../../utilities/string-builder";

// generally negotiated with app, e.g. single column width for table
export const kDefaultMinWidth = 60;

export interface IDragTileItem {
  rowIndex: number;
  rowHeight?: number;
  tileIndex: number;
  tileId: string;       // original tile id
  tileContent: string;  // modified tile contents
  tileType: string;
}

export interface IDragTiles {
  sourceDocId: string;
  items: IDragTileItem[];
}

export function cloneTileSnapshotWithoutId(tile: ToolTileModelType) {
  const { id, display, ...copy } = cloneDeep(getSnapshot(tile));
  return copy;
}

export function cloneTileSnapshotWithNewId(tile: ToolTileModelType, newId?: string) {
  const content = tile.content.tileSnapshotForCopy;
  const { id, display, ...copy } = cloneDeep(getSnapshot(tile));
  return { id: newId || uniqueId(), ...copy, content };
}

export function getToolTileModel(toolContentModel: ToolContentModelType) {
  try {
    const parent = getParent(toolContentModel);
    return getType(parent).name === "ToolTile" ? parent as ToolTileModelType : undefined;
  } catch (e) {
    console.warn(`Unable to find tool tile for content ${toolContentModel}`);
    return undefined;
  }
}

export function getTileTitleFromContent(toolContentModel: ToolContentModelType) {
  return getToolTileModel(toolContentModel)?.title;
}

export function setTileTitleFromContent(toolContentModel: ToolContentModelType, title: string) {
  const toolTile = getToolTileModel(toolContentModel);
  toolTile?.setTitle(title);
}

export const ToolTileModel = types
  .model("ToolTile", {
    // if not provided, will be generated
    id: types.optional(types.identifier, () => uniqueId()),
    // all tiles can have a title
    title: types.maybe(types.string),
    // whether to restrict display to certain users
    display: DisplayUserTypeEnum,
    // e.g. "GeometryContentModel", "ImageContentModel", "TableContentModel", "TextContentModel", ...
    content: ToolContentUnion
  })
  .preProcessSnapshot(snapshot => {
    // Move the title up to handle legacy geometry tiles
    if (snapshot.content.type === "Geometry" && !("title" in snapshot) && "title" in snapshot.content) {
      const title = (snapshot.content as GeometryContentModelType).title;
      return { ...snapshot, title };
    }
    return snapshot;
  })
  .views(self => ({
    // generally negotiated with tool, e.g. single column width for table
    get minWidth() {
      return kDefaultMinWidth;
    },
    // undefined by default, but can be negotiated with app,
    // e.g. width of all columns for table
    get maxWidth(): number | undefined {
      // eslint-disable-next-line no-useless-return
      return;
    },
    get isUserResizable() {
      return !!(self.content as any).isUserResizable;
    },
    get isPlaceholder() {
      return isPlaceholderContent(self.content);
    },
    get placeholderSectionId() {
      return isPlaceholderContent(self.content) ? (self.content).sectionId : undefined;
    },
    exportJson(options?: ITileExportOptions): string | undefined {
      const { includeId, excludeTitle, ...otherOptions } = options || {};
      let contentJson = (self.content as any).exportJson(otherOptions);
      if (!contentJson) return;
      if (options?.rowHeight) {
        // add comma before layout/height entry
        contentJson = contentJson[contentJson.length - 1] === "\n"
                ? `${contentJson.slice(0, contentJson.length - 1)},\n`
                : `${contentJson},`;
      }

      const builder = new StringBuilder();
      builder.pushLine("{");
      if (includeId) {
        builder.pushLine(`"id": "${self.id}",`, 2);
      }
      if (!excludeTitle && self.title) {
        builder.pushLine(`"title": "${self.title}",`, 2);
      }
      builder.pushBlock(`"content": ${contentJson}`, 2);
      options?.rowHeight && builder.pushLine(`"layout": { "height": ${options.rowHeight} }`, 2);
      builder.pushLine(`}`);
      return builder.build();
    }
  }))
  .actions(self => ({
    setTitle(title: string) {
      self.title = title;
    }
  }))
  .actions(self => ({
    afterCreate() {
      const metadata = findMetadata(self.content.type, self.id);
      const content = self.content;
      if (metadata && content.doPostCreate) {
        content.doPostCreate(metadata);
      }
    },
    onTileAction(call: ISerializedActionCall) {
      self.content.onTileAction?.(call);
    },
    willRemoveFromDocument() {
      return self.content.willRemoveFromDocument?.();
    },
    setDisabledFeatures(disabled: string[]) {
      const metadata: any = findMetadata(self.content.type, self.id);
      metadata && metadata.setDisabledFeatures && metadata.setDisabledFeatures(disabled);
    }
  }));

export type ToolTileModelType = Instance<typeof ToolTileModel>;
export type ToolTileSnapshotInType = SnapshotIn<typeof ToolTileModel>;
export type ToolTileSnapshotOutType = SnapshotOut<typeof ToolTileModel>;
