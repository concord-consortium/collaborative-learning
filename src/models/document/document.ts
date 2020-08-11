import { types, Instance, SnapshotIn } from "mobx-state-tree";
import { forEach } from "lodash";
import { DocumentContentModel, DocumentContentModelType } from "./document-content";
import { AppConfigModelType } from "../stores/app-config-model";
import { TileCommentsModel, TileCommentsModelType } from "../tools/tile-comments";
import { UserStarModel, UserStarModelType } from "../tools/user-star";
import { IDocumentProperties } from "../../lib/db-types";
import { getLocalTimeStamp } from "../../utilities/time";

export const DocumentDragKey = "org.concord.clue.document.key";

export const SectionDocumentDEPRECATED = "section";
export const ProblemDocument = "problem";
export const PersonalDocument = "personal";
export const LearningLogDocument = "learningLog";
export const ProblemPublication = "publication";
export const PersonalPublication = "personalPublication";
export const LearningLogPublication = "learningLogPublication";
export const SupportPublication = "supportPublication";

export function isProblemType(type: string) {
  return [ProblemDocument, ProblemPublication].indexOf(type) >= 0;
}
export function isPersonalType(type: string) {
  return [PersonalDocument, PersonalPublication].indexOf(type) >= 0;
}
export function isLearningLogType(type: string) {
  return [LearningLogDocument, LearningLogPublication].indexOf(type) >= 0;
}
export function isUnpublishedType(type: string) {
  return [SectionDocumentDEPRECATED, ProblemDocument, PersonalDocument, LearningLogDocument]
          .indexOf(type) >= 0;
}
export function isPublishedType(type: string) {
  return [ProblemPublication, PersonalPublication, LearningLogPublication, SupportPublication].indexOf(type) >= 0;
}

export const DocumentTypeEnum = types.enumeration("type",
              [SectionDocumentDEPRECATED,
                ProblemDocument, PersonalDocument, LearningLogDocument,
                ProblemPublication, PersonalPublication, LearningLogPublication,
                SupportPublication]);
export type DocumentType = typeof DocumentTypeEnum.Type;
export type OtherDocumentType = typeof PersonalDocument | typeof LearningLogDocument;
export type PublishableType = typeof ProblemDocument | OtherDocumentType;
export type OtherPublicationType = typeof PersonalPublication | typeof LearningLogPublication;
export type PublicationType = typeof ProblemPublication | OtherPublicationType | typeof SupportPublication;

export interface IDocumentAddTileOptions {
  addSidecarNotes?: boolean;
  url?: string;
}

export const DocumentToolEnum = types.enumeration("tool",
                                ["delete", "drawing", "geometry", "image", "select", "table", "text", "placeholder"]);
export type DocumentTool = typeof DocumentToolEnum.Type;

export const DocumentModel = types
  .model("Document", {
    uid: types.string,
    type: DocumentTypeEnum,
    key: types.string,
    createdAt: types.number,
    title: types.maybe(types.string),
    properties: types.map(types.string),
    content: DocumentContentModel,
    comments: types.map(TileCommentsModel),
    stars: types.array(UserStarModel),
    groupId: types.maybe(types.string),
    visibility: types.maybe(types.enumeration("VisibilityType", ["public", "private"])),
    groupUserConnections: types.map(types.boolean),
    originDoc: types.maybe(types.string),
    changeCount: types.optional(types.number, 0)
  })
  .views(self => ({
    get isProblem() {
      return (self.type === ProblemDocument) || (self.type === ProblemPublication);
    },
    get isPersonal() {
      return (self.type === PersonalDocument || (self.type === PersonalPublication));
    },
    get isLearningLog() {
      return (self.type === LearningLogDocument) || (self.type === LearningLogPublication);
    },
    get isSupport() {
      return self.type === SupportPublication;
    },
    get isPublished() {
      return (self.type === ProblemPublication)
              || (self.type === LearningLogPublication)
              || (self.type === PersonalPublication)
              || (self.type === SupportPublication);
    },
    getProperty(key: string) {
      return self.properties.get(key);
    },
    copyProperties(): IDocumentProperties {
      return self.properties.toJSON();
    },
    get isStarred() {
      return !!self.stars.find(star => star.starred);
    },
    isStarredByUser(userId: string) {
      return !!self.stars.find(star => star.uid === userId && star.starred);
    },
    getUserStarAtIndex(index: number) {
      return self.stars[index];
    }
  }))
  .views(self => ({
    matchProperties(properties: string[]) {
      return properties.every(p => {
        const match = /(!)?(.*)/.exec(p);
        const property = match && match[2];
        const wantsProperty = !(match && match[1]); // not negated => has property
        // treat "starred" as a virtual property
        if (property === "starred") {
          return self.isStarred === wantsProperty;
        }
        if (property) {
          return !!self.getProperty(property) === wantsProperty;
        }
        // ignore empty strings, etc.
        return true;
      });
    },
    getLabel(appConfig: AppConfigModelType, count: number, lowerCase?: boolean) {
      const props = appConfig.documentLabelProperties || [];
      let docStr = self.type as string;
      props.forEach(prop => {
        docStr += self.getProperty(prop) ? `:${prop}` : `:!${prop}`;
      });
      return appConfig.getDocumentLabel(docStr, count, lowerCase);
    },
    getDisplayTitle(appConfig: AppConfigModelType) {
      const timeStampPropName = appConfig.docTimeStampPropertyName || undefined;
      const timeStampProp = timeStampPropName && self.getProperty(timeStampPropName);
      const timeStamp = timeStampProp
                          ? parseFloat(timeStampProp)
                          : undefined;
      const timeStampStr = timeStamp ? getLocalTimeStamp(timeStamp) : undefined;
      return timeStampStr
              ? `${self.title} (${timeStampStr})`
              : self.title;
    },
    getDisplayId(appConfig: AppConfigModelType) {
      const { docDisplayIdPropertyName } = appConfig;
      if (!docDisplayIdPropertyName) return undefined;
      if (docDisplayIdPropertyName === "key") return self.key;
      return self.getProperty(docDisplayIdPropertyName);
    }

  }))
  .views(self => ({
    isMatchingSpec(type: DocumentType, properties: string[]) {
      return (type === self.type) && self.matchProperties(properties);
    }
  }))
  .actions((self) => ({
    setTitle(title: string) {
      self.title = title;
    },

    setProperty(key: string, value?: string) {
      if (value == null) {
        self.properties.delete(key);
      }
      else if (self.getProperty(key) !== value) {
        self.properties.set(key, value);
      }
    },

    setContent(content: DocumentContentModelType) {
      self.content = content;
    },

    toggleVisibility(visibility?: "public" | "private") {
      self.visibility = !visibility
                          ? (self.visibility === "public" ? "private" : "public")
                          : visibility;
    },

    setVisibility(visibility: "public" | "private") {
      self.visibility = visibility;
    },

    addTile(tool: DocumentTool, options?: IDocumentAddTileOptions) {
      return self.content.userAddTile(tool, options);
    },

    deleteTile(tileId: string) {
      self.content.userDeleteTile(tileId);
    },

    setTileComments(tileId: string, comments: TileCommentsModelType) {
      self.comments.set(tileId, comments);
    },

    setUserStar(newStar: UserStarModelType) {
      const starIndex = self.stars.findIndex(star => star.uid === newStar.uid);
      if (starIndex >= 0) {
        self.stars[starIndex] = newStar;
      } else {
        self.stars.push(newStar);
      }
    },

    toggleUserStar(userId: string) {
      const userStar = self.stars.find(star => star.uid === userId);
      if (userStar) {
        userStar.starred = !userStar.starred;
      }
      else {
        self.stars.push(UserStarModel.create({ uid: userId, starred: true }));
      }
    },

    incChangeCount() {
      self.changeCount += 1;
    },

    setGroupId(groupId?: string) {
      self.groupId = groupId;
    }
  }))
  .actions(self => ({
    setProperties(properties: ISetProperties) {
      forEach(properties, (value, key) => self.setProperty(key, value));
    }
  }));

export interface ISetProperties {
  [key: string]: string | undefined;
}

export type DocumentModelType = Instance<typeof DocumentModel>;
export type DocumentModelSnapshotType = SnapshotIn<typeof DocumentModel>;
