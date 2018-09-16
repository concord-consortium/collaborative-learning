import { types, Instance } from "mobx-state-tree";
import { DocumentContentModel, DocumentContentModelType } from "./document-content";

export const DocumentModel = types
  .model("Document", {
    uid: types.string,
    key: types.string,
    createdAt: types.number,
    content: DocumentContentModel
  })
  .actions((self) => ({
    setContent(content: DocumentContentModelType) {
      self.content = content;
    }
  }));

export type DocumentModelType = Instance<typeof DocumentModel>;
