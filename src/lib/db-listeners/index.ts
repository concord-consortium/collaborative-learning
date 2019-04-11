import { onSnapshot } from "mobx-state-tree";

import { DB } from "../db";
import { observable } from "mobx";
import { DBLatestGroupIdListener } from "./db-latest-group-id-listener";
import { DBGroupsListener } from "./db-groups-listener";
import { DBSectionDocumentsListener } from "./db-section-documents-listener";
import { DBLearningLogsListener } from "./db-learning-logs-listener";
import { DBPublicationsListener } from "./db-publications-listener";
import { IDisposer } from "mobx-state-tree/dist/utils";
import { DocumentModelType, SectionDocument } from "../../models/document/document";
import { DocumentContentModel } from "../../models/document/document-content";
import { DBOfferingUserSectionDocument, DBDocument, DBDocumentMetadata } from "../db-types";
import { DBSupportsListener } from "./db-supports-listener";
import { DBCommentsListener } from "./db-comments-listener";

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
  private groupUserSectionDocumentsListeners: UserSectionDocumentListeners = {};
  private documentModelDisposers: DocumentModelDisposers = {};

  private latestGroupIdListener: DBLatestGroupIdListener;
  private groupsListener: DBGroupsListener;
  private sectionDocumentsListener: DBSectionDocumentsListener;
  private learningLogsListener: DBLearningLogsListener;
  private publicationListener: DBPublicationsListener;
  private supportsListener: DBSupportsListener;
  private commentsListener: DBCommentsListener;

  constructor(db: DB) {
    this.db = db;
    this.latestGroupIdListener = new DBLatestGroupIdListener(db);
    this.groupsListener = new DBGroupsListener(db);
    this.sectionDocumentsListener = new DBSectionDocumentsListener(db);
    this.learningLogsListener = new DBLearningLogsListener(db);
    this.publicationListener = new DBPublicationsListener(db);
    this.supportsListener = new DBSupportsListener(db);
    this.commentsListener = new DBCommentsListener(db);
  }

  public start() {
    return new Promise<void>((resolve, reject) => {
      // listeners must start in this order so we know the latest group joined so we can autojoin groups if needed
      this.latestGroupIdListener.start()
        .then(() => {
          return this.groupsListener.start();
        })
        .then(() => {
          return this.sectionDocumentsListener.start();
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
    this.sectionDocumentsListener.stop();
    this.groupsListener.stop();
    this.latestGroupIdListener.stop();
  }

  public getOrCreateModelListener(uniqueKeyForModel: string) {
    if (!this.modelListeners[uniqueKeyForModel]) {
      this.modelListeners[uniqueKeyForModel] = {};
    }
    return this.modelListeners[uniqueKeyForModel];
  }

  public updateGroupUserSectionDocumentListeners(document: DocumentModelType) {
    const { user, groups } = this.db.stores;
    const userGroup = groups.groupForUser(user.id);
    const groupUsers = userGroup && userGroup.users;
    if (groupUsers) {
      groupUsers.forEach((groupUser) => {
        if (groupUser.id === user.id) {
          return;
        }
        const currentSectionDocsListener = this.getOrCreateGroupUserSectionDocumentListeners(document, groupUser.id)
          .sectionDocsRef;
        if (currentSectionDocsListener) {
          currentSectionDocsListener.off();
        }
        const groupUserSectionDocsRef = this.db.firebase.ref(
          this.db.firebase.getSectionDocumentPath(user, document.sectionId, groupUser.id)
        );
        this.getOrCreateGroupUserSectionDocumentListeners(document, groupUser.id)
          .sectionDocsRef = groupUserSectionDocsRef;
        groupUserSectionDocsRef.on("value", this.handleGroupUserSectionDocRef(document));
      });
    }
  }

  public getOrCreateGroupUserSectionDocumentListeners(document: DocumentModelType, userId: string) {
    const sectionId = document.sectionId!;
    if (!this.groupUserSectionDocumentsListeners[sectionId]) {
      this.groupUserSectionDocumentsListeners[sectionId] = {};
    }

    if (!this.groupUserSectionDocumentsListeners[sectionId][userId]) {
      this.groupUserSectionDocumentsListeners[sectionId][userId] = {};
    }

    return this.groupUserSectionDocumentsListeners[sectionId][userId];
  }

  public monitorSectionDocumentVisibility = (document: DocumentModelType) => {
    const { user } = this.db.stores;
    const updateRef = this.db.firebase.ref(this.db.firebase.getSectionDocumentPath(user, document.sectionId));
    const disposer = (onSnapshot(document, (newDocument) => {
      updateRef.update({
        visibility: newDocument.visibility
      });
    }));
    this.documentModelDisposers[document.sectionId!] = disposer;
  }

  public monitorLearningLogDocument = (learningLog: DocumentModelType) => {
    const { user } = this.db.stores;
    const { key } = learningLog;

    const listener = this.getOrCreateModelListener(`learningLogWorkspace:${key}`);
    if (listener.modelDisposer) {
      listener.modelDisposer();
    }

    const updateRef = this.db.firebase.ref(this.db.firebase.getLearningLogPath(user, key));
    listener.modelDisposer = (onSnapshot(learningLog, (newLearningLog) => {
      updateRef.update({
        title: newLearningLog.title,
        // TODO: for future ordering story add original to model and update here
      });
    }));

    return learningLog;
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

    let initialLoad = true;
    documentRef.on("value", (snapshot) => {
      if (snapshot && snapshot.val()) {
        const updatedDoc: DBDocument = snapshot.val();
        const updatedContent = this.db.parseDocumentContent(updatedDoc, initialLoad);
        initialLoad = false;
        if (updatedContent) {
          const documentModel = documents.getDocument(documentKey);
          if (documentModel) {
            documentModel.setContent(DocumentContentModel.create(updatedContent));
            this.monitorDocumentModel(documentModel);
          }
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
    docListener.modelDisposer = (onSnapshot(content, (newContent) => {
      updateRef.update({
        content: JSON.stringify(newContent)
      });
    }));
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

  private handleGroupUserSectionDocRef(document: DocumentModelType) {
    return (snapshot: firebase.database.DataSnapshot|null) => {
      const sectionDocument: DBOfferingUserSectionDocument = snapshot && snapshot.val();
      if (sectionDocument) {
        const groupUserId = sectionDocument.self.uid;
        const docKey = sectionDocument.documentKey;
        const mainUser = this.db.stores.user;
        const currentDocContentListener =
          this.db.listeners.getOrCreateGroupUserSectionDocumentListeners(document, groupUserId).docContentRef;
        if (currentDocContentListener) {
          currentDocContentListener.off();
        }
        const groupUserDocRef = this.db.firebase.ref(
          this.db.firebase.getUserDocumentPath(mainUser, docKey, groupUserId)
        );
        this.db.listeners.getOrCreateGroupUserSectionDocumentListeners(document, groupUserId)
          .docContentRef = groupUserDocRef;
        groupUserDocRef.on("value", (docContentSnapshot) => {
          this.handleGroupUserDocRef(docContentSnapshot, sectionDocument);
        });
      }
    };
  }

  private handleGroupUserDocRef(
    snapshot: firebase.database.DataSnapshot|null,
    sectionDocument: DBOfferingUserSectionDocument)
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
          type: SectionDocument,
          sectionId: sectionDocument.self.sectionId,
          userId: groupUserId,
          groupId: group && group.id,
          visibility: sectionDocument.visibility
        }).then((groupUserDoc) => {
          this.db.stores.documents.update(groupUserDoc);
        });
      }
    }
  }
}
