import { types, Instance } from "mobx-state-tree";
import { IStores } from "./stores";
import { ToolContentModelType } from "../tools/tool-types";
import { v4 as uuid } from "uuid";

export const kTypeText = "text";
export const kJsonTileContent = "org.concord.clue.clipboard.tileJson";

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
    },
    hasTextContent() {
      return self.content.has(kTypeText);
    },
    getTextContent() {
      const entry = self.content.get(kTypeText);
      return entry && entry.content || "";
    },
    hasJsonTileContent() {
      return self.content.has(kJsonTileContent);
    },
    getJsonTileContent() {
      const entry = self.content.get(kJsonTileContent);
      return entry && entry.content || "";
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
    },
    addJsonTileContent(tileId: string, content: ToolContentModelType, stores: IStores) {
      const document = stores.documents.findDocumentOfTile(tileId);
      const entry = ClipboardEntryModel.create({
        userId: document ? document.uid : "",
        srcDocumentId: document ? document.key : "",
        srcDocumentType: document ? document.type : "",
        srcTileId: tileId,
        type: kJsonTileContent,
        content: JSON.stringify(content)
      });
      self.content.set(kJsonTileContent, entry);
    }
  }));
export type ClipboardModelType = Instance<typeof ClipboardModel>;
