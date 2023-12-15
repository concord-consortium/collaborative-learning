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
    //console.log("||> 1 start has a single user, that is the logged in user:", user );
    const { user } = this.db.stores;
    return new Promise<void>((resolve, reject) => {
      //console.log("||> 2 path is calculated to a ref that is all users in the offering:");
      const offeringUsersRef = this.offeringUsersRef = this.db.firebase.ref(
        this.db.firebase.getUserDocumentMetadataPath(user)
      );

      /* but I think we need to get a different Ref to find the docs */
      // console.log(">> result of getOfferingUsersPath:", this.db.firebase.getOfferingUsersPath(user));
      // console.log(">> but we want to get docs from: ... classes/demoClass8/users/[userId]personalDocs", this.db.firebase.getUserDocumentMetadataPath(user) );
      //console.log("|| 3,4, ref is onced to a snapshot, which is passed to handlePersonalDocs");
      offeringUsersRef.once("value").then((snapshot) => {
          this.handlePersonalDocs(snapshot);
          offeringUsersRef.on("child_added", this.onUserChildAdded = this.handleAddOrChange("child_added"));
          offeringUsersRef.on("child_changed", this.onUserChildChanged = this.handleAddOrChange("child_changed"));
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

  // {{HANDLEDOCS}}
  private handlePersonalDocs = (snapshot: firebase.database.DataSnapshot) => {
    const snapVal = snapshot.val();
    console.log("|| handlePersonalDocs, looking for student personal docs!", snapVal);
    const users: DBOfferingUserMap = snapshot.val();
    const { user: currentUser } = this.db.stores;
    forEach(users, (user: DBOfferingUser) => {
      const isCurrentUser = String(user.self.uid) === currentUser.id;
      if (user && !isCurrentUser) {
        this.handleOfferingUser(user);
      }
    });
  };

  // {{ HANDLEADDORCHANGE}}
  private handleAddOrChange = (eventType: string) => (snapshot: firebase.database.DataSnapshot) => {
    const user: DBOfferingUser = snapshot.val();
    this.debugLogSnapshot(`#handleLoadOfferingUserAddedOrChanged (${eventType})`, snapshot);
    if (user) {
      this.handleOfferingUser(user);
    }
  };

  // {{ MAINEVENT }}
  private handleOfferingUser = (user: DBOfferingUser) => {
    console.log("|| handleOfferingUser, looking for a student!", user);
    if (!user.self?.uid) return;
    const { documents, user: currentUser } = this.db.stores;
    const isCurrentUser = String(user.self.uid) === currentUser.id;

    if (size(user.documents) === 0) {
      documents.resolveRequiredDocumentPromiseWithNull(PersonalDocument);
    }

    forEach(user.documents, document => {
      if (!document?.documentKey || !document?.self?.uid) return;

      const existingDoc = documents.getDocument(document.documentKey);

      if (existingDoc) {
        console.log("|| YA EXISTE:", document);
        // this.db.updateDocumentFromProblemDocument(existingDoc, document);
      }

      else {
        console.log("|| NO EXISTE:", document);
        // this.db.createDocumentModelFromProblemMetadata(PersonalDocument as any, document.self.uid, document)
        // .then((docModel) => {
        //   if (isCurrentUser) {
        //     documents.resolveRequiredDocumentPromise(docModel);
        //     syncStars(docModel, this.db);
        //   }
        // });
      }
    });
  };
}

