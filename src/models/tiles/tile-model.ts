import { cloneDeep } from "lodash";
import { getParent, getSnapshot, getType,
  Instance, SnapshotIn, SnapshotOut, types, ISerializedActionCall } from "mobx-state-tree";
import { findMetadata, getTileContentInfo, ITileExportOptions } from "./tile-content-info";
import { TileContentUnion } from "./tile-content-union";
import { ITileContentModel } from "./tile-content";
import { DisplayUserType, DisplayUserTypeEnum } from "../stores/user-types";
import { uniqueId } from "../../utilities/js-utils";
import { StringBuilder } from "../../utilities/string-builder";
import { logTileDocumentEvent } from "./log/log-tile-document-event";
import { LogEventName } from "../../lib/logger-types";

// generally negotiated with app, e.g. single column width for table
export const kDefaultMinWidth = 60;

export interface ITilePosition {
  rowIndex: number;
  tileIndex: number;
  tileId: string;
}
export interface IDragTileItem extends ITilePosition {
  rowHeight?: number;
  tileContent: string;  // modified tile contents
  tileType: string;
}

export interface IDropTileItem extends IDragTileItem {
  newTileId: string;
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

const TileModelInternal = types
  .model("TileModel", {
    // if not provided, will be generated
    id: types.optional(types.identifier, () => uniqueId()),
    // all tiles can have a title
    internalTitle: types.maybe(types.string),
    // whether to restrict display to certain users
    display: DisplayUserTypeEnum,
    // e.g. "TextContentModel", ...
    content: TileContentUnion
  })
  .views(self => ({
    get title() {
      return self.internalTitle ?? self.content.contentTitle ?? "";
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
    exportJson(options?: ITileExportOptions): string | undefined {
      const { includeId, excludeTitle, ...otherOptions } = options || {};
      let contentJson = (self.content as any).exportJson?.(otherOptions);
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
      if (!excludeTitle && self.internalTitle) {
        builder.pushLine(`"title": "${self.internalTitle}",`, 2);
      }
      if (self.display) {
        builder.pushLine(`"display": "${self.display}",`, 2);
      }
      builder.pushBlock(`"content": ${contentJson}`, 2);
      options?.rowHeight && builder.pushLine(`"layout": { "height": ${options.rowHeight} }`, 2);
      const comma = options?.appendComma ? ',' : '';
      builder.pushLine(`}${comma}`);
      return builder.build();
    }
  }))
  .actions(self => ({
    setTitle(title: string) {
      self.internalTitle = title;
      logTileDocumentEvent(LogEventName.RENAME_TILE,{ tile: self as ITileModel });
    },
    setDisplay(display: DisplayUserType) {
      self.display = display;
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
  }));

// The types.snapshotProcessor is used here so the types are handled better
// It updates the TileModel.create(...) parameter type and the
// SnapshotIn type to match the type of parameter of preProcessor.
// It also updates the SnapshotOut type to be the return type of postProcessor
// I didn't test extensively perhaps there is a way to do this with the alternative approach
export const TileModel = types.snapshotProcessor(TileModelInternal, {
  preProcessor(snapshot: Omit<SnapshotIn<typeof TileModelInternal>, "internalTitle"> & {title?: string}) {
    // internally we store the title in the `internalTitle` property
    // this way we can provide view that computes the title
    // when serialized we save it out simply as `title`
    const {title, ...others} = snapshot;
    const newSnapshot = {internalTitle: title, ...others};

    const tileType = newSnapshot.content.type;
    const preProcessor = getTileContentInfo(tileType)?.tileSnapshotPreProcessor;
    return preProcessor ? preProcessor(newSnapshot) : newSnapshot;
  },

  postProcessor(snapshot: SnapshotOut<typeof TileModelInternal>) {
    const {internalTitle, ...others} = snapshot;
    return {title: internalTitle, ...others};
  }
});

export interface ITileModel extends Instance<typeof TileModel> {}
export interface ITileModelSnapshotIn extends SnapshotIn<typeof TileModel> {}
export interface ITileModelSnapshotOut extends SnapshotOut<typeof TileModel> {}
