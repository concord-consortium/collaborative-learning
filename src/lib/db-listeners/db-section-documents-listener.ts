import { DB } from "../db";
import { DBOfferingUserSectionDocument } from "../db-types";
import { forEach } from "lodash";

export class DBSectionDocumentsListener {
  private db: DB;
  private sectionDocsRef: firebase.database.Reference | null  = null;

  constructor(db: DB) {
    this.db = db;
  }

  public start() {
    return new Promise<void>((resolve, reject) => {
      const sectionDocsRef = this.sectionDocsRef = this.db.firebase.ref(
        this.db.firebase.getSectionDocumentPath(this.db.stores.user));
      // use once() so we are ensured that documents are set before we resolve
      sectionDocsRef.once("value", (snapshot) => {
        this.handleLoadSectionDocuments(snapshot);
        sectionDocsRef.on("child_added", this.handleSectionDocumentChildAdded);
      })
      .then(snapshot => {
        resolve();
      })
      .catch(reject);
    });
  }

  public stop() {
    if (this.sectionDocsRef) {
      this.sectionDocsRef.off("child_added", this.handleSectionDocumentChildAdded);
    }
  }

  private handleLoadSectionDocuments = (snapshot: firebase.database.DataSnapshot) => {
    const sectionDocuments = snapshot.val();
    if (sectionDocuments) {
      forEach(sectionDocuments, (sectionDoc) => {
        this.handleSectionDocument(sectionDoc);
      });
    }
  }

  private handleSectionDocumentChildAdded = (snapshot: firebase.database.DataSnapshot) => {
    const sectionDocument: DBOfferingUserSectionDocument|null = snapshot.val();
    this.handleSectionDocument(sectionDocument);
  }

  private handleSectionDocument(sectionDocument: DBOfferingUserSectionDocument|null) {
    const {user, documents, ui} = this.db.stores;
    // If a workspace has already been created, or is currently been created, then its listeners are already set
    if (sectionDocument
          && !documents.getDocument(sectionDocument.self.sectionId)
          && this.db.creatingDocuments.indexOf(sectionDocument.self.sectionId) === -1) {
      this.db.createDocumentFromSectionDocument(user.id, sectionDocument)
        .then((document) => {
          this.db.listeners.updateGroupUserSectionDocumentListeners(document);
          this.db.listeners.monitorSectionDocumentVisibility(document);
          return document;
        })
        .then(documents.add);
    }
  }
}
