import { makeObservable, observable, runInAction } from "mobx";
import { onSnapshot } from "mobx-state-tree";

import { DB } from "../db";
import { DBLatestGroupIdListener } from "./db-latest-group-id-listener";
import { DBGroupsListener } from "./db-groups-listener";
import { DBOtherDocumentsListener } from "./db-other-docs-listener";
import { DBProblemDocumentsListener } from "./db-problem-documents-listener";
import { DBPublicationsListener } from "./db-publications-listener";
import { DocumentModelType } from "../../models/document/document";
import { LearningLogDocument, PersonalDocument } from "../../models/document/document-types";
import { DatabaseType } from "../db-types";
import { DBSupportsListener } from "./db-supports-listener";
import { DBCommentsListener } from "./db-comments-listener";
import { DBBookmarksListener } from "./db-bookmarks-listener";
import { BaseListener } from "./base-listener";
import { DBDocumentsContentListener } from "./db-docs-content-listener";
import { DBStudentPersonalDocsListener } from "./db-student-personal-docs-listener";
import { DBExemplarsListener } from "./db-exemplars-listener";

export class DBListeners extends BaseListener {
  @observable public isListening = false;
  private db: DB;

  // TODO: Probably need to add a group document listener
  // If we create these docs on demand, then the other members of the group might need to
  // get the newly created document by the other member.
  // However, it might be fine to just look for an existing group document when someone
  // uses the UI to open it. This would add a little delay while opening it, but it would
  // reduce the amount of copies of state we need to keep in sync.
  private latestGroupIdListener: DBLatestGroupIdListener;
  private groupsListener: DBGroupsListener;
  private problemDocumentsListener: DBProblemDocumentsListener;
  private personalDocumentsListener: DBOtherDocumentsListener;
  private learningLogsListener: DBOtherDocumentsListener;
  private publicationListener: DBPublicationsListener;
  private studentPersonalDocsListener: DBStudentPersonalDocsListener;
  private supportsListener: DBSupportsListener;
  private commentsListener: DBCommentsListener;
  private bookmarksListener: DBBookmarksListener;
  private documentsContentListener: DBDocumentsContentListener;
  private exemplarsListener: DBExemplarsListener;

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
    this.studentPersonalDocsListener = new DBStudentPersonalDocsListener(db, PersonalDocument);
    this.supportsListener = new DBSupportsListener(db);
    this.commentsListener = new DBCommentsListener(db);
    this.bookmarksListener = new DBBookmarksListener(db);
    this.documentsContentListener = new DBDocumentsContentListener(db);
    this.exemplarsListener = new DBExemplarsListener(db);
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
      this.studentPersonalDocsListener.start(),
      this.supportsListener.start()
    ]);
    // start listeners that depend on documents
    await Promise.all([
      this.commentsListener.start(),
      this.bookmarksListener.start(),
      this.documentsContentListener.start(),
      this.exemplarsListener.start()
    ]);

    runInAction(() => this.isListening = true);
  }

  public stop() {
    runInAction(() => this.isListening = false);

    this.documentsContentListener.stop();
    this.bookmarksListener.stop();
    this.commentsListener.stop();
    this.supportsListener.stop();
    this.publicationListener.stop();
    this.studentPersonalDocsListener.stop();
    this.learningLogsListener.stop();
    this.personalDocumentsListener.stop();
    this.problemDocumentsListener.stop();
    this.groupsListener.stop();
    this.latestGroupIdListener.stop();
    this.exemplarsListener.stop();
  }

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

}
