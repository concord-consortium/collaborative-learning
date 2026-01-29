import { applySnapshot, types, Instance, SnapshotIn, onAction, addDisposer, destroy, typecheck } from "mobx-state-tree";
import { forEach } from "lodash";
import { QueryClient, UseQueryResult } from "react-query";
import { autorun } from "mobx";
import { FormulaManager } from "@concord-consortium/codap-formulas-react17/models/formula/formula-manager";
import {
  createFormulaAdapters
} from "@concord-consortium/codap-formulas-react17/models/formula/formula-adapter-registry";

import {
  IDocumentMetadata, IGetNetworkDocumentParams, IGetNetworkDocumentResponse, IUserContext
} from "../../../shared/shared";
import { getFirebaseFunction } from "../../hooks/use-firebase-function";
import { IDocumentProperties } from "../../lib/db-types";
import { safeJsonParse } from "../../utilities/js-utils";
import { LogEventMethod, LogEventName } from "../../lib/logger-types";
import { AppConfigModelType } from "../stores/app-config-model";
import { TileCommentsModel, TileCommentsModelType } from "../tiles/tile-comments";
import { getSharedModelManager, getTileEnvironment } from "../tiles/tile-environment";
import { Tree } from "../history/tree";
import { TreeMonitor } from "../history/tree-monitor";
import { ITileEnvironment } from "../tiles/tile-content";
import { TreeManager } from "../history/tree-manager";
import { ESupportType } from "../curriculum/support";
import { UserModelType } from "../stores/user";
import { kSharedDataSetType, SharedDataSet, SharedDataSetType } from "../shared/shared-data-set";
import { createFormulaDataSetProxy } from "../data/formula-data-set-proxy";
import { isDocumentAccessibleToUser } from "./document-utils";
import { IDocumentLogEvent, logDocumentEvent } from "./log-document-event";
import { ISharedModelDocumentManager, SharedModelDocumentManager } from "./shared-model-document-manager";
import { DocumentContentModel, DocumentContentSnapshotType } from "./document-content";
import { IDocumentAddTileOptions } from "./document-content-types";
import { DocumentTypeEnum, GroupDocument, IDocumentContext, ISetProperties, isPublishedType,
  LearningLogDocument, LearningLogPublication, PersonalDocument, PersonalPublication,
  PlanningDocument, ProblemDocument, ProblemPublication, SupportPublication
} from "./document-types";
import { DocumentCommentsManager } from "./document-comments-manager";

export enum ContentStatus {
  Valid,
  Error
}

export type IExemplarVisibilityProvider = {
  isExemplarVisible: (id: string) => boolean;
};

const VisibilityTypeEnumValues = ["public", "private"] as const;
export const VisibilityTypeEnum = types.enumeration("VisibilityType", VisibilityTypeEnumValues);
export type VisibilityType = Instance<typeof VisibilityTypeEnum>;
export function isVisibilityType(value: string): value is VisibilityType {
  return VisibilityTypeEnumValues.indexOf(value as VisibilityType) >= 0;
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
    groupId: types.maybe(types.string),
    visibility: types.maybe(VisibilityTypeEnum),
    groupUserConnections: types.map(types.boolean),
    originDoc: types.maybe(types.string),
    changeCount: types.optional(types.number, 0),
    pubVersion: types.maybe(types.number),
    supportContentType: types.maybe(types.enumeration<ESupportType>("SupportType", Object.values(ESupportType))),
    problem: types.maybe(types.string),
    investigation: types.maybe(types.string),
    unit: types.maybe(types.string),
  })
  .volatile(self => ({
    treeMonitor: undefined as TreeMonitor | undefined,
    queryPromise: undefined as Promise<UseQueryResult<IGetNetworkDocumentResponse>> | undefined,
    contentStatus: ContentStatus.Valid,
    invalidContent: undefined as object | undefined,
    contentErrorMessage: undefined as string | undefined,
    showPlaybackControls: false,
    commentsManager: undefined as DocumentCommentsManager | undefined,
  }))
  .views(self => ({
    // This is needed for the tree monitor and manager
    get treeId() {
      return self.key;
    },
    get isProblem() {
      return (self.type === ProblemDocument) || (self.type === ProblemPublication);
    },
    get isGroup() {
      return (self.type === GroupDocument);
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
      return isPublishedType(self.type);
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
      const { uid, groupId, type, key, createdAt, title, originDoc, properties, visibility } = self;
      // FIXME: the contextId was added here temporarily. This metadata is sent
      // up to the Firestore functions. The new functions do not require the
      // contextId. However the old functions do. The old functions were just
      // ignoring this contextId. So the contextId is added here so the client
      // code can work with the old functions.
      // NOTE: we always return a groupId here even for non group documents. If this metadata is
      // written to Firestore or Firebase this will probably fail because this groupId will be undefined.
      // Currently it seems the metadata is not written to either place, it is just used for finding
      // Firestore documents.
      return { contextId: "ignored", uid, groupId, type, key, createdAt, title,
        originDoc, properties: properties.toJSON(), investigation: self.investigation,
        problem: self.problem, unit: self.unit, visibility } as IDocumentMetadata;
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
  }))
  .views(self => ({
    getLabel(appConfig: AppConfigModelType, count: number, lowerCase?: boolean) {
      const props = appConfig.documentLabelProperties || [];
      let docStr = self.type as string;
      props.forEach(prop => {
        docStr += self.getProperty(prop) ? `:${prop}` : `:!${prop}`;
      });
      return appConfig.getDocumentLabel(docStr, count, lowerCase);
    },
    getDisplayId(appConfig: AppConfigModelType) {
      const { docDisplayIdPropertyName } = appConfig;
      if (!docDisplayIdPropertyName) return undefined;
      if (docDisplayIdPropertyName === "key") return self.key;
      return self.getProperty(docDisplayIdPropertyName);
    },
    /**
     * Construct a name for a new tile of the given type.
     * The returned title will be unique within this document.
     * @param tileType
     * @returns new title
     */
    getUniqueTitleForType(tileType: string) {
      return self.content?.getUniqueTitleForType(tileType);
    },
    isAccessibleToUser(user: UserModelType, documentStore: IExemplarVisibilityProvider) {
      return isDocumentAccessibleToUser(self.metadata, user, documentStore);
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
    },

    setVisibility(visibility: "public" | "private") {
      self.visibility = visibility;
    },

    addTile(toolId: string, options?: IDocumentAddTileOptions) {
      const optionsWithTitle = {
        title: self.getUniqueTitleForType(toolId),
        ...options
      };
      return self.content?.userAddTile(toolId, optionsWithTitle);
    },

    deleteTile(tileId: string) {
      self.content?.userDeleteTile(tileId);
    },

    setTileComments(tileId: string, comments: TileCommentsModelType) {
      self.comments.set(tileId, comments);
    },

    incChangeCount() {
      return ++self.changeCount;
    },

    setGroupId(groupId?: string) {
      self.groupId = groupId;
    },

    setShowPlaybackControls(newValue: boolean) {
      self.showPlaybackControls = newValue;
    },

    toggleShowPlaybackControls() {
      self.showPlaybackControls = !self.showPlaybackControls;
    },
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
      // Initialize the comments manager.
      self.commentsManager = new DocumentCommentsManager();
      addDisposer(self, () => self.commentsManager?.dispose());
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
  const formulaManager = new FormulaManager();
  const adapterApi = formulaManager.getAdapterApi();

  const fullEnvironment: ITileEnvironment = {
    sharedModelManager,
    formulaManager
  };
  try {
    let document: DocumentModelType;
    try {
      document = DocumentModel.create(snapshot, fullEnvironment);
    } catch (e) {
      if (!snapshot?.content ) {
        // More info is logged about this error in the next catch statement
        throw e;
      }

      let error = e;
      try {
        // In production mode, MST does not do typechecking. This makes the errors from loading
        // an invalid document not as useful. By doing an explicit type check we can get the
        // more useful errors even in production.
        typecheck(DocumentModel, snapshot);
      } catch (typecheckError) {
        error = typecheckError;
      }

      // Putting the error in an object like this prevents Chrome from expanding the
      // error and taking up a bunch of console lines.
      console.error("Failed to load document", {docKey: snapshot.key, error});

      return createErrorDocument(
        // When we switch to typescript 5.5 this narrowing can probably be removed
        snapshot as DocumentModelSnapshotTypeWithContent,
        fullEnvironment,
        error as Error);
    }

    // initialize formula adapters after the document has been created
    setTimeout(() => formulaManager.addAdapters(createFormulaAdapters(adapterApi)));

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

    // Sync the formula datasets with the actual datasets
    // Ideally the formula manager would have a getter for the datasets that we could
    // provide so we wouldn't have to do a sync like this
    addDisposer(document, autorun(() => {
      const existingFormulaDataSetIds = Array.from(formulaManager.dataSets.keys());
      const sharedDataSets = sharedModelManager.getSharedModelsByType<typeof SharedDataSet>(kSharedDataSetType);

      // Remove any formula datasets that are no longer in the shared model manager
      existingFormulaDataSetIds.forEach((dataSetId) => {
        if (!sharedDataSets.find(sharedDataSet => sharedDataSet.dataSet.id === dataSetId)) {
          formulaManager.removeDataSet(dataSetId);
        }
      });
      // Add any formula datasets that are in the shared model manager but not in the formula manager
      sharedDataSets.forEach((sharedDataSet: SharedDataSetType) => {
        if (formulaManager.dataSets.has(sharedDataSet.dataSet.id)) {
          return; // already added
        }
        const formulaDataSet = createFormulaDataSetProxy(sharedDataSet.dataSet);
        formulaManager.addDataSet(formulaDataSet);
      });
    }));

    return document;
  } catch (e) {
    if (!snapshot) {
      console.error("Empty document failed to be created");
      throw e;
    }

    if (!snapshot.content) {
      console.error("Document with empty content failed to be created", {docKey: snapshot.key});
      throw e;
    }

    // If there was an error in the content of the document, it should have been caught above
    // and an error document returned already.
    console.error("Failed to setup document",
      // Putting the error in an object like this prevents Chrome from expanding the
      // error and taking up a bunch of console lines.
      {docKey: snapshot.key, error: e});

    return createErrorDocument(
      // When we switch to typescript 5.5 this narrowing can probably be removed
      snapshot as DocumentModelSnapshotTypeWithContent,
      fullEnvironment,
      e as Error);
  }
};

type DocumentModelSnapshotTypeWithContent = DocumentModelSnapshotType &
  Required<Pick<DocumentModelSnapshotType, 'content'>>;

/**
 * Create a document without the content, so this can be returned and passed
 * through the rest of the CLUE system. The Canvas component checks the contentStatus
 * and renders a DocumentError component if the status is Error.
 */
function createErrorDocument(
  snapshot: DocumentModelSnapshotTypeWithContent,
  fullEnvironment: ITileEnvironment,
  error?: Error) {
    const {content, ...snapshotWithoutContent} = snapshot;
    const documentWithoutContent = DocumentModel.create(snapshotWithoutContent, fullEnvironment);
    documentWithoutContent.setContentError(content, error?.message);
    return documentWithoutContent;
}

export const createDocumentModelWithEnv = (appConfig: AppConfigModelType, docSnapshot: DocumentModelSnapshotType) => {
  const newDocument = createDocumentModel(docSnapshot);
  const tileEnv = getTileEnvironment(newDocument);
  if (!tileEnv) throw new Error("missing tile environment");
  tileEnv.appConfig = appConfig;
  return newDocument;
};
