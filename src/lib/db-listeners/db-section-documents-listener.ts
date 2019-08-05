import { DB } from "../db";
import { DBOfferingUserSectionDocument, DBOfferingUser } from "../db-types";
import { forEach } from "lodash";

export class DBSectionDocumentsListener {
  private db: DB;
  private sectionDocsRef: firebase.database.Reference | null  = null;

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
      const sectionDocsRef = this.sectionDocsRef = this.db.firebase.ref(
        this.db.firebase.getSectionDocumentPath(user));
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

  private handleLoadOfferingUsersDocuments = (snapshot: firebase.database.DataSnapshot) => {
    const users = snapshot.val();
    const { documents } = this.db.stores;
    forEach(users, (user: DBOfferingUser, userId: number | string) => {
      if (user) {
        forEach(user.sectionDocuments, sectionDoc => {
          if (sectionDoc && !documents.getDocument(sectionDoc.documentKey)) {
            this.db.createDocumentFromSectionDocument(String(userId), sectionDoc)
              .then(documents.add);
          }
        });
      }
    });
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
    const {user, documents} = this.db.stores;
    // If a workspace has already been created, or is currently been created, then its listeners are already set
    if (sectionDocument
          && !documents.getDocument(sectionDocument.documentKey)
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
