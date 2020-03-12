import { DB } from "../db";
import { BaseListener } from "./base-listener";

export class DBLatestGroupIdListener extends BaseListener {
  private db: DB;
  private latestGroupIdRef: firebase.database.Reference | null = null;

  constructor(db: DB) {
    super("DBLatestGroupIdListener");
    this.db = db;
  }

  public start() {
    return new Promise<void>((resolve, reject) => {
      const latestGroupIdRef = this.latestGroupIdRef = this.db.firebase.getLatestGroupIdRef();
      // use once() so we are ensured that latestGroupId is set before we resolve
      this.debugLogHandler("#start", "adding", "once", latestGroupIdRef);
      latestGroupIdRef.once("value")
        .then(snapshot => {
          this.handleLatestGroupIdRef(snapshot);
          this.debugLogHandler("#start", "adding", "on value", latestGroupIdRef);
          latestGroupIdRef.on("value", this.handleLatestGroupIdRef);
          resolve();
        })
        .catch(reject);
    });
  }

  public stop() {
    if (this.latestGroupIdRef) {
      this.debugLogHandler("#stop", "removing", "on value", this.latestGroupIdRef);
      this.latestGroupIdRef.off("value");
      this.latestGroupIdRef = null;
    }
  }

  private handleLatestGroupIdRef = (snapshot: firebase.database.DataSnapshot) => {
    const val = snapshot.val() || undefined;
    this.debugLogSnapshot("#handleLatestGroupIdRef", snapshot);
    this.db.stores.user.setLatestGroupId(val);
  }
}
