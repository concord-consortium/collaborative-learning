import { DB } from "../db";
import { DBOtherDocument, DBOtherPublication } from "../db-types";
import { LearningLogPublication, OtherDocumentType, OtherPublicationType, PersonalDocument, PersonalPublication
        } from "../../models/document/document";

export class DBOtherDocumentsListener {
  private db: DB;
  private documentType: OtherDocumentType;
  private publicationType: OtherPublicationType;
  private documentsPath: string;
  private publicationsPath: string;
  private documentsRef: firebase.database.Reference | null  = null;
  private publicationsRef: firebase.database.Reference | null  = null;

  constructor(db: DB, documentType: OtherDocumentType) {
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
    this.documentsRef.on("child_added", this.handleDocumentAdded);
    this.documentsRef.on("child_changed", this.handleDocumentChanged);
    this.documentsRef.on("child_removed", this.handleDocumentRemoved);

    this.publicationsRef = this.db.firebase.ref(this.publicationsPath);
    this.publicationsRef.on("child_added", this.handlePublicationAdded);
  }

  public stop() {
    if (this.documentsRef) {
      this.documentsRef.off("child_added", this.handleDocumentAdded);
      this.documentsRef.off("child_changed", this.handleDocumentChanged);
      this.documentsRef.off("child_removed", this.handleDocumentRemoved);
    }
    if (this.publicationsRef) {
      this.publicationsRef.off("child_added", this.handlePublicationAdded);
    }
  }

  private handleDocumentAdded = (snapshot: firebase.database.DataSnapshot) => {
    const {documents} = this.db.stores;
    const dbDoc: DBOtherDocument|null = snapshot.val();
    if (dbDoc) {
      this.db.createDocumentModelFromOtherDocument(dbDoc, this.documentType)
        .then(this.documentType === PersonalDocument
                ? this.db.listeners.monitorPersonalDocument
                : this.db.listeners.monitorLearningLogDocument)
        .then(documents.add);
    }
  }

  private handlePublicationAdded = (snapshot: firebase.database.DataSnapshot) => {
    const {documents} = this.db.stores;
    const dbDoc: DBOtherPublication|null = snapshot.val();
    if (dbDoc) {
      this.db.createDocumentModelFromOtherPublication(dbDoc, this.publicationType)
        .then(documents.add);
    }
  }

  private handleDocumentChanged = (snapshot: firebase.database.DataSnapshot) => {
    const {documents} = this.db.stores;
    const dbDoc: DBOtherDocument|null = snapshot.val();
    if (dbDoc) {
      const documentModel = documents.getDocument(dbDoc.self.documentKey);
      if (documentModel) {
        documentModel.setTitle(dbDoc.title);
      }
    }
  }

  private handleDocumentRemoved = (snapshot: firebase.database.DataSnapshot) => {
    const {documents} = this.db.stores;
    const dbDoc: DBOtherDocument|null = snapshot.val();
    if (dbDoc) {
      const documentModel = documents.getDocument(dbDoc.self.documentKey);
      if (documentModel) {
        documents.remove(documentModel);
        // TODO: still need UI story for delete
      }
    }
  }
}
