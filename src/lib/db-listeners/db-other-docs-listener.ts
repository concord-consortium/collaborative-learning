import firebase from "firebase/app";
import { size } from "lodash";
import { DB } from "../db";
import { DBOtherDocument, DBOtherPublication } from "../db-types";
import {
  LearningLogPublication, OtherDocumentType, OtherPublicationType, PersonalDocument, PersonalPublication
} from "../../models/document/document-types";
import { BaseListener } from "./base-listener";

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
      this.publicationsPath = this.db.firebase.getPersonalPublicationsPath(this.db.stores.user);
    }
    else {
      this.publicationType = LearningLogPublication;
      this.documentsPath = this.db.firebase.getLearningLogPath(this.db.stores.user);
      this.publicationsPath = this.db.firebase.getLearningLogPublicationsPath(this.db.stores.user);
    }

    const documentsRef = this.db.firebase.ref(this.documentsPath);
    this.documentsRef = documentsRef;
    documentsRef.once("value", snapshot => {
      if (size(snapshot.val()) === 0) {
        this.db.stores.documents.resolveRequiredDocumentPromiseWithNull(this.documentType);
      }
      this.debugLogHandlers("#start", "adding", ["child_added", "child_changed", "child_removed"], documentsRef);
      documentsRef.on("child_added", this.handleDocumentAdded);
      documentsRef.on("child_changed", this.handleDocumentChanged);
      documentsRef.on("child_removed", this.handleDocumentRemoved);
    });

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

  // FIXME: this assumes there is only one "other" document that is waiting to be loaded
  // per other document type with the same user. There can be multiple personal documents
  // per user, so this assumption is wrong.
  // Need to rework the document loading logic to handle multiple personal documents.
  private handleDocumentAdded = (snapshot: firebase.database.DataSnapshot) => {
    const {documents, user} = this.db.stores;
    const dbDoc: DBOtherDocument|null = snapshot.val();
    this.debugLogSnapshot("#handleDocumentAdded", snapshot);
    if (dbDoc) {
      this.db.createDocumentModelFromOtherDocument(dbDoc, this.documentType)
        .then(doc => {
          if (doc.uid === user.id) {
            !doc.getProperty("isDeleted") && documents.resolveRequiredDocumentPromise(doc);
          }
          return doc;
        });
    }
  };

  private handlePublicationAdded = (snapshot: firebase.database.DataSnapshot) => {
    const dbDoc: DBOtherPublication|null = snapshot.val();
    this.debugLogSnapshot("#handlePublicationAdded", snapshot);
    if (dbDoc) {
      // TODO: handle rejections of this promise, see the note in
      // the catch of db.ts#openDocument
      this.db.createDocumentModelFromOtherPublication(dbDoc, this.publicationType);
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
        if (dbDoc.visibility) documentModel.setVisibility(dbDoc.visibility);
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
