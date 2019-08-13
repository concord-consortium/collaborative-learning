import { DB } from "../db";
import { DBOfferingUserProblemDocument, DBOfferingUser, DBOfferingUserProblemDocumentMap } from "../db-types";
import { forEach } from "lodash";

export class DBProblemDocumentsListener {
  private db: DB;
  private problemDocsRef: firebase.database.Reference | null  = null;

  constructor(db: DB) {
    this.db = db;
  }

  public start() {
    const { user } = this.db.stores;

    // teacher user - load documents for all users
    if (user.isTeacher) {
      const offeringUsersRef = this.db.firebase.ref(this.db.firebase.getOfferingUsersPath(user));
      offeringUsersRef.on("value", snapshot => {
        this.handleLoadOfferingUsersDocuments(snapshot);
      });
      return;
    }

    // student user - load documents for user and group
    return new Promise<void>((resolve, reject) => {
      const problemDocsRef = this.problemDocsRef = this.db.firebase.ref(
        this.db.firebase.getProblemDocumentsPath(user));
      // use once() so we are ensured that documents are set before we resolve
      problemDocsRef.once("value", (snapshot) => {
        this.handleLoadProblemDocuments(snapshot);
        problemDocsRef.on("child_added", this.handleProblemDocumentAdded);
      })
      .then(snapshot => {
        resolve();
      })
      .catch(reject);
    });
  }

  public stop() {
    if (this.problemDocsRef) {
      this.problemDocsRef.off("child_added", this.handleProblemDocumentAdded);
    }
  }

  private handleLoadOfferingUsersDocuments = (snapshot: firebase.database.DataSnapshot) => {
    const users = snapshot.val();
    const { documents } = this.db.stores;
    forEach(users, (user: DBOfferingUser, userId: number | string) => {
      if (user) {
        forEach(user.sectionDocuments, sectionDoc => {
          if (sectionDoc && !documents.getDocument(sectionDoc.documentKey)) {
            this.db.createDocumentFromProblemDocument(String(userId), sectionDoc)
              .then(documents.add);
          }
        });
      }
    });
  }

  private handleLoadProblemDocuments = (snapshot: firebase.database.DataSnapshot) => {
    const problemDocuments: DBOfferingUserProblemDocumentMap = snapshot.val();
    if (problemDocuments) {
      forEach(problemDocuments, (document) => {
        this.handleProblemDocument(document);
      });
    }
  }

  private handleProblemDocumentAdded = (snapshot: firebase.database.DataSnapshot) => {
    const problemDocument: DBOfferingUserProblemDocument|null = snapshot.val();
    this.handleProblemDocument(problemDocument);
  }

  private handleProblemDocument(problemDocument: DBOfferingUserProblemDocument|null) {
    const {user, documents} = this.db.stores;
    // If a workspace has already been created, or is currently been created, then its listeners are already set
    if (problemDocument
          && !documents.getDocument(problemDocument.documentKey)) {
      this.db.createDocumentFromProblemDocument(user.id, problemDocument)
        .then((document) => {
          this.db.listeners.updateGroupUserProblemDocumentListeners(document);
          this.db.listeners.monitorDocumentVisibility(document);
          return document;
        })
        .then(documents.add);
    }
  }
}
