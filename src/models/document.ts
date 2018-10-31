import { types, Instance, SnapshotIn } from "mobx-state-tree";
import { DocumentContentModel, DocumentContentModelType } from "./document-content";

export const DocumentDragKey = "org.concord.clue.document.key";

export const SectionDocument = "section";
export const LearningLogDocument = "learningLog";
export const PublicationDocument = "publication";

export const DocumentTypeEnum = types.enumeration("type", [SectionDocument, LearningLogDocument, PublicationDocument]);
export type DocumentType = typeof DocumentTypeEnum.Type;

export const DocumentToolEnum = types.enumeration("tool", ["delete", "geometry", "select", "text", "image", "drawing"]);
export type DocumentTool = typeof DocumentToolEnum.Type;

export const DocumentModel = types
  .model("Document", {
    uid: types.string,
    type: DocumentTypeEnum,
    title: types.maybe(types.string),
    key: types.string,
    createdAt: types.number,
    content: DocumentContentModel,
    sectionId: types.maybe(types.string),
    groupId: types.maybe(types.string),
    visibility: types.maybe(types.enumeration("VisibilityType", ["public", "private"])),
    groupUserConnections: types.map(types.boolean),
  })
  .actions((self) => ({
    setContent(content: DocumentContentModelType) {
      self.content = content;
    },

    setTitle(title: string) {
      self.title = title;
    },

    toggleVisibility(overide?: "public" | "private") {
      self.visibility = typeof overide === "undefined"
        ? (self.visibility === "public" ? "private" : "public")
        : overide;
    },

    addTile(tool: DocumentTool, addSidecarNotes?: boolean) {
      switch (tool) {
        case "geometry":
          return self.content.addGeometryTile(addSidecarNotes);
        case "text":
          return self.content.addTextTile();
        case "image":
          return self.content.addImageTile();
        case "drawing":
          return self.content.addDrawingTile();
      }
    },

    deleteTile(tileId: string) {
      self.content.deleteTile(tileId);
    },
  }));

export type DocumentModelType = Instance<typeof DocumentModel>;
export type DocumentModelSnapshotType = SnapshotIn<typeof DocumentModel>;
