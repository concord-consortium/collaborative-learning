import firebase from "firebase/app";
import { autorun, IReactionDisposer } from "mobx";
import { DocumentModelType } from "../../models/document/document";
import { ProblemDocument } from "../../models/document/document-types";
import { DB } from "../db";
import { DBDocument } from "../db-types";
import { BaseListener } from "./base-listener";

class DocumentMonitor {
  public document: DocumentModelType;
  ref: firebase.database.Reference;
  db: DB;
  path: string;

  constructor(document: DocumentModelType, path: string, db: DB) {
    this.document = document;
    this.db = db;
    this.path = path;

    this.ref = this.db.firebase.ref(path);
    this.ref.on("value", this.snapshotHandler);
  }

  // The arrow function is required here so the function will be
  // bound to `this` when used by `ref.on(...)`
  private snapshotHandler = (snapshot: firebase.database.DataSnapshot) => {
    if (snapshot?.val()) {
      const updatedDoc: DBDocument = snapshot.val();
      const updatedContent = this.db.parseDocumentContent(updatedDoc);
      this.document?.setContent(updatedContent || {});
    }
  };

  public get description() {
    return `document: ${this.document.key} type: ${this.document.type} path: ${this.path}`;
  }

  public off() {
    this.ref.off("value", this.snapshotHandler);
  }
}

export class DBDocumentsContentListener extends BaseListener {
  private db: DB;
  // key is the document's path in firebase
  private documentMonitors: Record<string, DocumentMonitor> = {};
  private disposer: IReactionDisposer;

  constructor(db: DB) {
    super("DBDocumentContentListener");
    this.db = db;
  }

  public start() {
    this.disposer = autorun(() => {
      const {documents, groups, user} = this.db.stores;

      const documentsToMonitor: DocumentModelType[] = [];

      documents.byType(ProblemDocument).forEach((document) => {
        // Besides collecting the documents to monitor, we also update the group
        // id of the document. A new document could be added with an out of date
        // group id. Or a user's group can change. In both cases the document
        // should be updated.
        document.setGroupId(groups.groupIdForUser(document.uid));

        // Users don't monitor their own documents
        if ((document.uid === user.id)) {
          return;
        }

        // RESEARCHER-ACCESS: should this be changed to isTeacherOrResearcher?
        // teachers monitor all problem documents
        // students only monitor documents in their group to save bandwidth
        if (user.isTeacher || document.groupId === user.currentGroupId) {
          documentsToMonitor.push(document);
        }
      });

      // Stop monitoring any documents we shouldn't be
      // This could happen if a user changes groups
      Object.keys(this.documentMonitors).forEach(monitoredDocPath => {
        // Should this document be monitored?
        if(!documentsToMonitor.find((document) => this.getDocumentPath(document) === monitoredDocPath)) {
          this.unmonitorDocumentByPath(monitoredDocPath);
        }
      });

      // Ensure we are monitoring any new documents
      documentsToMonitor.forEach(document => {
        // If the document is already monitored it will not be monitored twice
        this.monitorDocument(document);
      });
    });

  }

  public stop() {
    this.disposer?.();
    this.unmonitorAllDocuments();
  }

  private getDocumentPath = (document: DocumentModelType) => {
    const { user } = this.db.stores;
    const documentKey = document.key;
    return this.db.firebase.getUserDocumentPath(user, documentKey, document.uid);
  };

  private monitorDocument = (document: DocumentModelType) => {
    const documentPath = this.getDocumentPath(document);

    if (this.documentMonitors[documentPath]) {
      // We are already monitoring this document
      return;
    }

    const documentMonitor = new DocumentMonitor(document, documentPath, this.db);
    this.debugLog("#monitorDocument", documentMonitor.description);
    this.documentMonitors[documentPath] = documentMonitor;
  };

  private unmonitorDocumentByPath = (documentPath: string) => {
    const documentMonitor = this.documentMonitors[documentPath];
    if (documentMonitor) {
      this.debugLog("#unmonitorDocument", documentMonitor.description);
      documentMonitor.off();
      delete this.documentMonitors[documentPath];
    }
  };

  private unmonitorAllDocuments() {
    Object.keys(this.documentMonitors).forEach(documentPath => this.unmonitorDocumentByPath(documentPath));
  }

}
