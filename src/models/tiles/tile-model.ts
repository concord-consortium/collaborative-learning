import { cloneDeep } from "lodash";
import { getParent, getSnapshot, getType,
  Instance, SnapshotIn, SnapshotOut, types, ISerializedActionCall,
  IDisposer,
  onPatch} from "mobx-state-tree";
import { findMetadata, getTileContentInfo, ITileExportOptions } from "./tile-content-info";
import { TileContentUnion } from "./tile-content-union";
import { ITileContentModel } from "./tile-content";
import { DisplayUserType, DisplayUserTypeEnum } from "../stores/user-types";
import { uniqueId } from "../../utilities/js-utils";
import { StringBuilder } from "../../utilities/string-builder";
import { logTileDocumentEvent } from "./log/log-tile-document-event";
import { LogEventName } from "../../lib/logger-types";
import { RowListType } from "../document/row-list";
import { sha256 } from 'js-sha256';

// generally negotiated with app, e.g. single column width for table
export const kDefaultMinWidth = 60;

export interface ITilePosition {
  rowList: RowListType;
  rowIndex: number;
  tileIndex: number;
  tileId: string;
}
export interface IDragTileItem extends ITilePosition {
  rowHeight?: number;
  tileContent: string;  // modified tile contents
  tileType: string;
  embedded?: boolean;   // if tile is included in another tile being dragged
}

export interface IDropTileItem extends IDragTileItem {
  newTileId: string;
}

/**
 * Determine if a drag item is a container tile that may include other tiles.
 * This provides an efficient way to check without having to unpack the JSON content and
 * see if the model is a RowList.
 */
export function isContainerTile(item: IDragTileItem) {
  return !!getTileContentInfo(item.tileType)?.isContainer;
}

export function cloneTileSnapshotWithoutId(tile: ITileModel) {
  const { id, display, ...copy } = cloneDeep(getSnapshot(tile));
  return copy;
}

export function cloneTileSnapshotWithNewId(tile: ITileModel, newId?: string) {
  const content = tile.content.tileSnapshotForCopy;
  const { id, display, ...copy } = cloneDeep(getSnapshot(tile));
  return { id: newId || uniqueId(), ...copy, content };
}

export function getTileModel(tileContentModel: ITileContentModel) {
  try {
    const parent = getParent(tileContentModel);
    return getType(parent).name === "TileModel" ? parent as ITileModel : undefined;
  } catch (e) {
    console.warn(`Unable to find tile model for content ${tileContentModel}`);
    return undefined;
  }
}

export function getTileIdFromContent(tileContentModel: ITileContentModel) {
  const parent = getTileModel(tileContentModel);
  return parent?.id;
}

export const TileModel = types
  .model("TileModel", {
    // if not provided, will be generated
    id: types.optional(types.identifier, () => uniqueId()),
    // all tiles can have a title
    title: types.maybe(types.string),
    // whether to restrict display to certain users
    display: DisplayUserTypeEnum,
    // if true, tile cannot be moved or have another tile placed alongside/above it.
    fixedPosition: types.optional(types.boolean, false),
    // e.g. "TextContentModel", ...
    content: TileContentUnion,
    // the hash of the tile contents when it was created
    createdHash: types.maybe(types.string),
    // the hash of the tile contents when it was updated
    updatedHash: types.maybe(types.string),
  })
  .preProcessSnapshot(snapshot => {
    const tileType = snapshot.content.type;
    const preProcessor = getTileContentInfo(tileType)?.tileSnapshotPreProcessor;
    return preProcessor ? preProcessor(snapshot) : snapshot;
  })
  .views(self => ({
    /**
     * Users can manually set a tile title. If the title isn't set, then content model
     * can provide a title. The empty string is considered an "unset" title.
     */
    get computedTitle() {
      // FIXME: this causes an MST error when the dataflow tile is deleted now
      return self.title || self.content.contentTitle || "";
    },
    // generally negotiated with tile, e.g. single column width for table
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
    get isFixedPosition() {
      return self.fixedPosition;
    },
    exportJson(options?: ITileExportOptions, tileMap?: Map<string|number, ITileModel>): string | undefined {
      const { includeId, excludeTitle, ...otherOptions } = options || {};
      let contentJson = (self.content as any).exportJson?.(otherOptions, tileMap);
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
      if (self.display) {
        builder.pushLine(`"display": "${self.display}",`, 2);
      }
      if (self.fixedPosition) {
        builder.pushLine(`"fixedPosition": true,`, 2);
      }
      builder.pushBlock(`"content": ${contentJson}`, 2);
      options?.rowHeight && builder.pushLine(`"layout": { "height": ${options.rowHeight} }`, 2);
      const comma = options?.appendComma ? ',' : '';
      builder.pushLine(`}${comma}`);
      return builder.build();
    },
    generateHash() {
      const options: ITileExportOptions = {forHash: true};
      const tileMap = (self.content as any).tileMap ?? new Map();
      const contentJson = (self.content as any).exportJson?.(options, tileMap);
      if (!contentJson) {
        return undefined;
      }
      return sha256(contentJson);
    }
  }))
  .actions(self => ({
    /**
     * Low-level method to set the "title" field of this model.
     * In most cases you should use `setTitleOrContentTitle` instead.
     * @param title
     */
    setTitle(title: string|undefined) {
      // if (title && getTileContentInfo(self.content.type)?.useContentTitle) {
      //   console.warn("possibly bad call to setTitle, setting", title, "on", self.id);
      // }
      self.title = title;
    },
    setDisplay(display: DisplayUserType) {
      self.display = display;
    },
    setFixedPosition(fixedPosition: boolean) {
      self.fixedPosition = fixedPosition;
    },
    setUpdatedHash() {
      self.updatedHash = self.generateHash();
    },
  }))
  .actions(self => {
    let stopWatchingPatches: IDisposer | undefined;

    return {
      /**
       * Set the title in the appropriate way for this tile.
       * For tables and data cards, this will set the name of the DataSet;
       * for other tiles, it is set in the Tile model.
       * @param title
       */
      setTitleOrContentTitle(title: string) {
        logTileDocumentEvent(LogEventName.RENAME_TILE,{ tile: self as ITileModel });
        if (getTileContentInfo(self.content.type)?.useContentTitle) {
          self.content.setContentTitle(title);
        } else {
          self.setTitle(title);
        }
      },
      afterCreate() {
        const metadata = findMetadata(self.content.type, self.id);
        const content = self.content;
        if (metadata && content.doPostCreate) {
          content.doPostCreate(metadata);
        }

        if (!self.createdHash) {
          self.createdHash = self.generateHash();
          self.updatedHash = self.createdHash;
        }

        // Watch patches; update only if the patch path is /content or under it
        stopWatchingPatches = onPatch(self, (patch) => {
          const p = patch.path;
          if (p === "/content" || p.startsWith("/content/")) {
            self.setUpdatedHash();
          }
        });
      },
      beforeDestroy() {
        stopWatchingPatches?.();
      },
      afterAttach() {
        // The afterAttach() method of the tile content gets called when the content is attached to the tile,
        // which often occurs before the tile has been attached to the document, which means that references
        // can't be validated, etc.. Therefore, the tile model will call the content's afterAttachToDocument()
        // method when the tile model itself is attached.
        if ("afterAttachToDocument" in self.content && typeof self.content.afterAttachToDocument === "function") {
          self.content.afterAttachToDocument();
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
    };
  });

export interface ITileModel extends Instance<typeof TileModel> {}
export interface ITileModelSnapshotIn extends SnapshotIn<typeof TileModel> {}
export interface ITileModelSnapshotOut extends SnapshotOut<typeof TileModel> {}
