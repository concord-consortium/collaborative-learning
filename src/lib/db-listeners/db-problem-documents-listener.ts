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
    super("DBProblemDocumentsListener");
    this.db = db;
  }

  public start() {
    const { user } = this.db.stores;
    //console.log("|> 1 start has a single user, that is the logged in user:", user );

    // both teachers and students listen to all problem documents
    // but only teachers listen to all content.  students only listen
    // to content of users in their group to reduce network traffic
    return new Promise<void>((resolve, reject) => {
      //console.log("|> 2 path is calculated to a ref that is all users in the offering:", this.db.firebase.getOfferingUsersPath(user));
      const offeringUsersRef = this.offeringUsersRef = this.db.firebase.ref(
        this.db.firebase.getOfferingUsersPath(user));
      this.debugLogHandler("#start", "adding", "once", offeringUsersRef);
      // once is called immediately, and will proceed to resolve promise even if there is no value
      offeringUsersRef.once("value")
        .then((snapshot) => {
          //console.log("|> 3 that ref is onced to a snapshot", snapshot );
          //console.log("|> 4 and that snapshot is passed to handleLoadOfferingUsersProblemDocuments...");
          this.handleLoadOfferingUsersProblemDocuments(snapshot);
          // We have to listen to both events because of a race condition of the documents
          // not being set when the child is added
          console.log("|> 4(OJO!) we add listers for child_added and child_changed to the ref, basically telling them to handleOfferingUser again when things change",);
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

  // {{HANDLEDOCS}}
  private handleLoadOfferingUsersProblemDocuments = (snapshot: firebase.database.DataSnapshot) => {

    const { user: { id: selfUserId }, documents } = this.db.stores;
    const users: DBOfferingUserMap = snapshot.val();
    //console.log("|> 5 handleLoadOfferingUsersProblemDocuments loops over and passes each of user metadata to handleOfferingUser:...", users);
    this.debugLogSnapshot("#handleLoadOfferingUsersProblemDocuments", snapshot);
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

  // {{ HANDLEADDORCHANGE }}
  private handleLoadOfferingUserAddedOrChanged = (eventType: string) => (snapshot: firebase.database.DataSnapshot) => {
    const user: DBOfferingUser = snapshot.val();
    this.debugLogSnapshot(`#handleLoadOfferingUserAddedOrChanged (${eventType})`, snapshot);
    if (user) {
      this.handleOfferingUser(user);
    }
  };

  // --listener-- 5
  // {{ MAINEVENT }}
  private handleOfferingUser = (user: DBOfferingUser) => {
    if (!user.self?.uid) return;
    const { documents, user: currentUser } = this.db.stores;
    // uid should always be a string, but demo users with numeric uids have been encountered
    const isCurrentUser = String(user.self.uid) === currentUser.id;

    if (isCurrentUser && (size(user.documents) === 0)) {
      documents.resolveRequiredDocumentPromiseWithNull(ProblemDocument);
    }

    //console.log("|> ... 6  handleOfferingUser takes user...", user.self.uid);
    // console.log("|> ... 7 and loops over documents in store already:", documents);
    forEach(user.documents, document => {
      //console.log("|> ... ...  8  it considers if doc is in store...and...passes it to appropriate db method", document.documentKey);
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
