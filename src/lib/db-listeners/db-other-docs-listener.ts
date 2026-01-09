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

  // FIXME: there is one of these "other document" listeners for each type of other document.
  // The code below waits for a "other document" to be created and then calls
  // resolveRequiredDocumentPromise with this document. That resolve method only looks at
  // the type of the document then the resolves a single promise for this type of document.
  // In the case of personal documents there can be multiple personal documents per user.
  // So it is possible that multiple personal documents are created at the same time but
  // only one of them will be used with the resolved promise. This is a problem because
  // the `DB.createOtherDocument` is waiting for this promise and assuming it resolves
  // with the document it just created.
  // Need to rework the document loading logic to safely handle multiple personal documents.
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
