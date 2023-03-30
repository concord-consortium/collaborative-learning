import firebase from "firebase/app";
import { forEach, size } from "lodash";
import { DB, Monitor } from "../db";
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
    super("DBProblemDocumentsListener");
    this.db = db;
  }

  public start() {
    const { user } = this.db.stores;

    // both teachers and students listen to all problem documents
    // but only teachers listen to all content.  students only listen
    // to content of users in their group to reduce network traffic
    return new Promise<void>((resolve, reject) => {
      const offeringUsersRef = this.offeringUsersRef = this.db.firebase.ref(
        this.db.firebase.getOfferingUsersPath(user));
      // use once() so we are ensured that documents are set before we resolve
      this.debugLogHandler("#start", "adding", "once", offeringUsersRef);
      offeringUsersRef.once("value")
        .then((snapshot) => {
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

  private handleLoadOfferingUsersProblemDocuments = (snapshot: firebase.database.DataSnapshot) => {
    const { user: { id: selfUserId }, documents } = this.db.stores;
    const users: DBOfferingUserMap = snapshot.val();
    this.debugLogSnapshot("#handleLoadOfferingUsersProblemDocuments", snapshot);
    forEach(users, (user: DBOfferingUser) => {
      if (user) {
        this.handleOfferingUser(user);
      }
    });
    // if the user doesn't exist in the offering, then there can't be any problem or planning documents
    !users?.[selfUserId] && documents.resolveRequiredDocumentPromisesWithNull([ProblemDocument, PlanningDocument]);
  };

  private handleLoadOfferingUserAddedOrChanged = (eventType: string) => (snapshot: firebase.database.DataSnapshot) => {
    const user: DBOfferingUser = snapshot.val();
    this.debugLogSnapshot(`#handleLoadOfferingUserAddedOrChanged (${eventType})`, snapshot);
    if (user) {
      this.handleOfferingUser(user);
    }
  };

  private handleOfferingUser = (user: DBOfferingUser) => {
    if (!user?.self?.uid) return;
    const { documents, user: currentUser, groups } = this.db.stores;
    // uid should always be a string, but demo users with numeric uids have been encountered
    const isOwnDocument = String(user.self.uid) === currentUser.id;
    // monitor problem documents
    if (isOwnDocument && (size(user.documents) === 0)) {
      documents.resolveRequiredDocumentPromiseWithNull(ProblemDocument);
    }
    forEach(user.documents, document => {
      if (!document?.documentKey || !document?.self?.uid) return;
      const existingDoc = documents.getDocument(document.documentKey);
      if (existingDoc) {
        this.db.updateDocumentFromProblemDocument(existingDoc, document);
      } else {
        // both teachers and students listen to all problem documents
        // but only teachers listen to all content.  students only listen
        // to content of users in their group to reduce network traffic
        // TODO: maybe currentGroupId isn't always available here and that can cause
        // a problem?
        const userInGroup = groups.userInGroup(document.self.uid, currentUser.currentGroupId);
        // Local changes take precedence over remote changes
        const monitor = isOwnDocument
                          ? Monitor.Local
                          : currentUser.isTeacher || userInGroup
                            ? Monitor.Remote
                            : Monitor.None;
        this.db.createDocumentModelFromProblemMetadata(ProblemDocument, document.self.uid, document, monitor)
          .then((doc) => {
            if (isOwnDocument) {
              documents.resolveRequiredDocumentPromise(doc);
              syncStars(doc, this.db);
            }
          });
      }
    });
    // monitor planning documents
    if (isOwnDocument && (size(user.planning) === 0)) {
      documents.resolveRequiredDocumentPromiseWithNull(PlanningDocument);
    }
    forEach(user.planning, document => {
      if (!document?.documentKey || !document?.self?.uid) return;
      const existingDoc = documents.getDocument(document.documentKey);
      if (!existingDoc) {
        this.db.createDocumentModelFromProblemMetadata(PlanningDocument, document.self.uid, document, Monitor.Local)
          .then(doc => {
            isOwnDocument && documents.resolveRequiredDocumentPromise(doc);
          });
      }
    });
  };
}
