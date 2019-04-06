import { DB } from "../db";
import { DBPublication } from "../db-types";
import { forEach } from "lodash";

export class DBPublicationsListener {
  private db: DB;
  private publicationsRef: firebase.database.Reference | null = null;

  constructor(db: DB) {
    this.db = db;
  }

  public start() {
    return new Promise<void>((resolve, reject) => {
      const publicationsRef = this.publicationsRef = this.db.firebase.ref(
        this.db.firebase.getPublicationsPath(this.db.stores.user)
      );
      // use once() so we are ensured that publications are set before we resolve
      publicationsRef.once("value", (snapshot) => {
        this.handleLoadPublications(snapshot);
        publicationsRef.on("child_added", this.handlePublicationChildAdded);
      })
      .then(snapshot => {
        resolve();
      })
      .catch(reject);
    });
  }

  public stop() {
    if (this.publicationsRef) {
      this.publicationsRef.off("child_added", this.handlePublicationChildAdded);
    }
  }

  private handleLoadPublications = (snapshot: firebase.database.DataSnapshot) => {
    const publications = snapshot.val();
    if (publications) {
      forEach(publications, (publication) => {
        this.handlePublication(publication);
      });
    }
  }

  private handlePublicationChildAdded = (snapshot: firebase.database.DataSnapshot) => {
    const publication: DBPublication|null = snapshot.val();
    this.handlePublication(publication);
  }

  private handlePublication = (publication: DBPublication|null) => {
    const {documents} = this.db.stores;
    if (publication) {
      this.db.createDocumentFromPublication(publication)
        .then(documents.add);
    }
  }
}
