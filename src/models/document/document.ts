import { applySnapshot, types, Instance, SnapshotIn, getEnv } from "mobx-state-tree";
import { forEach } from "lodash";
import { QueryClient, UseQueryResult } from "react-query";
import { DocumentContentModel, DocumentContentSnapshotType } from "./document-content";
import {
  DocumentType, DocumentTypeEnum, IDocumentAddTileOptions, IDocumentContext, ISetProperties,
  LearningLogDocument, LearningLogPublication, PersonalDocument, PersonalPublication,
  PlanningDocument, ProblemDocument, ProblemPublication, SupportPublication
} from "./document-types";
import { AppConfigModelType } from "../stores/app-config-model";
import { TileCommentsModel, TileCommentsModelType } from "../tools/tile-comments";
import { UserStarModel, UserStarModelType } from "../tools/user-star";
import { IGetNetworkDocumentParams, IGetNetworkDocumentResponse, IUserContext } from "../../../functions/src/shared";
import { getFirebaseFunction } from "../../hooks/use-firebase-function";
import { IDocumentProperties } from "../../lib/db-types";
import { getLocalTimeStamp } from "../../utilities/time";
import { safeJsonParse } from "../../utilities/js-utils";
import { Container } from "../history/container";
import { Tree } from "../history/tree";
import { addTreeMonitor } from "../history/tree-monitor";
import { createSharedModelDocumentManager, ISharedModelDocumentManager } from "../tools/shared-model-document-manager";

interface IMatchPropertiesOptions {
  isTeacherDocument?: boolean;
}

// FIXME: need to switch this to being the Tree now that it is the root

export const DocumentModel = Tree.named("Document")
  .props({
    uid: types.string,
    type: DocumentTypeEnum,
    key: types.string,
    remoteContext: "",  // e.g. remote class hash
    createdAt: 0,       // remote documents fill this in when content is loaded
    title: types.maybe(types.string),
    properties: types.map(types.string),
    content: types.maybe(DocumentContentModel),
    comments: types.map(TileCommentsModel),
    stars: types.array(UserStarModel),
    groupId: types.maybe(types.string),
    visibility: types.maybe(types.enumeration("VisibilityType", ["public", "private"])),
    groupUserConnections: types.map(types.boolean),
    originDoc: types.maybe(types.string),
    changeCount: types.optional(types.number, 0)
  })
  .volatile(self => ({
    queryPromise: undefined as Promise<UseQueryResult<IGetNetworkDocumentResponse>> | undefined,
    // This is not really needed for functionality but it is helpful for
    // debugging
    container: undefined as any      
  }))
  .views(self => ({
    // This is needed for the tree monitor and container
    get treeId() {
      return self.key;
    },
    get isProblem() {
      return (self.type === ProblemDocument) || (self.type === ProblemPublication);
    },
    get isPlanning() {
      return (self.type === PlanningDocument);
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
    get isRemote() {
      return !!self.remoteContext;
    },
    get remoteSpec() {
      return self.remoteContext
              ? [self.remoteContext, self.uid, self.key]
              : undefined;
    },
    get hasContent() {
      return !!self.content;
    },
    getMetadata() {
      const { uid, type, key, createdAt, title, originDoc, properties } = self;
      return { uid, type, key, createdAt, title, originDoc, properties: properties.toJSON() };
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
    matchProperties(properties?: string[], options?: IMatchPropertiesOptions) {
      // if no properties specified then consider it a match
      if (!properties?.length) return true;
      return properties?.every(p => {
        const match = /(!)?(.*)/.exec(p);
        const property = match && match[2];
        const wantsProperty = !(match && match[1]); // not negated => has property
        // treat "starred" as a virtual property
        if (property === "starred") {
          return self.isStarred === wantsProperty;
        }
        if (property === "isTeacherDocument") {
          return !!options?.isTeacherDocument === wantsProperty;
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
    },
    getUniqueTitle(tileType: string, titleBase: string, getTileTitle: (tileId: string) => string | undefined) {
      return self.content?.getUniqueTitle(tileType, titleBase, getTileTitle);
    }
  }))
  .views(self => ({
    isMatchingSpec(type: DocumentType, properties: string[]) {
      return (type === self.type) && self.matchProperties(properties);
    }
  }))
  .actions((self) => ({
    setCreatedAt(createdAt: number) {
      self.createdAt = createdAt;
    },

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

    setContent(snapshot: DocumentContentSnapshotType) {
      if (self.content) {
        applySnapshot(self.content, snapshot);
      }
      else {
        self.content = DocumentContentModel.create(snapshot);
        const sharedModelManager = getEnv(self).sharedModelManager as ISharedModelDocumentManager;
        sharedModelManager.setDocument(self.content);
      }
    },

    toggleVisibility(visibility?: "public" | "private") {
      self.visibility = !visibility
                          ? (self.visibility === "public" ? "private" : "public")
                          : visibility;
    },

    setVisibility(visibility: "public" | "private") {
      self.visibility = visibility;
    },

    addTile(toolId: string, options?: IDocumentAddTileOptions) {
      return self.content?.userAddTile(toolId, options);
    },

    deleteTile(tileId: string) {
      self.content?.userDeleteTile(tileId);
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
      return ++self.changeCount;
    },

    setGroupId(groupId?: string) {
      self.groupId = groupId;
    }
  }))
  .actions(self => ({
    fetchRemoteContent(queryClient: QueryClient, context: IUserContext) {
      const { remoteContext: context_id, uid, key } = self;
      const queryKey = ["network-documents", context_id, uid, key];
      if (context_id && uid && key) {
        if (!self.queryPromise) {
          const getNetworkDocument = getFirebaseFunction<IGetNetworkDocumentParams>("getNetworkDocument_v1");
          self.queryPromise = queryClient.fetchQuery(queryKey, async () => {
            const networkDocument = await getNetworkDocument({ context, context_id, uid, key });
            const { content, metadata } = networkDocument.data as IGetNetworkDocumentResponse;
            const _content = safeJsonParse(content.content);
            _content && self.setContent(_content);
            self.setCreatedAt(metadata.createdAt);
            return { content, metadata };
          });
        }
        else {
          // re-run the query when client calls this function again
          queryClient.invalidateQueries(queryKey, { exact: true });
        }
      }
      return self.queryPromise;
    },

    isLoadingContent(queryClient: QueryClient) {
      const { remoteContext: context_id, uid, key } = self;
      const queryKey = ["network-documents", context_id, uid, key];
      return queryClient.getQueryState(queryKey)?.status === "loading";
    },

    setProperties(properties: ISetProperties) {
      forEach(properties, (value, key) => self.setProperty(key, value));
    }
  }))
  .actions(self => ({
    afterCreate() {
      // FIXME: it would be nice to unify this with the code in createDocumentModel
      const container = Container({});
      self.container = container;
      self.containerAPI = container.containerAPI;
      addTreeMonitor(self, container.containerAPI, false);
      container.trees[self.treeId] = self;
    }
  }));

export type DocumentModelType = Instance<typeof DocumentModel>;
export type DocumentModelSnapshotType = SnapshotIn<typeof DocumentModel>;

export const getDocumentContext = (document: DocumentModelType): IDocumentContext => {
  const { type, key, title, originDoc } = document;
  return {
    type, key, title, originDoc,
    getProperty: (prop: string) => document.properties.get(prop),
    setProperties: (properties: ISetProperties) => document.setProperties(properties)
  };
};

/**
 * Create a DocumentModel and add a new sharedModelManager into its environment
 * 
 * @param snapshot 
 * @returns 
 */
export const createDocumentModel = (snapshot?: DocumentModelSnapshotType) => {
  const sharedModelManager = createSharedModelDocumentManager();
  const document = DocumentModel.create(snapshot, {sharedModelManager});
  if (document.content) {
    sharedModelManager.setDocument(document.content);
  }
  return document;
};
