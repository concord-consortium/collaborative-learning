import firebase from "firebase/app";
import { DB } from "../db";
import { OtherDocumentType, PersonalDocument } from "../../models/document/document-types";
import { BaseListener } from "./base-listener";

export class DBStudentPersonalDocsListener extends BaseListener {
  private db: DB;
  private userPersonalDocsRefs: firebase.database.Reference[];

  constructor(db: DB, documentType: OtherDocumentType) {
    super("DBStudentPersonalDocsListener");
    this.db = db;
  }

  public start() {
    const { user } = this.db.stores;
    return new Promise<void>((resolve, reject) => {
      const offeringUsersRef = this.db.firebase.ref(
        this.db.firebase.getOfferingUsersPath(user)
      );

      const classPath = this.db.firebase.getClassPath(user);
      this.debugLogHandler("#start", "adding", "once", offeringUsersRef);
      offeringUsersRef.once("value").then((snapshot) => {
          const snapVal = snapshot.val();
          const userKeys = Object.keys(snapVal).filter(key => key !== user.id);
          const userPaths = userKeys.map(key => `${classPath}/users/${key}/personalDocs`);
          this.userPersonalDocsRefs = userPaths.map(path => this.db.firebase.ref(path));
          this.userPersonalDocsRefs.forEach(ref => {
            this.debugLogHandlers("#start", "adding", ["child_added"], ref);
            ref.on("child_added", this.handlePersonalDocAdded);
          });
          resolve();
        })
        .catch(reject);
    });
  }

  public stop() {
    if (this.userPersonalDocsRefs) {
      this.userPersonalDocsRefs.forEach(ref => {
        this.debugLogHandlers("#stop", "removing", ["child_added"], ref);
        ref.off("child_added", this.handlePersonalDocAdded);
      });
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

