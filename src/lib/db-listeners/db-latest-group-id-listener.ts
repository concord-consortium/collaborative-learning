import { DB } from "../db";

export class DBLatestGroupIdListener {
  private db: DB;
  private latestGroupIdRef: firebase.database.Reference | null = null;

  constructor(db: DB) {
    this.db = db;
  }

  public start() {
    return new Promise<void>((resolve, reject) => {
      const latestGroupIdRef = this.latestGroupIdRef = this.db.firebase.getLatestGroupIdRef();
      // use once() so we are ensured that latestGroupId is set before we resolve
      latestGroupIdRef.once("value", (snapshot) => {
        this.handleLatestGroupIdRef(snapshot);
        latestGroupIdRef.on("value", this.handleLatestGroupIdRef);
      })
      .then(snapshot => {
        resolve();
      })
      .catch(reject);
    });
  }

  public stop() {
    if (this.latestGroupIdRef) {
      this.latestGroupIdRef.off("value");
      this.latestGroupIdRef = null;
    }
  }

  private handleLatestGroupIdRef = (snapshot: firebase.database.DataSnapshot) => {
    this.db.stores.user.setLatestGroupId(snapshot.val() || undefined);
  }
}
