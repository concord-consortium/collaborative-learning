import { forEach } from "lodash";
import { types } from "mobx-state-tree";
import { observable } from "mobx";
import { AppConfigModelType } from "./app-config-model";
import { DocumentModelType } from "../document/document";
import {
  DocumentType, ExemplarDocument, GroupDocument, LearningLogDocument, LearningLogPublication,
  OtherDocumentType, OtherPublicationType,
  PersonalDocument, PersonalPublication, PlanningDocument, ProblemDocument, ProblemPublication
} from "../document/document-types";
import { getTileEnvironment } from "../tiles/tile-environment";
import { ClassModelType } from "./class";
import { UserModelType } from "./user";
import { DEBUG_DOCUMENT } from "../../lib/debug";
import { Firestore } from "../../lib/firestore";
import { TreeManagerType } from "../history/tree-manager";
import { FirestoreHistoryManager,
  IFirestoreHistoryManagerArgs } from "../history/firestore-history-manager";
import { FirestoreHistoryManagerConcurrent } from "../history/firestore-history-manager-concurrent";
import { UserContextProvider } from "./user-context-provider";

const extractLatestPublications = (publications: DocumentModelType[], attr: "uid" | "originDoc") => {
  const latestPublications: DocumentModelType[] = [];
  publications.forEach((publication) => {
    const latestIndex = latestPublications.findIndex((pub) => pub[attr] === publication[attr]);
    if (latestIndex === -1) {
      latestPublications.push(publication);
    }
    else if (publication.createdAt > latestPublications[latestIndex].createdAt) {
      latestPublications[latestIndex] = publication;
    }
  });
  return latestPublications;
};

export interface IRequiredDocumentPromise {
  promise: Promise<DocumentModelType | null>;
  resolve: (document: DocumentModelType | null) => void;
  isResolved: boolean;
}

export const DocumentsModel = types
  .model("Documents", {
  })
  .volatile(self => ({
    appConfig: undefined as AppConfigModelType | undefined,
    userContextProvider: undefined as UserContextProvider | undefined,
    firestore: undefined as Firestore | undefined,
    requiredDocuments: {} as Record<string, IRequiredDocumentPromise>,
    visibleExemplars: observable(new Set<string>()),
    all: observable<DocumentModelType>([])
  }))
  .views(self => ({
    getDocument(documentKey: string) {
      return self.all.find((document) => document.key === documentKey);
    },
    byType(type: DocumentType) {
      return self.all.filter((document) => document.type === type);
    },

    byTypeForUser(type: DocumentType, userId: string) {
      return self.all.filter((document) => {
        return (document.type === type) && (document.uid === userId);
      });
    },

    isExemplarVisible(exemplarId: string) {
      return self.visibleExemplars.has(exemplarId);
    }
  }))
  .views(self => ({
    getTypeOfTileInDocument(documentKey: string, tileId: string) {
      return self.getDocument(documentKey)?.content?.getTileType(tileId);
    },
    getNextPersonalDocumentTitle(user: UserModelType, base: string) {
      let maxUntitled = 0;
      self.byTypeForUser(PersonalDocument, user.id)
        .forEach(document => {
          const match = /.*-([0-9]+)$/.exec(document.title || "");
          // length check to skip timestamps
          if (match && match[1] && (match[1].length < 4)) {
            const suffix = parseInt(match[1], 10);
            maxUntitled = Math.max(maxUntitled, suffix);
          }
        });
      return `${base}-${++maxUntitled}`;
    },

    getPersonalDocument(userId: string) {
      return self.all.find((document) => {
        return (document.type === PersonalDocument) && (document.uid === userId);
      });
    },

    getLearningLogDocument(userId: string) {
      return self.all.find((document) => {
        return (document.type === LearningLogDocument) && (document.uid === userId);
      });
    },

    getPlanningDocument(userId: string) {
      return self.all.find((document) => {
        return (document.type === PlanningDocument) && (document.uid === userId);
      });
    },

    getProblemDocument(userId: string) {
      return self.all.find((document) => {
        return (document.type === ProblemDocument) && (document.uid === userId);
      });
    },

    getProblemDocumentsForGroup(groupId: string) {
      return self.all.filter((document) => {
        return (document.type === ProblemDocument) && (document.groupId === groupId);
      });
    },

    getLastPublishedProblemDocumentsForGroup(groupId: string) {
      const groupPublications = self.byType(ProblemPublication).filter((pub) => pub.groupId === groupId);
      return extractLatestPublications(groupPublications, "uid");
    },

    getNextLearningLogTitle(user: UserModelType, base: string) {
      let maxUntitled = 0;
      self.byTypeForUser(LearningLogDocument, user.id)
        .forEach(document => {
          const match = /.*-([0-9]+)$/.exec(document.title || "");
          // length check to skip timestamps
          if (match && match[1] && (match[1].length < 4)) {
            const suffix = parseInt(match[1], 10);
            maxUntitled = Math.max(maxUntitled, suffix);
          }
        });
      return `${base}-${++maxUntitled}`;
    },

    // Returns the most recently published personal documents or learning logs per user, sorted by title
    getLatestOtherPublications(type: OtherPublicationType) {
      const latestPublications = extractLatestPublications(self.byType(type), "originDoc");
      return latestPublications.sort((pub1, pub2) => {
        return (pub1.title || "").localeCompare(pub2.title || "");
      });
    },

    // Returns the most recently published docs for the given section/problem per user, sorted by name
    getLatestPublications(clazz: ClassModelType) {
      const latestPublications = extractLatestPublications(self.byType(ProblemPublication), "uid");
      return latestPublications.sort((pub1, pub2) => {
        const user1 = clazz.getUserById(pub1.uid);
        const user2 = clazz.getUserById(pub2.uid);
        // Every publication should have a user, but if it's missing, sort that document last
        if (!user1 || !user2) return (user2 ? 1 : 0) - (user1 ? 1 : 0);
        return user1.lastName !== user2.lastName
          ? user1.lastName.localeCompare(user2.lastName)
          : user1.firstName.localeCompare(user2.firstName);
      });
    },

    get exemplarDocuments() {
      return self.byType(ExemplarDocument);
    },

    get visibleExemplarDocuments() {
      return self.byType(ExemplarDocument).filter(e => self.isExemplarVisible(e.key));
    },

    get invisibleExemplarDocuments() {
      return self.byType(ExemplarDocument).filter(e => !self.isExemplarVisible(e.key));
    }
  }))
  .views(self => ({
    getLatestPersonalPublications() {
      return self.getLatestOtherPublications(PersonalPublication);
    },

    getLatestLogPublications() {
      return self.getLatestOtherPublications(LearningLogPublication);
    },

    getNextOtherDocumentTitle(user: UserModelType, documentType: OtherDocumentType, base: string) {
      switch (documentType) {
        case PersonalDocument: return self.getNextPersonalDocumentTitle(user, base);
        case LearningLogDocument: return self.getNextLearningLogTitle(user, base);
      }
      return "";
    }
  }))
  .actions(self => ({
    setAppConfig(appConfig: AppConfigModelType) {
      self.appConfig = appConfig;
    },
    setUserContextProvider(userContextProvider: UserContextProvider) {
      self.userContextProvider = userContextProvider;
    },
    setFirestore(firestore: Firestore) {
      self.firestore = firestore;
    },
    setExemplarVisible(exemplarId: string, visible: boolean) {
      if (visible) {
        self.visibleExemplars.add(exemplarId);
      } else {
        self.visibleExemplars.delete(exemplarId);
      }
    }
  }))
  .actions((self) => {
    const add = (document: DocumentModelType) => {
      if (DEBUG_DOCUMENT) {
        // eslint-disable-next-line no-console
        console.log("adding document to DocumentsModel", {
          key: document.key,
          title: document.title,
          uid: document.uid,
          type: document.type,
          visibility: document.visibility
        });
      }
      if (!self.getDocument(document.key)) {
        self.all.push(document);
        const tileEnv = getTileEnvironment(document);
        if (tileEnv) tileEnv.appConfig = self.appConfig;

        const {firestore, userContextProvider} = self;

        if (!firestore || !userContextProvider) {
          // TODO: There is a chance that we'll lose history if the documents
          // model isn't setup right. However, there are several cases where the
          // documents does not need to save history so the firestore and
          // userContext is not set in these cases:
          // - the `stores.network` documents model just contains read only
          //   documents which also can't replay history.
          // - in tests a documents model is created just for the test
          //
          // When we work on:
          // https://www.pivotaltracker.com/story/show/183291353
          //
          // > Safeguard the real documents from having their history changed by
          // > the history slider. This can be done by adding a flag or some
          // > other way to identify the history documents and only loading
          // > history into documents with this flag.
          //
          // We can consider adding another "type" to this flag indicating the
          // document should be read-only like a network/remote document. Then
          // we can add a warning if it looks like the document should be saving
          // history but there isn't firestore or userContext here
          return;
        }

        const treeManager = document.treeManagerAPI as TreeManagerType;

        // Set up the Firestore history manager to save history entries
        // Note: because the FirestoreHistoryManager currently only manages saving history
        // to Firestore, it'd be cleaner to set it up in the same place that
        // treeMonitor.enableMonitoring() is called. That only happens when the document
        // is being edited.
        // However, in the near future we plan to extend this to also manage
        // loading history and possibly keeping the document state in sync with the
        // history.
        // In the case of loading history this will be needed for any document.
        const historyManagerArgs: IFirestoreHistoryManagerArgs = {
          firestore,
          userContextProvider,
          treeManager,
          uploadLocalHistory: true,
          syncRemoteHistory: false
        };
        if (document.type === GroupDocument) {
          historyManagerArgs.syncRemoteHistory = true;
          const manager = new FirestoreHistoryManagerConcurrent(historyManagerArgs);
          treeManager.setHistoryManager(manager);
        } else {
          const manager = new FirestoreHistoryManager(historyManagerArgs);
          treeManager.setHistoryManager(manager);
        }

        // The history manager is now stored on the treeManager via setHistoryManager.
        // When the treeManager is no longer referenced anywhere the history manager
        // will get garbage collected.
        // A FirestoreHistoryManager is also used when the history is being played back
        // by the Canvas component. In that case it is a new document copy that is completely
        // that isn't added from the DocumentsModel. So there it can't reuse the same history
        // manager. It is wasteful to have two history managers and two copies of the
        // the history data in memory, but that is the easiest way to deal with it for now.
      } else {
        console.warn("Document with the same key already exists");
      }
    };

    const remove = (document: DocumentModelType) => {
      self.all.remove(document);
    };

    /*
     * The required document promises are used to facilitate the creation of required documents
     * while preventing the creation of redundant documents. Depending on the configuration, any
     * of problem, planning, personal, and/or learning log documents may be required. Required
     * documents are created automatically when the user enters the workspace if there is not
     * already a document of the corresponding type. Prior to the introduction of these promises,
     * we were assuming that the code for reading a user's documents would complete before the
     * code for generating required documents ran, i.e. whether or not required documents were
     * created was dependent on the outcome of a race condition. As a result, under some
     * circumstances we would create a redundant required document simply because at that point
     * in time the code hadn't yet determined whether the user already had any documents of the
     * appropriate type. We now maintain a promise for each type of potentially required document
     * which is resolved to the first document of that type encountered or to null if we determine
     * that there are no documents of the appropriate type. Code that creates required documents
     * now awaits these promises and only proceeds with the creation of default documents if the
     * corresponding promise is resolved with null.
     */
    const addRequiredDocumentPromises = (requiredTypes: string[]) => {
      requiredTypes.forEach(type => {
        const wrapper: Partial<IRequiredDocumentPromise> = { isResolved: false };
        wrapper.promise = new Promise(resolve => {
          wrapper.resolve = (document: DocumentModelType | null) => {
            resolve(document);
            wrapper.isResolved = true;
          };
        });
        self.requiredDocuments[type] = wrapper as IRequiredDocumentPromise;
      });
    };

    // resolve the promise corresponding to this document's type with this document
    const resolveRequiredDocumentPromise = (document: DocumentModelType) => {
      const promise = self.requiredDocuments[document.type];
      !promise?.isResolved && promise?.resolve(document);
    };

    // resolve the specified promise with null, i.e. the user has no documents of this type
    const resolveRequiredDocumentPromiseWithNull = (type: string) => {
      const promise = self.requiredDocuments[type];
      if (!promise) {
        // Some types do not have any required documents, so we just ignore these
        return;
      }
      !promise.isResolved && promise.resolve(null);
    };

    // convenience function for nulling multiple promises
    // if `requiredTypes` is empty then all promises are nulled (mainly useful for testing)
    const resolveRequiredDocumentPromisesWithNull = (requiredTypes?: string[]) => {
      if (requiredTypes) {
        requiredTypes.forEach(type => resolveRequiredDocumentPromiseWithNull(type));
      }
      else {
        forEach(self.requiredDocuments, (p, type) => resolveRequiredDocumentPromiseWithNull(type));
      }
    };

    const findDocumentOfTile = (tileId: string): DocumentModelType | null => {
      const parentDocument = self.all.find(document => !!document.content?.tileMap.get(tileId));
      return parentDocument || null;
    };

    return {
      add,
      remove,
      addRequiredDocumentPromises,
      resolveRequiredDocumentPromise,
      resolveRequiredDocumentPromiseWithNull,
      resolveRequiredDocumentPromisesWithNull,
      findDocumentOfTile
    };
  });

export type DocumentsModelType = typeof DocumentsModel.Type;

export function createDocumentsModelWithRequiredDocuments(requiredTypes: string[]) {
  const documents = DocumentsModel.create();
  documents.addRequiredDocumentPromises(requiredTypes);
  return documents;
}
