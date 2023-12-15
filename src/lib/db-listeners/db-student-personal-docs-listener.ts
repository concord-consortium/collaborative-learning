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
  private relevantUsers: string[];
  private usersDocumentMetadataPaths: string[];
  private classPath: string;

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

      this.classPath = this.db.firebase.getFullClassPath(user);
      // console.log("|| classPath:", this.classPath);

      // const firstSnap = offeringUsersRef.once("value").then((snapshot) => snapshot.val());
      // console.log("|| firstSnap:", firstSnap);
      // this.relevantUsers = Object.keys(firstSnap).filter(key => key !== user.id);
      // this.usersDocumentMetadataPaths = this.relevantUsers.map(key => {
      //   return `${this.classPath}/users/${key}/personalDocs`;
      // });

      // console.log("|| relevantUsers:", this.relevantUsers);

      // resolve();
      offeringUsersRef.once("value").then((snapshot) => {
          const snapVal = snapshot.val();
          const userKeys = Object.keys(snapVal).filter(key => key !== user.id);
          const userPaths = userKeys.map(key => `${this.classPath}/users/${key}/personalDocs`);
          this.usersDocumentMetadataPaths = userPaths;

          console.log("|| userDocumentMetadataPaths:", userPaths);
          // create a firebase ref for each path in userPaths
          const userRefs = userPaths.map(path => this.db.firebase.ref(path));
          userRefs.forEach(ref => {

            ref.once('value').then(userRefSnap => {
              console.log("|| userRefSnap: ", userRefSnap);
              const userRefSnapVal = userRefSnap.val();
              console.log("|| userRefSnapVal: ", userRefSnapVal);
            });

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

