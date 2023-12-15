import firebase from "firebase/app";
import { forEach, size } from "lodash";
import { DB } from "../db";
import { DBOfferingUser, DBOfferingUserMap } from "../db-types";
import { OtherDocumentType, PersonalDocument } from "../../models/document/document-types";
import { BaseListener } from "./base-listener";

export class DBStudentPersonalDocsListener extends BaseListener {
  private db: DB;
  private offeringUsersRef: firebase.database.Reference | null  = null;
  private documentType: OtherDocumentType; // not sure we'll need this
  private onUserChildAdded: (snapshot: firebase.database.DataSnapshot) => void;
  private onUserChildChanged: (snapshot: firebase.database.DataSnapshot) => void;

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

      offeringUsersRef.once("value").then((snapshot) => {
          this.handlePersonalDocs(snapshot);
          offeringUsersRef.on("child_added", this.onUserChildAdded = this.handleUserChange("child_added"));
          offeringUsersRef.on("child_changed", this.onUserChildChanged = this.handleUserChange("child_changed"));
          resolve();
        })
        .catch(reject);
    });
  }

  public stop() {
    if (this.offeringUsersRef) {
      this.offeringUsersRef.off("child_added", this.onUserChildAdded);
      this.offeringUsersRef.off("child_changed", this.onUserChildChanged);
    }
  }

  // --listener-- 4
  private handlePersonalDocs = (snapshot: firebase.database.DataSnapshot) => {
    const users: DBOfferingUserMap = snapshot.val();
    const { user: currentUser } = this.db.stores;
    forEach(users, (user: DBOfferingUser) => {
      const isCurrentUser = String(user.self.uid) === currentUser.id;
      if (user && !isCurrentUser) {
        this.handleOfferingUser(user);
      }
    });
  };

  private handleUserChange = (eventType: string) => (snapshot: firebase.database.DataSnapshot) => {
  };

  // --listener-- 5
  private handleOfferingUser = (user: DBOfferingUser) => {
    if (!user.self?.uid) return;
    console.log("|    ...handleOfferingUser", user.self.uid);
    const { documents } = this.db.stores;

    if (size(user.documents) === 0) {
      documents.resolveRequiredDocumentPromiseWithNull(PersonalDocument);
    }

    // --listener-- 6
    forEach(user.documents, document => {
      if (!document?.documentKey || !document?.self?.uid) return;
      const existingDoc = documents.getDocument(document.documentKey);

      if (existingDoc) {
        console.log("| TODO - handle visibility like this?");
        // this.db.updateDocumentFromProblemDocument(existingDoc, document);
      }

      else {
        console.log("| got a document?", document, document.self);
        // this.db.createDocumentModelFromOtherDocument(document as any, PersonalDocument)
        //   .then((docModel) => {
        //     if (isCurrentUser) {
        //       documents.resolveRequiredDocumentPromise(docModel);
        //       syncStars(docModel, this.db);
        //     }
        //   }
        // );
      }
    });


  };
}

/*

  1. get this installing in index.ts
  2. see if you make it to the console.log
  3. I think the next step will be getting the right path from the right spot



*/
