import { types, Instance } from "mobx-state-tree";
import { DocumentContentModel } from "./document-content";

export const DocumentModel = types
  .model("Document", {
    uid: types.string,
    key: types.string,
    createdAt: types.number,
    content: DocumentContentModel
  });

export type DocumentModelType = Instance<typeof DocumentModel>;
