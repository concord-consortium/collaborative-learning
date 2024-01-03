import { applySnapshot, types, Instance, SnapshotIn, onAction, addDisposer, destroy } from "mobx-state-tree";
import { forEach } from "lodash";
import { QueryClient, UseQueryResult } from "react-query";
import { DocumentContentModel, DocumentContentSnapshotType } from "./document-content";
import { IDocumentAddTileOptions } from "./document-content-types";
import {
  DocumentType, DocumentTypeEnum, IDocumentContext, ISetProperties,
  LearningLogDocument, LearningLogPublication, PersonalDocument, PersonalPublication,
  PlanningDocument, ProblemDocument, ProblemPublication, SupportPublication
} from "./document-types";
import { AppConfigModelType } from "../stores/app-config-model";
import { TileCommentsModel, TileCommentsModelType } from "../tiles/tile-comments";
import { getSharedModelManager } from "../tiles/tile-environment";
import { UserStarModel, UserStarModelType } from "../tiles/user-star";
import {
  IDocumentMetadata, IGetNetworkDocumentParams, IGetNetworkDocumentResponse, IUserContext
} from "../../../functions/src/shared";
import { getFirebaseFunction } from "../../hooks/use-firebase-function";
import { IDocumentProperties } from "../../lib/db-types";
import { getLocalTimeStamp } from "../../utilities/time";
import { safeJsonParse } from "../../utilities/js-utils";
import { Tree } from "../history/tree";
import { TreeMonitor } from "../history/tree-monitor";
import { ISharedModelDocumentManager, SharedModelDocumentManager } from "./shared-model-document-manager";
import { ITileEnvironment } from "../tiles/tile-content";
import { TreeManager } from "../history/tree-manager";
import { ESupportType } from "../curriculum/support";
import { IDocumentLogEvent, logDocumentEvent } from "./log-document-event";
import { LogEventMethod, LogEventName } from "../../lib/logger-types";

interface IMatchPropertiesOptions {
  isTeacherDocument?: boolean;
}

export enum ContentStatus {
  Valid,
  Error
}

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
    changeCount: types.optional(types.number, 0),
    pubVersion: types.maybe(types.number),
    supportContentType: types.maybe(types.enumeration<ESupportType>("SupportType", Object.values(ESupportType)))
  })
  .volatile(self => ({
    treeMonitor: undefined as TreeMonitor | undefined,
    queryPromise: undefined as Promise<UseQueryResult<IGetNetworkDocumentResponse>> | undefined,
    contentStatus: ContentStatus.Valid,
    invalidContent: undefined as object | undefined,
    contentErrorMessage: undefined as string | undefined,
  }))
  .views(self => ({
    // This is needed for the tree monitor and manager
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
    get metadata(): IDocumentMetadata {
      const { uid, type, key, createdAt, title, originDoc, properties } = self;
      // FIXME: the contextId was added here temporarily. This metadata is sent
      // up to the Firestore functions. The new functions do not require the
      // contextId. However the old functions do. The old functions were just
      // ignoring this contextId. So the contextId is added here so the client
      // code can work with the old functions.
      return { contextId: "ignored", uid, type, key, createdAt, title,
        originDoc, properties: properties.toJSON() } as IDocumentMetadata;
    },
    getProperty(key: string) {
      return self.properties.get(key);
    },
    getNumericProperty(key: string) {
      const val = self.properties.get(key);
      return val != null ? Number(val) : 0;
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
    matchProperties(properties?: readonly string[], options?: IMatchPropertiesOptions) {
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
    getUniqueTitle(tileType: string, titleBase: string) {
      return self.content?.getUniqueTitle(tileType, titleBase);
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
    setNumericProperty(key: string, value?: number) {
      this.setProperty(key, value == null ? value : `${value}`);
    },

    setContent(snapshot: DocumentContentSnapshotType) {
      if (self.content) {
        applySnapshot(self.content, snapshot);
      }
      else {
        self.content = DocumentContentModel.create(snapshot);
        const sharedModelManager = getSharedModelManager(self);
        (sharedModelManager as ISharedModelDocumentManager).setDocument(self.content);
      }
    },

    toggleVisibility(visibility?: "public" | "private") {
      self.visibility = !visibility
                          ? (self.visibility === "public" ? "private" : "public")
                          : visibility;
       console.log("| toggleVisibility", self.visibility);
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
    },

    setContentError(content: object, message?: string) {
      self.contentStatus = ContentStatus.Error;
      self.invalidContent = content;
      self.contentErrorMessage = message;
    }
  }))
  .actions(self => ({
    afterCreate() {
      // TODO: it would be nice to unify this with the code in createDocumentModel
      const manager = TreeManager.create({document: {}, undoStore: {}});
      self.treeManagerAPI = manager;
      self.treeMonitor = new TreeMonitor(self, manager, false);
      manager.setMainDocument(self);
      // Clean up the manager when this document is destroyed this doesn't
      // happen automatically because the manager is stored in volatile state.
      // The manager needs to be destroyed so it can unsubscribe from firestore.
      // Destroying it will probably also free up memory
      addDisposer(self, () => destroy(manager));
    },
    undoLastAction() {
      const undoManager = self.treeManagerAPI?.undoManager;
      if (undoManager?.canUndo) {
        const {id, action} = undoManager.undo();
        const logParams: IDocumentLogEvent = {
          document: self as DocumentModelType,
          targetAction: action,
          targetEventId: id
        };
        logDocumentEvent(LogEventName.TILE_UNDO, logParams, LogEventMethod.UNDO);
      }
    },
    redoLastAction() {
      const undoManager = self.treeManagerAPI?.undoManager;
      if (undoManager?.canRedo) {
        const {id, action} = undoManager.redo();
        const logParams: IDocumentLogEvent = {
          document: self as DocumentModelType,
          targetAction: action,
          targetEventId: id
        };
        logDocumentEvent(LogEventName.TILE_REDO, logParams, LogEventMethod.REDO);
      }
    },
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
  const sharedModelManager = new SharedModelDocumentManager();
  const fullEnvironment: ITileEnvironment = {
    sharedModelManager
  };
  try {
    const document = DocumentModel.create(snapshot, fullEnvironment);
    addDisposer(document, onAction(document, (call) => {
      if (!document.content || !call.path?.match(/\/content\/tileMap\//)) {
        return;
      }
      const tileTypeId = call.path?.match(/\/content\/tileMap\/([^/]*)/)?.[1];
      if (tileTypeId) {
        const tile = document.content.tileMap.get(tileTypeId);
        tile?.onTileAction(call);
      }
    }));
    if (document.content) {
      sharedModelManager.setDocument(document.content);
    }
    return document;
  } catch (e) {
    // The only time we've seen this error so far is when MST fails to load the content
    // because it doesn't match the types of the MST models
    if (!snapshot) {
      console.error("Empty document failed to be created");
      throw e;
    }

    if (!snapshot.content) {
      console.error("Document with empty content failed to be created", {docKey: snapshot.key});
      throw e;
    }

    // Putting the error in an object like this prevents Chrome from expanding the
    // error and taking up a bunch of console lines.
    console.error("Failed to load document", {docKey: snapshot.key, error: e});

    // Create a document without the content, so this can be returned and passed
    // through the rest of the CLUE system. The Canvas component checks the contentStatus
    // and renders a DocumentError component if the status is Error
    const {content, ...snapshotWithoutContent} = snapshot;
    const documentWithoutContent = DocumentModel.create(snapshotWithoutContent, fullEnvironment);
    documentWithoutContent.setContentError(content, (e as Error)?.message);
    return documentWithoutContent;
  }
};
