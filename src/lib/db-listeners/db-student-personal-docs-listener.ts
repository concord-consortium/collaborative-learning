import firebase from "firebase/app";
import { DB } from "../db";
import { OtherDocumentType, PersonalDocument } from "../../models/document/document-types";
import { BaseListener } from "./base-listener";

export class DBStudentPersonalDocsListener extends BaseListener {
  private db: DB;
  private offeringUsersRef: firebase.database.Reference | null  = null;

  constructor(db: DB, documentType: OtherDocumentType) {
    super("DBStudentPersonalDocsListener");
    this.db = db;
  }

  public start() {
    const { user } = this.db.stores;
    return new Promise<void>((resolve, reject) => {
      const offeringUsersRef = this.offeringUsersRef = this.db.firebase.ref(
        this.db.firebase.getOfferingUsersPath(user)
      );

      const classPath = this.db.firebase.getClassPath(user);
      offeringUsersRef.once("value").then((snapshot) => {
          const snapVal = snapshot.val();
          const userKeys = Object.keys(snapVal).filter(key => key !== user.id);
          const userPaths = userKeys.map(key => `${classPath}/users/${key}/personalDocs`);
          const userPersonalDocsRefs = userPaths.map(path => this.db.firebase.ref(path));
          userPersonalDocsRefs.forEach(ref => {
            ref.on("child_added", this.handlePersonalDocAdded);
          });
          resolve();
        })
        .catch(reject);
    });
  }

  public stop() {
    if (this.offeringUsersRef) {
      // this.offeringUsersRef.off("child_added", this.onUserChildAdded);
      // this.offeringUsersRef.off("child_changed", this.onUserChildChanged);
    }
  }

  private handlePersonalDocAdded = (snapshot: firebase.database.DataSnapshot) => {
    const docMetaSnap = snapshot.val();
    const docKey = docMetaSnap.self.documentKey;

    if (!docKey || !docMetaSnap?.self?.uid) return;
    const documents = this.db.stores.documents;
    const existingDoc = documents.getDocument(docKey);

    if (existingDoc) return;

    this.db.createDocumentModelFromOtherDocument(docMetaSnap, PersonalDocument);
  };
}

