import firebase from "firebase/app";
import { DB } from "../db";
import { DBOtherDocument, DBOtherPublication } from "../db-types";
import {
  LearningLogPublication, OtherDocumentType, OtherPublicationType, PersonalDocument, PersonalPublication
} from "../../models/document/document-types";
import { BaseListener } from "./base-listener";
import { syncStars } from "./sync-stars";

export class DBOtherDocumentsListener extends BaseListener {
  private db: DB;
  private documentType: OtherDocumentType;
  private publicationType: OtherPublicationType;
  private documentsPath: string;
  private publicationsPath: string;
  private documentsRef: firebase.database.Reference | null  = null;
  private publicationsRef: firebase.database.Reference | null  = null;

  constructor(db: DB, documentType: OtherDocumentType) {
    super("DBOtherDocumentsListener");
    this.db = db;
    this.documentType = documentType;
  }

  public start() {
    if (this.documentType === PersonalDocument) {
      this.publicationType = PersonalPublication;
      this.documentsPath = this.db.firebase.getUserPersonalDocPath(this.db.stores.user);
      this.publicationsPath = this.db.firebase.getClassPersonalPublicationsPath(this.db.stores.user);
    }
    else {
      this.publicationType = LearningLogPublication;
      this.documentsPath = this.db.firebase.getLearningLogPath(this.db.stores.user);
      this.publicationsPath = this.db.firebase.getClassPublicationsPath(this.db.stores.user);
    }

    this.documentsRef = this.db.firebase.ref(this.documentsPath);
    this.debugLogHandlers("#start", "adding", ["child_added", "child_changed", "child_removed"], this.documentsRef);
    this.documentsRef.on("child_added", this.handleDocumentAdded);
    this.documentsRef.on("child_changed", this.handleDocumentChanged);
    this.documentsRef.on("child_removed", this.handleDocumentRemoved);

    this.publicationsRef = this.db.firebase.ref(this.publicationsPath);
    this.debugLogHandler("#start", "adding", "child_added", this.publicationsRef);
    this.publicationsRef.on("child_added", this.handlePublicationAdded);
  }

  public stop() {
    if (this.documentsRef) {
      this.debugLogHandlers("#stop", "removing", ["child_added", "child_changed", "child_removed"], this.documentsRef);
      this.documentsRef.off("child_added", this.handleDocumentAdded);
      this.documentsRef.off("child_changed", this.handleDocumentChanged);
      this.documentsRef.off("child_removed", this.handleDocumentRemoved);
    }
    if (this.publicationsRef) {
      this.debugLogHandler("#stop", "removing", "child_added", this.publicationsRef);
      this.publicationsRef.off("child_added", this.handlePublicationAdded);
    }
  }

  private handleDocumentAdded = (snapshot: firebase.database.DataSnapshot) => {
    const {documents, user} = this.db.stores;
    const dbDoc: DBOtherDocument|null = snapshot.val();
    this.debugLogSnapshot("#handleDocumentAdded", snapshot);
    if (dbDoc) {
      this.db.createDocumentModelFromOtherDocument(dbDoc, this.documentType)
        .then(this.documentType === PersonalDocument
                ? this.db.listeners.monitorPersonalDocument
                : this.db.listeners.monitorLearningLogDocument)
        .then(doc => {
          if ((doc.type === PersonalDocument) && (doc.uid === user.id)) {
            syncStars(doc, this.db);
          }
          return doc;
        })
        .then(documents.add);
    }
  };

  private handlePublicationAdded = (snapshot: firebase.database.DataSnapshot) => {
    const {documents} = this.db.stores;
    const dbDoc: DBOtherPublication|null = snapshot.val();
    this.debugLogSnapshot("#handlePublicationAdded", snapshot);
    if (dbDoc) {
      this.db.createDocumentModelFromOtherPublication(dbDoc, this.publicationType)
        .then(documents.add);
    }
  };

  private handleDocumentChanged = (snapshot: firebase.database.DataSnapshot) => {
    const {documents} = this.db.stores;
    const dbDoc: DBOtherDocument|null = snapshot.val();
    this.debugLogSnapshot("#handleDocumentChanged", snapshot);
    if (dbDoc) {
      const documentModel = documents.getDocument(dbDoc.self.documentKey);
      if (documentModel) {
        documentModel.setTitle(dbDoc.title);
      }
    }
  };

  private handleDocumentRemoved = (snapshot: firebase.database.DataSnapshot) => {
    const {documents} = this.db.stores;
    const dbDoc: DBOtherDocument|null = snapshot.val();
    this.debugLogSnapshot("#handleDocumentRemoved", snapshot);
    if (dbDoc) {
      const documentModel = documents.getDocument(dbDoc.self.documentKey);
      if (documentModel) {
        documents.remove(documentModel);
        // TODO: still need UI story for delete
      }
    }
  };
}
