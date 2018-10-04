import { DB } from "../db";
import { DBPublication } from "../db-types";

export class DBPublicationsListener {
  private db: DB;
  private publicationsRef: firebase.database.Reference | null = null;

  constructor(db: DB) {
    this.db = db;
  }

  public start() {
    this.publicationsRef = this.db.firebase.ref(
      this.db.firebase.getPublicationsPath(this.db.stores.user)
    );
    this.publicationsRef.on("child_added", this.handlePublicationAdded);
  }

  public stop() {
    if (this.publicationsRef) {
      this.publicationsRef.off("child_added", this.handlePublicationAdded);
    }
  }

  private handlePublicationAdded = (snapshot: firebase.database.DataSnapshot) => {
    const {documents} = this.db.stores;
    const publication: DBPublication|null = snapshot.val();
    if (publication) {
      this.db.createDocumentFromPublication(publication)
        .then(documents.add);
    }
  }
}
