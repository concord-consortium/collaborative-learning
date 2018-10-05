import { DB } from "../db";
import { DBOfferingUserSectionDocument } from "../db-types";

export class DBSectionDocumentsListener {
  private db: DB;
  private sectionDocsRef: firebase.database.Reference | null  = null;

  constructor(db: DB) {
    this.db = db;
  }

  public start() {
    this.sectionDocsRef = this.db.firebase.ref(this.db.firebase.getSectionDocumentPath(this.db.stores.user));
    this.sectionDocsRef.on("child_added", this.handleSectionDocumentChildAdded);
  }

  public stop() {
    if (this.sectionDocsRef) {
      this.sectionDocsRef.off("child_added", this.handleSectionDocumentChildAdded);
    }
  }

  private handleSectionDocumentChildAdded = (snapshot: firebase.database.DataSnapshot) => {
    const {user, documents, ui} = this.db.stores;
    const sectionDocument: DBOfferingUserSectionDocument|null = snapshot.val();
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
