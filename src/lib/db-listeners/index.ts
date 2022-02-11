import firebase from "firebase/app";
import { throttle } from "lodash";
import { makeObservable, observable, reaction, runInAction } from "mobx";
import { getSnapshot, IDisposer, onPatch, onSnapshot } from "mobx-state-tree";

import { DB, Monitor } from "../db";
import { DBLatestGroupIdListener } from "./db-latest-group-id-listener";
import { DBGroupsListener } from "./db-groups-listener";
import { DBOtherDocumentsListener } from "./db-other-docs-listener";
import { DBProblemDocumentsListener } from "./db-problem-documents-listener";
import { DBPublicationsListener } from "./db-publications-listener";
import { DocumentModelType } from "../../models/document/document";
import { LearningLogDocument, PersonalDocument } from "../../models/document/document-types";
import { DBDocument, DatabaseType } from "../db-types";
import { DBSupportsListener } from "./db-supports-listener";
import { DBCommentsListener } from "./db-comments-listener";
import { DBStarsListener } from "./db-stars-listener";
import { BaseListener } from "./base-listener";

// only one of these should be present at a time; if it's our document
// we sync local model => firebase, otherwise we sync firebase => local model
interface IModelOrFirebaseListener {
  // firebase path to which listeners can be attached
  ref?: firebase.database.Reference;
  // disposer for MST listener which responds to MST model changes
  handlerDisposer?: IDisposer;
}
// keyed by strings like `document:${document.key}` for document contents
export type ModelListeners = Record<string, IModelOrFirebaseListener | undefined>;

export class DBListeners extends BaseListener {
  @observable public isListening = false;
  private db: DB;

  private modelListeners: ModelListeners = {};
  private documentVisibilityDisposers: Record<string, IDisposer> = {};

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

    this.stopModelListeners();
    this.callDocumentVisibilityDisposers();

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

  public getOrCreateModelListener(uniqueKeyForModel: string) {
    return this.modelListeners[uniqueKeyForModel] || (this.modelListeners[uniqueKeyForModel] = {});
  }

  // synchronize local problem document visibility (public/private) to firebase
  public monitorDocumentVisibility = (document: DocumentModelType) => {
    const { user } = this.db.stores;
    const updateRef = this.db.firebase.ref(this.db.firebase.getProblemDocumentPath(user, document.key));
    // use MobX reaction() to update document visibility in firebase whenever it changes locally
    this.documentVisibilityDisposers[document.key] =
      reaction(() => document.visibility, visibility => updateRef.update({ visibility }));
  };

  // synchronize local document metadata to firebase for personal documents and learning logs
  public monitorOtherDocumentMetadata = (document: DocumentModelType) => {
    const { user } = this.db.stores;
    const { key, type } = document;

    const listenerKey = type === PersonalDocument
                          ? `personalDocument:${key}`
                          : `learningLogWorkspace:${key}`;
    const listener = this.getOrCreateModelListener(listenerKey);
    listener.handlerDisposer?.();

    const updatePath = type === PersonalDocument
                        ? this.db.firebase.getUserPersonalDocPath(user, key)
                        : this.db.firebase.getLearningLogPath(user, key);
    const updateRef = this.db.firebase.ref(updatePath);

    const titleHandlerDisposer = reaction(() => document.title, title => updateRef.update({ title }));
    const propsHandlerDisposer = onSnapshot(document.properties, properties => updateRef.update({ properties }));
    listener.handlerDisposer = () => {
      titleHandlerDisposer();
      propsHandlerDisposer();
    };

    return document;
  };

  public monitorDocument = (document: DocumentModelType, monitor: Monitor) => {
    this.debugLog("#monitorDocument", `document: ${document.key} type: ${document.type} monitor: ${monitor}`);
    this.monitorDocumentRef(document, monitor);
    this.monitorDocumentModel(document, monitor);
  };

  public unmonitorDocument = (document: DocumentModelType, monitor: Monitor) => {
    this.debugLog("#unmonitorDocument", `document: ${document.key} type: ${document.type} monitor: ${monitor}`);
    this.unmonitorDocumentRef(document);
    this.unmonitorDocumentModel(document);
  };

  // sync local support document properties to firebase (teachers only)
  public syncDocumentProperties = (document: DocumentModelType, dbType: DatabaseType, path?: string) => {
    const { user } = this.db.stores;
    const { key } = document;

    if (dbType === "firebase") {
      const updatePath = path || this.db.firebase.getUserDocumentPath(user, key, document.uid);
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

    const docListener = this.db.listeners.getOrCreateModelListener(`document:${documentKey}`);
    docListener.ref?.off("value");
    docListener.ref = documentRef;

    documentRef.on("value", snapshot => {
      if (snapshot?.val()) {
        const updatedDoc: DBDocument = snapshot.val();
        const updatedContent = this.db.parseDocumentContent(updatedDoc);
        const documentModel = documents.getDocument(documentKey);
        documentModel?.setContent(updatedContent || {});
      }
    });
  };

  private unmonitorDocumentRef = (document: DocumentModelType) => {
    const docListener = this.modelListeners[`document:${document.key}`];
    docListener?.ref?.off("value");
  };

  private throttledSaveDocument = throttle((document: DocumentModelType) => {
    const { user } = this.db.stores;
    const { key, changeCount, content } = document;
    if (content) {
      const updatePath = this.db.firebase.getUserDocumentPath(user, key, document.uid);
      this.db.firebase.ref(updatePath)
        .update({ changeCount, content: JSON.stringify(getSnapshot(content)) })
        .then(() => {
          // console.log("Successful save", "document:", key, "changeCount:", changeCount);
        })
        .catch(() => {
          user.setIsFirebaseConnected(false);
          console.warn("Failed save!", "document:", key, "changeCount:", changeCount);
        });
    }
    // two-second throttle on the trailing edge so that with continued changes we save
    // at least and at most once every two seconds
  }, 2000, { trailing: true });

  private monitorDocumentModel = (document: DocumentModelType, monitor: Monitor) => {
    // skip if not monitoring local changes
    if (monitor !== Monitor.Local) {
      return;
    }

    const { type, key, content } = document;

    const docListener = this.db.listeners.getOrCreateModelListener(`document:${key}`);
    if (docListener.handlerDisposer) {
      console.warn("Warning: monitorDocumentModel is monitoring a document that was already being monitored!",
                    "type:", type, "key:", key, "contentId:", content?.contentId);
      docListener.handlerDisposer();
      docListener.handlerDisposer = undefined;
    }

    if (content) {
      docListener.handlerDisposer = onPatch(content, (patch) => {
        document.incChangeCount();
        this.throttledSaveDocument(document);
      });
    }
  };

  private unmonitorDocumentModel = (document: DocumentModelType) => {
    // This is currently only called for unmonitoring remote documents as a result of group changes, but
    // if it were to be called for a user's own document the result would be not saving the user's work.
    const docListener = this.modelListeners[`document:${document.key}`];
    docListener?.handlerDisposer?.();
  };

  private stopModelListeners() {
    Object.keys(this.modelListeners).forEach((docKey) => {
      const listeners = this.modelListeners[docKey];
      listeners?.handlerDisposer?.();
      listeners?.ref?.off();
    });
  }

  private callDocumentVisibilityDisposers() {
    Object.keys(this.documentVisibilityDisposers).forEach((documentKey) => {
      this.documentVisibilityDisposers[documentKey]();
    });
  }
}
