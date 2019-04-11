import { types, Instance, SnapshotIn } from "mobx-state-tree";
import { DocumentContentModel, DocumentContentModelType } from "./document-content";
import { TileCommentsModel, TileCommentsModelType } from "../tools/tile-comments";

export const DocumentDragKey = "org.concord.clue.document.key";

export const SectionDocument = "section";
export const LearningLogDocument = "learningLog";
export const PublicationDocument = "publication";
export const LearningLogPublication = "learningLogPublication";

export const DocumentTypeEnum = types.enumeration("type",
  [SectionDocument, LearningLogDocument, PublicationDocument, LearningLogPublication]);
export type DocumentType = typeof DocumentTypeEnum.Type;

export const DocumentToolEnum = types.enumeration("tool",
                                  ["delete", "drawing", "geometry", "image", "select", "table", "text"]);
export type DocumentTool = typeof DocumentToolEnum.Type;

export const DocumentModel = types
  .model("Document", {
    uid: types.string,
    type: DocumentTypeEnum,
    title: types.maybe(types.string),
    key: types.string,
    createdAt: types.number,
    content: DocumentContentModel,
    comments: types.map(TileCommentsModel),
    sectionId: types.maybe(types.string),
    groupId: types.maybe(types.string),
    visibility: types.maybe(types.enumeration("VisibilityType", ["public", "private"])),
    groupUserConnections: types.map(types.boolean),
    originDoc: types.maybe(types.string)
  })
  .views(self => ({
    get isSection() {
      return (self.type === SectionDocument) || (self.type === PublicationDocument);
    },
    get isLearningLog() {
      return (self.type === LearningLogDocument) || (self.type === LearningLogPublication);
    },
    get isPublished() {
      return (self.type === PublicationDocument) || (self.type === LearningLogPublication);
    }
  }))
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
      return self.content.addTile(tool, addSidecarNotes);
    },

    deleteTile(tileId: string) {
      self.content.deleteTile(tileId);
    },

    setTileComments(tileId: string, comments: TileCommentsModelType) {
      self.comments.set(tileId, comments);
    }
  }));

export type DocumentModelType = Instance<typeof DocumentModel>;
export type DocumentModelSnapshotType = SnapshotIn<typeof DocumentModel>;
