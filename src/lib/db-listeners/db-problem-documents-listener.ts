import { DB, Monitor } from "../db";
import { DBOfferingUser, DBOfferingUserMap } from "../db-types";
import { forEach } from "lodash";
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
    const users: DBOfferingUserMap = snapshot.val();
    this.debugLogSnapshot("#handleLoadOfferingUsersProblemDocuments", snapshot);
    forEach(users, (user: DBOfferingUser) => {
      if (user) {
        this.handleOfferingUser(user);
      }
    });
  }

  private handleLoadOfferingUserAddedOrChanged = (eventType: string) => (snapshot: firebase.database.DataSnapshot) => {
    const user: DBOfferingUser = snapshot.val();
    this.debugLogSnapshot(`#handleLoadOfferingUserAddedOrChanged (${eventType})`, snapshot);
    if (user) {
      this.handleOfferingUser(user);
    }
  }

  private handleOfferingUser = (user: DBOfferingUser) => {
    if (!user?.self?.uid) return;
    const { documents, user: currentUser, groups } = this.db.stores;
    forEach(user.documents, document => {
      if (!document?.documentKey || !document?.self?.uid) return;
      const existingDoc = documents.getDocument(document.documentKey);
      if (existingDoc) {
        this.db.updateDocumentFromProblemDocument(existingDoc, document);
      } else {
        const isOwnDocument = user.self.uid === currentUser.id;
        const userInGroup = groups.userInGroup(document.self.uid, currentUser.latestGroupId);
        const monitorRemote = currentUser.isTeacher || (!isOwnDocument && userInGroup);
        const monitorLocal = isOwnDocument;
        // Local changes take precident over remote changes …
        const monitor = monitorLocal ? Monitor.Local : (monitorRemote ? Monitor.Remote : Monitor.None);
        this.db.createDocumentFromProblemDocument(document.self.uid, document, monitor)
          .then((doc) => {
            if (isOwnDocument) {
              syncStars(doc, this.db);
              this.db.listeners.monitorDocumentVisibility(doc);
            }
            return doc;
          })
          .then(documents.add);
      }
    });
  }
}
