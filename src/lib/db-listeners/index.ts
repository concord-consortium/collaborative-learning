import firebase from "firebase/app";
import { makeObservable, observable, runInAction } from "mobx";
import { onSnapshot } from "mobx-state-tree";

import { DB, Monitor } from "../db";
import { DBLatestGroupIdListener } from "./db-latest-group-id-listener";
import { DBGroupsListener } from "./db-groups-listener";
import { DBOtherDocumentsListener } from "./db-other-docs-listener";
import { DBProblemDocumentsListener } from "./db-problem-documents-listener";
import { DBPublicationsListener } from "./db-publications-listener";
import { DocumentModelType } from "../../models/document/document";
import { LearningLogDocument, PersonalDocument } from "../../models/document/document-types";
import { DatabaseType, DBDocument } from "../db-types";
import { DBSupportsListener } from "./db-supports-listener";
import { DBCommentsListener } from "./db-comments-listener";
import { DBStarsListener } from "./db-stars-listener";
import { BaseListener } from "./base-listener";

export class DBListeners extends BaseListener {
  @observable public isListening = false;
  private db: DB;

  private firebaseUnlisteners: Record<string, () => void> = {};

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
    super("DBListeners");
    makeObservable(this);
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

  public async start() {
    // listeners must start in this order so we know the latest group joined so we can autojoin groups if needed
    await this.latestGroupIdListener.start();
    // start group and document listeners
    await Promise.all([
      this.groupsListener.start(),
      this.problemDocumentsListener.start(),
      this.personalDocumentsListener.start(),
      this.learningLogsListener.start(),
      this.publicationListener.start(),
      this.supportsListener.start()
    ]);
    // start listeners that depend on documents
    await Promise.all([
      this.commentsListener.start(),
      this.starsListener.start()
    ]);

    runInAction(() => this.isListening = true);
  }

  public stop() {
    runInAction(() => this.isListening = false);

    this.stopFirebaseListeners();

    this.starsListener.stop();
    this.commentsListener.stop();
    this.supportsListener.stop();
    this.publicationListener.stop();
    this.learningLogsListener.stop();
    this.personalDocumentsListener.stop();
    this.problemDocumentsListener.stop();
    this.groupsListener.stop();
    this.latestGroupIdListener.stop();
  }

  private stopFirebaseListeners() {
    Object.values(this.firebaseUnlisteners).forEach(unlistener => unlistener?.());
  }

  public monitorDocument = (document: DocumentModelType, monitor: Monitor) => {
    this.debugLog("#monitorDocument", `document: ${document.key} type: ${document.type} monitor: ${monitor}`);
    this.monitorDocumentRef(document, monitor);
  };

  public unmonitorDocument = (document: DocumentModelType, monitor: Monitor) => {
    this.debugLog("#unmonitorDocument", `document: ${document.key} type: ${document.type} monitor: ${monitor}`);
    this.unmonitorDocumentRef(document);
  };

  // sync local support document properties to firebase (teachers only)
  // TODO: move this to client-side hook as was done with other document monitoring
  public syncSupportDocumentProperties = (document: DocumentModelType, dbType: DatabaseType, path?: string) => {
    const { user } = this.db.stores;
    const { key } = document;

    if (dbType === "firebase") {
      const updatePath = path || this.db.firebase.getUserDocumentMetadataPath(user, key, document.uid);
      const updateRef = this.db.firebase.ref(updatePath);
      // synchronize document property changes to firebase
      onSnapshot(document.properties, properties => updateRef.update({ properties }));
    }
    else if (dbType === "firestore") {
      const docRef = this.db.firestore.getMulticlassSupportDocumentRef(key);
      // synchronize document property changes to firestore
      onSnapshot(document.properties, properties => docRef.update({ properties }));
    }
  };

  private monitorDocumentRef = (document: DocumentModelType, monitor: Monitor) => {
    const { user, documents } = this.db.stores;
    const documentKey = document.key;
    const documentPath = this.db.firebase.getUserDocumentPath(user, documentKey, document.uid);
    const documentRef = this.db.firebase.ref(documentPath);

    if (monitor !== Monitor.Remote) {
      return;
    }

    const snapshotHandler = (snapshot: firebase.database.DataSnapshot) => {
      if (snapshot?.val()) {
        const updatedDoc: DBDocument = snapshot.val();
        const updatedContent = this.db.parseDocumentContent(updatedDoc);
        const documentModel = documents.getDocument(documentKey);
        documentModel?.setContent(updatedContent || {});
      }
    };

    // remove any previous listener
    this.firebaseUnlisteners[documentPath]?.();
    // install the new listener
    documentRef.on("value", snapshotHandler);
    // register the cleanup function
    this.firebaseUnlisteners[documentPath] = () => documentRef.off("value", snapshotHandler);
  };

  private unmonitorDocumentRef = (document: DocumentModelType) => {
    const { user } = this.db.stores;
    const documentPath = this.db.firebase.getUserDocumentPath(user, document.key, document.uid);
    this.firebaseUnlisteners[documentPath]?.();
    if (this.firebaseUnlisteners[documentPath]) delete this.firebaseUnlisteners[documentPath];
  };

}
