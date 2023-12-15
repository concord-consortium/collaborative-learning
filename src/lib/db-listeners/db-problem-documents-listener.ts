import firebase from "firebase/app";
import { forEach, size } from "lodash";
import { DB } from "../db";
import { DBOfferingUser, DBOfferingUserMap } from "../db-types";
import { PlanningDocument, ProblemDocument } from "../../models/document/document-types";
import { BaseListener } from "./base-listener";
import { syncStars } from "./sync-stars";

export class DBProblemDocumentsListener extends BaseListener {
  private db: DB;
  private offeringUsersRef: firebase.database.Reference | null  = null;
  private onLoadOfferingUserChildAdded: (snapshot: firebase.database.DataSnapshot) => void;
  private onLoadOfferingUserChildChanged: (snapshot: firebase.database.DataSnapshot) => void;

  constructor(db: DB) {
    console.log("| 1 instantiate a DBProblemDocumentsListener");
    super("DBProblemDocumentsListener");
    this.db = db;
  }

  public start() {
    const { user } = this.db.stores;
    console.log("| 2 start a DBProblemDocumentsListener with user:", user );

    // both teachers and students listen to all problem documents
    // but only teachers listen to all content.  students only listen
    // to content of users in their group to reduce network traffic
    return new Promise<void>((resolve, reject) => {
      const offeringUsersRef = this.offeringUsersRef = this.db.firebase.ref(
        this.db.firebase.getOfferingUsersPath(user));
      this.debugLogHandler("#start", "adding", "once", offeringUsersRef);
      // once is called immediately, and will proceed to resolve promise even if there is no value
      offeringUsersRef.once("value")
        .then((snapshot) => {
          console.log("| 3 start a DBProblemDocumentsListener onces a snapshot of getOfferingUsersPath:", snapshot );
          this.handleLoadOfferingUsersProblemDocuments(snapshot);
          // We have to listen to both events because of a race condition of the documents
          // not being set when the child is added
          this.debugLogHandlers("#start", "adding", ["child_added", "child_changed"], offeringUsersRef);
          offeringUsersRef.on("child_added",
            this.onLoadOfferingUserChildAdded = this.handleLoadOfferingUserAddedOrChanged("child_added"));
          offeringUsersRef.on("child_changed",
            this.onLoadOfferingUserChildChanged = this.handleLoadOfferingUserAddedOrChanged("child_changed"));
          resolve();
        })
        .catch(reject);
    });
  }

  public stop() {
    if (this.offeringUsersRef) {
      this.debugLogHandlers("#stop", "removing", ["child_added", "child_changed"], this.offeringUsersRef);
      this.offeringUsersRef.off("child_added", this.onLoadOfferingUserChildAdded);
      this.offeringUsersRef.off("child_changed", this.onLoadOfferingUserChildChanged);
    }
  }

  // --listener-- 4
  private handleLoadOfferingUsersProblemDocuments = (snapshot: firebase.database.DataSnapshot) => {
    console.log("| 4 handleLoadOfferingUsersProblemDocuments gets snapshot...", snapshot);
    const { user: { id: selfUserId }, documents } = this.db.stores;
    const users: DBOfferingUserMap = snapshot.val();
    this.debugLogSnapshot("#handleLoadOfferingUsersProblemDocuments", snapshot);
    console.log("| 5... and handles each user in it...", users);
    forEach(users, (user: DBOfferingUser) => {
      if (user) {
        this.handleOfferingUser(user);
      }
    });
    // if the user doesn't exist in the offering or if the user exists without a self
    // then we need to initialize the user and (most likely) any problem or planning documents
    // in the case of a user with self and without documents handleOfferingUser creates the documents
    const currentUser = users?.[selfUserId];
    !currentUser?.self && documents.resolveRequiredDocumentPromisesWithNull([ProblemDocument, PlanningDocument]);
  };

  private handleLoadOfferingUserAddedOrChanged = (eventType: string) => (snapshot: firebase.database.DataSnapshot) => {
    const user: DBOfferingUser = snapshot.val();
    this.debugLogSnapshot(`#handleLoadOfferingUserAddedOrChanged (${eventType})`, snapshot);
    if (user) {
      this.handleOfferingUser(user);
    }
  };

  // --listener-- 5
  private handleOfferingUser = (user: DBOfferingUser) => {
    if (!user.self?.uid) return;
    const { documents, user: currentUser } = this.db.stores;
    // uid should always be a string, but demo users with numeric uids have been encountered
    const isCurrentUser = String(user.self.uid) === currentUser.id;

    if (isCurrentUser && (size(user.documents) === 0)) {
      documents.resolveRequiredDocumentPromiseWithNull(ProblemDocument);
    }

    // --listener-- 6
    forEach(user.documents, document => {
      console.log("| ... 6  handleOfferingUser gets document...", document.documentKey);
      if (!document?.documentKey || !document?.self?.uid) return;
      const existingDoc = documents.getDocument(document.documentKey);
      if (existingDoc) {
        this.db.updateDocumentFromProblemDocument(existingDoc, document);
      } else {
        this.db.createDocumentModelFromProblemMetadata(ProblemDocument, document.self.uid, document)
          .then((docModel) => {
            if (isCurrentUser) {
              documents.resolveRequiredDocumentPromise(docModel);
              syncStars(docModel, this.db);
            }
          });
      }
    });

    if (isCurrentUser && (size(user.planning) === 0)) {
      documents.resolveRequiredDocumentPromiseWithNull(PlanningDocument);
    }
    forEach(user.planning, document => {
      if (!document?.documentKey || !document?.self?.uid) return;
      const existingDoc = documents.getDocument(document.documentKey);
      if (!existingDoc) {
        this.db.createDocumentModelFromProblemMetadata(PlanningDocument, document.self.uid, document)
          .then(doc => {
            isCurrentUser && documents.resolveRequiredDocumentPromise(doc);
          });
      }
    });
  };
}
