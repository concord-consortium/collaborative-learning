import { types, Instance } from "mobx-state-tree";
import { IStores } from "./stores";
import * as uuid from "uuid/v4";

export const ClipboardEntryModel = types
  .model("Clipboard", {
    id: types.optional(types.string, () => uuid()),
    userId: "",
    srcDocumentId: "",
    srcDocumentType: "",
    srcTileId: "",
    timestamp: types.optional(types.number, () => new Date().getTime()),
    type: types.string,
    content: types.string
  });
export type ClipboardEntryModelType = Instance<typeof ClipboardEntryModel>;

const tileClipboardType = (type: string) => `org.concord.clue.clipboard.${type}`;

export const ClipboardModel = types
  .model("Clipboard", {
    content: types.map(ClipboardEntryModel)
  })
  .views(self => ({
    get isEmpty() {
      return !self.content.size;
    },
    hasType(type: string) {
      return self.content.has(type);
    },
    isSourceTile(type: string, tileId: string) {
      const entry = self.content.get(tileClipboardType(type));
      return entry && entry.srcTileId
              ? tileId === entry.srcTileId
              : false;
    },
    getTileContentId(type: string) {
      const entry = self.content.get(tileClipboardType(type));
      return entry && entry.id;
    },
    getTileContent(type: string) {
      const entry = self.content.get(tileClipboardType(type));
      let content: any;
      try {
        content = entry && JSON.parse(entry.content);
      }
      catch (e) {
        // ignore errors
      }
      return content;
    }
  }))
  .actions(self => ({
    clear() {
      self.content.clear();
    },
    addTileContent(tileId: string, tileType: string, content: any, stores: IStores) {
      const clipType = tileClipboardType(tileType);
      const document = stores.documents.findDocumentOfTile(tileId);
      const entry = ClipboardEntryModel.create({
        userId: document ? document.uid : "",
        srcDocumentId: document ? document.key : "",
        srcDocumentType: document ? document.type : "",
        srcTileId: tileId,
        type: clipType,
        content: JSON.stringify(content)
      });
      self.content.set(clipType, entry);
    }
  }));
export type ClipboardModelType = Instance<typeof ClipboardModel>;
