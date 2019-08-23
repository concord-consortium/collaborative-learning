import { DB } from "../db";
import { DBPersonalDocument, DBOtherDocPublication } from "../db-types";

export class DBPersonalDocumentsListener {
  private db: DB;
  private personalDocsRef: firebase.database.Reference | null  = null;
  private publishedDocsRef: firebase.database.Reference | null  = null;

  constructor(db: DB) {
    this.db = db;
  }

  public start() {
    this.personalDocsRef = this.db.firebase.ref(this.db.firebase.getUserPersonalDocPath(this.db.stores.user));
    this.personalDocsRef.on("child_added", this.handlePersonalDocChildAdded);
    this.personalDocsRef.on("child_changed", this.handlePersonalDocChildChanged);
    this.personalDocsRef.on("child_removed", this.handlePersonalDocChildRemoved);

    this.publishedDocsRef = this.db.firebase.ref(this.db.firebase
      .getClassPersonalPublicationsPath(this.db.stores.user));
    this.publishedDocsRef.on("child_added", this.handlePersonalDocPublished);
  }

  public stop() {
    if (this.personalDocsRef) {
      this.personalDocsRef.off("child_added", this.handlePersonalDocChildAdded);
      this.personalDocsRef.off("child_changed", this.handlePersonalDocChildChanged);
      this.personalDocsRef.off("child_removed", this.handlePersonalDocChildRemoved);
    }
    if (this.publishedDocsRef) {
      this.publishedDocsRef.off("child_added", this.handlePersonalDocPublished);
    }
  }

  private handlePersonalDocChildAdded = (snapshot: firebase.database.DataSnapshot) => {
    const {documents} = this.db.stores;
    const dbDoc: DBPersonalDocument|null = snapshot.val();
    if (dbDoc) {
      this.db.createDocumentFromPersonalDocument(dbDoc)
        .then(this.db.listeners.monitorPersonalDocument)
        .then(documents.add);
    }
  }

  private handlePersonalDocPublished = (snapshot: firebase.database.DataSnapshot) => {
    const {documents} = this.db.stores;
    const dbDoc: DBOtherDocPublication|null = snapshot.val();
    if (dbDoc) {
      this.db.createDocumentFromPublishedPersonalDoc(dbDoc)
        .then(documents.add);
    }
  }

  private handlePersonalDocChildChanged = (snapshot: firebase.database.DataSnapshot) => {
    const {documents} = this.db.stores;
    const dbDoc: DBPersonalDocument|null = snapshot.val();
    if (dbDoc) {
      const documentModel = documents.getDocument(dbDoc.self.documentKey);
      if (documentModel) {
        documentModel.setTitle(dbDoc.title);
      }
    }
  }

  private handlePersonalDocChildRemoved = (snapshot: firebase.database.DataSnapshot) => {
    const {documents} = this.db.stores;
    const dbDoc: DBPersonalDocument|null = snapshot.val();
    if (dbDoc) {
      const documentModel = documents.getDocument(dbDoc.self.documentKey);
      if (documentModel) {
        documents.remove(documentModel);
        // TODO: still need UI story for delete
      }
    }
  }
}
