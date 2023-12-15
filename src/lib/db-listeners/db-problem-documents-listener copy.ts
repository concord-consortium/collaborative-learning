import firebase from "firebase/app";
import { forEach } from "lodash";
import { DB } from "../db";
import { DBOfferingUser, DBOfferingUserMap } from "../db-types";
import { BaseListener } from "./base-listener";

export class DBProblemDocumentsListener extends BaseListener {
  private db: DB;
  private offeringUsersRef: firebase.database.Reference | null  = null;
  private onADD: (snapshot: firebase.database.DataSnapshot) => void;
  private onCHANGED: (snapshot: firebase.database.DataSnapshot) => void;

  constructor(db: DB) {
    super("DBProblemDocumentsListener");
    this.db = db;
  }

  public start() {
    const { user } = this.db.stores;
    return new Promise<void>((resolve, reject) => {
      const offeringUsersRef = this.offeringUsersRef = this.db.firebase.ref(
        this.db.firebase.getOfferingUsersPath(user));

      offeringUsersRef.once("value")
        .then((snapshot) => {
          this.handleLoadOfferingUsersProblemDocuments(snapshot);
          offeringUsersRef.on("child_added",this.onADD = this.handleALL("child_added"));
          offeringUsersRef.on("child_changed",this.onCHANGED = this.handleALL("child_changed"));
          resolve();
        })
        .catch(reject);
    });
  }


  private handleLoadOfferingUsersProblemDocuments = (snapshot: firebase.database.DataSnapshot) => {
    const { user: { id: selfUserId }, documents } = this.db.stores;
    const users: DBOfferingUserMap = snapshot.val();

    forEach(users, (user: DBOfferingUser) => {
      if (user) {
        this.handleOfferingUserNOICE(user);
      }
    });
  };

  private handleALL = (eventType: string) => (snapshot: firebase.database.DataSnapshot) => {
    const user: DBOfferingUser = snapshot.val();
    this.debugLogSnapshot(`#handleLoadOfferingUserAddedOrChanged (${eventType})`, snapshot);
    if (user) {
      this.handleOfferingUserNOICE(user);
    }
  };

  private handleOfferingUserNOICE = (user: DBOfferingUser) => {
    if (!user.self?.uid) return;
    const { documents, user: currentUser } = this.db.stores;
    const isCurrentUser = String(user.self.uid) === currentUser.id;

    forEach(user.documents, document => {
      // if it exists, do db this, otherwise do db that
    });
  };
}
