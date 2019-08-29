import { onSnapshot } from "mobx-state-tree";

import { DB } from "../db";
import { observable } from "mobx";
import { DBLatestGroupIdListener } from "./db-latest-group-id-listener";
import { DBGroupsListener } from "./db-groups-listener";
import { DBOtherDocumentsListener } from "./db-other-docs-listener";
import { DBProblemDocumentsListener } from "./db-problem-documents-listener";
import { DBPublicationsListener } from "./db-publications-listener";
import { IDisposer } from "mobx-state-tree/dist/utils";
import { DocumentModelType, LearningLogDocument, OtherDocumentType, PersonalDocument, ProblemDocument
        } from "../../models/document/document";
import { DocumentContentModel } from "../../models/document/document-content";
import { DBDocument, DBDocumentMetadata, DBOfferingUserProblemDocument } from "../db-types";
import { DBSupportsListener } from "./db-supports-listener";
import { DBCommentsListener } from "./db-comments-listener";
import { DBStarsListener } from "./db-stars-listener";

export interface ModelListeners {
  [key /* unique Key */: string]: {
    ref?: firebase.database.Reference;
    modelDisposer?: IDisposer;
  };
}

export interface UserSectionDocumentListeners {
  [key /* sectionId */: string]: {
    [key /* userId */: string]: {
      sectionDocsRef?: firebase.database.Reference;
      docContentRef?: firebase.database.Reference;
    };
  };
}

export interface DocumentModelDisposers {
  [key /* sectionId */: string]: IDisposer;
}

export class DBListeners {
  @observable public isListening = false;
  private db: DB;

  private modelListeners: ModelListeners = {};
  private groupUserProblemDocumentsListeners: UserSectionDocumentListeners = {};
  private documentModelDisposers: DocumentModelDisposers = {};

  private latestGroupIdListener: DBLatestGroupIdListener;
  private groupsListener: DBGroupsListener;
  private problemDocumentsListener: DBProblemDocumentsListener;
  private personalDocumentsListener: DBOtherDocumentsListener;
  private learningLogsListener: DBOtherDocumentsListener;
  private publicationListener: DBPublicationsListener;
  private supportsListener: DBSupportsListener;
  private commentsListener: DBCommentsListener;
  private starsListener: DBStarsListener;

  constructor(db: DB) {
    this.db = db;
    this.latestGroupIdListener = new DBLatestGroupIdListener(db);
    this.groupsListener = new DBGroupsListener(db);
    this.problemDocumentsListener = new DBProblemDocumentsListener(db);
    this.personalDocumentsListener = new DBOtherDocumentsListener(db, PersonalDocument);
    this.learningLogsListener = new DBOtherDocumentsListener(db, LearningLogDocument);
    this.publicationListener = new DBPublicationsListener(db);
    this.supportsListener = new DBSupportsListener(db);
    this.commentsListener = new DBCommentsListener(db);
    this.starsListener = new DBStarsListener(db);
  }

  public start() {
    return new Promise<void>((resolve, reject) => {
      // listeners must start in this order so we know the latest group joined so we can autojoin groups if needed
      this.latestGroupIdListener.start()
        .then(() => {
          return this.groupsListener.start();
        })
        .then(() => {
          return this.problemDocumentsListener.start();
        })
        .then(() => {
          return this.personalDocumentsListener.start();
        })
        .then(() => {
          return this.learningLogsListener.start();
        })
        .then(() => {
          return this.publicationListener.start();
        })
        .then(() => {
          return this.supportsListener.start();
        })
        .then(() => {
          return this.commentsListener.start();
        })
        .then(() => {
          return this.starsListener.start();
        })
        .then(() => {
          this.isListening = true;
        })
        .then(resolve)
        .catch(reject);
    });
  }

  public stop() {
    this.isListening = false;

    this.stopModelListeners();
    this.callDocumentModelDisposers();

    this.publicationListener.stop();
    this.learningLogsListener.stop();
    this.personalDocumentsListener.stop();
    this.problemDocumentsListener.stop();
    this.groupsListener.stop();
    this.latestGroupIdListener.stop();
  }

  public getOrCreateModelListener(uniqueKeyForModel: string) {
    if (!this.modelListeners[uniqueKeyForModel]) {
      this.modelListeners[uniqueKeyForModel] = {};
    }
    return this.modelListeners[uniqueKeyForModel];
  }

  public updateGroupUserProblemDocumentListeners(document: DocumentModelType) {
    const { user, groups } = this.db.stores;
    const userGroup = groups.groupForUser(user.id);
    const groupUsers = userGroup && userGroup.users;
    if (groupUsers) {
      groupUsers.forEach((groupUser) => {
        if (groupUser.id === user.id) {
          return;
        }
        const currentSectionDocsListener = this.getOrCreateGroupUserProblemDocumentListeners(document, groupUser.id)
          .sectionDocsRef;
        if (currentSectionDocsListener) {
          currentSectionDocsListener.off();
        }
        const groupUserDocsRef = this.db.firebase.ref(
          this.db.firebase.getProblemDocumentsPath(user, groupUser.id)
        );
        this.getOrCreateGroupUserProblemDocumentListeners(document, groupUser.id)
          .sectionDocsRef = groupUserDocsRef;
        groupUserDocsRef.on("value", this.handleGroupUserProblemDocRef(document));
      });
    }
  }

  public getOrCreateGroupUserProblemDocumentListeners(document: DocumentModelType, userId: string) {
    const docKey = document.key;
    if (!this.groupUserProblemDocumentsListeners[docKey]) {
      this.groupUserProblemDocumentsListeners[docKey] = {};
    }

    if (!this.groupUserProblemDocumentsListeners[docKey][userId]) {
      this.groupUserProblemDocumentsListeners[docKey][userId] = {};
    }

    return this.groupUserProblemDocumentsListeners[docKey][userId];
  }

  public monitorDocumentVisibility = (document: DocumentModelType) => {
    const { user } = this.db.stores;
    const updateRef = this.db.firebase.ref(this.db.firebase.getProblemDocumentPath(user, document.key));
    const disposer = (onSnapshot(document, (newDocument) => {
      updateRef.update({
        visibility: newDocument.visibility
      });
    }));
    this.documentModelDisposers[document.key] = disposer;
  }

  public monitorOtherDocument = (document: DocumentModelType, type: OtherDocumentType) => {
    const { user } = this.db.stores;
    const { key } = document;

    const listenerKey = type === PersonalDocument
                          ? `personalDocument:${key}`
                          : `learningLogWorkspace:${key}`;
    const listener = this.getOrCreateModelListener(listenerKey);
    if (listener.modelDisposer) {
      listener.modelDisposer();
    }

    const updatePath = type === PersonalDocument
                        ? this.db.firebase.getUserPersonalDocPath(user, key)
                        : this.db.firebase.getLearningLogPath(user, key);
    const updateRef = this.db.firebase.ref(updatePath);
    listener.modelDisposer = (onSnapshot(document, (newDocument) => {
      updateRef.update({
        title: newDocument.title,
        // TODO: for future ordering story add original to model and update here
      });
    }));

    return document;
  }

  public monitorPersonalDocument = (document: DocumentModelType) => {
    return this.monitorOtherDocument(document, PersonalDocument);
  }

  public monitorLearningLogDocument = (document: DocumentModelType) => {
    return this.monitorOtherDocument(document, LearningLogDocument);
  }

  public monitorDocumentRef = (document: DocumentModelType) => {
    const { user, documents } = this.db.stores;
    const documentKey = document.key;
    const documentRef = this.db.firebase.ref(this.db.firebase.getUserDocumentPath(user, documentKey));

    const docListener = this.db.listeners.getOrCreateModelListener(`document:${documentKey}`);
    if (docListener.ref) {
      docListener.ref.off("value");
    }
    docListener.ref = documentRef;

    documentRef.once("value", (snapshot) => {
      if (snapshot && snapshot.val()) {
        const updatedDoc: DBDocument = snapshot.val();
        const updatedContent = this.db.parseDocumentContent(updatedDoc);
        const documentModel = documents.getDocument(documentKey);
        if (documentModel) {
          documentModel.setContent(DocumentContentModel.create(updatedContent || {}));
          this.monitorDocumentModel(documentModel);
        }
      }
    });
  }

  public monitorDocumentModel = (document: DocumentModelType) => {
    const { user } = this.db.stores;
    const { key, content } = document;

    const docListener = this.db.listeners.getOrCreateModelListener(`document:${key}`);
    if (docListener.modelDisposer) {
      docListener.modelDisposer();
    }

    const updateRef = this.db.firebase.ref(this.db.firebase.getUserDocumentPath(user, key));
    docListener.modelDisposer = onSnapshot(content, (newContent) => {
                                  document.incChangeCount();
                                  updateRef.update({
                                    content: JSON.stringify(newContent),
                                    changeCount: document.changeCount
                                  });
                                });
  }

  private stopModelListeners() {
    Object.keys(this.modelListeners).forEach((docKey) => {
      const listeners = this.modelListeners[docKey];
      if (listeners) {
        if (listeners.modelDisposer) {
          listeners.modelDisposer();
        }

        if (listeners.ref) {
          listeners.ref.off();
        }
      }
    });
  }

  private callDocumentModelDisposers() {
    Object.keys(this.documentModelDisposers).forEach((sectionId) => {
      this.documentModelDisposers[sectionId]();
    });
  }

  private handleGroupUserProblemDocRef(document: DocumentModelType) {
    return (snapshot: firebase.database.DataSnapshot|null) => {
      const problemDocument: DBOfferingUserProblemDocument = snapshot && snapshot.val();
      if (problemDocument) {
        const groupUserId = problemDocument.self.uid;
        const docKey = problemDocument.documentKey;
        const mainUser = this.db.stores.user;
        const currentDocContentListener =
          this.db.listeners.getOrCreateGroupUserProblemDocumentListeners(document, groupUserId).docContentRef;
        if (currentDocContentListener) {
          currentDocContentListener.off();
        }
        const groupUserDocRef = this.db.firebase.ref(
          this.db.firebase.getUserDocumentPath(mainUser, docKey, groupUserId)
        );
        this.db.listeners.getOrCreateGroupUserProblemDocumentListeners(document, groupUserId)
          .docContentRef = groupUserDocRef;
        groupUserDocRef.on("value", (docContentSnapshot) => {
          this.handleGroupUserDocRef(docContentSnapshot, problemDocument);
        });
      }
    };
  }

  private handleGroupUserDocRef(
    snapshot: firebase.database.DataSnapshot|null,
    problemDocument: DBOfferingUserProblemDocument)
  {
    if (snapshot) {
      const rawGroupDoc: DBDocumentMetadata = snapshot.val();
      if (rawGroupDoc) {
        const groupUserId = rawGroupDoc.self.uid;
        const {documentKey} = rawGroupDoc.self;
        const { groups } = this.db.stores;
        const group = groups.groupForUser(groupUserId);

        this.db.openDocument({
          documentKey,
          type: ProblemDocument,
          userId: groupUserId,
          groupId: group && group.id,
          visibility: problemDocument.visibility
        }).then((groupUserDoc) => {
          this.db.stores.documents.update(groupUserDoc);
        });
      }
    }
  }
}
